import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { normalizePhoneToE164 } from '@/lib/utils/phone';

const InboundMessageSchema = z.object({
  from: z.string(), // Phone number
  body: z.string().optional(),
  message_id: z.string().optional(),
  timestamp: z.string().optional(),
  type: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = InboundMessageSchema.parse(body);

    const supabase = createClient();

    // Normalize phone number (using Hong Kong country code 852 as default)
    const normalizedPhone =
      normalizePhoneToE164(message.from) || normalizePhoneToE164(message.from, '852');

    if (!normalizedPhone) {
      return NextResponse.json({ error: 'Invalid phone number format' }, { status: 400 });
    }

    // Find contact by phone (IMPORTANT: select opt_in_status too for TS + logic)
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id,opt_in_status')
      .eq('phone_e164', normalizedPhone)
      .single();

    // Contact doesn't exist -> create a new one
    if (contactError || !contact) {
      const { data: newContact, error: createError } = await supabase
        .from('contacts')
        .insert({
          phone_e164: normalizedPhone,
          source: 'whatsapp_inbound',
          opt_in_status: true, // inbound implies opt-in
          opt_in_timestamp: new Date().toISOString(),
          opt_in_source: 'whatsapp_inbound',
        })
        .select('id')
        .single();

      if (createError || !newContact) {
        return NextResponse.json({ error: 'Failed to create contact' }, { status: 500 });
      }

      await supabase.from('messages').insert({
        contact_id: newContact.id,
        direction: 'in',
        status: 'delivered',
        provider_message_id: message.message_id ?? null,
        body: message.body ?? null,
        is_read: false,
      });

      await supabase.from('events').insert({
        contact_id: newContact.id,
        type: 'whatsapp_inbound',
        meta: {
          message_id: message.message_id,
          body: message.body,
          timestamp: message.timestamp || new Date().toISOString(),
        },
      });

      return NextResponse.json({
        success: true,
        contact_id: newContact.id,
        message: 'Contact created and message logged',
      });
    }

    // Contact exists -> get last inbound timestamp
    const { data: lastInbound } = await supabase
      .from('messages')
      .select('created_at')
      .eq('contact_id', contact.id)
      .eq('direction', 'in')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Log message
    await supabase.from('messages').insert({
      contact_id: contact.id,
      direction: 'in',
      status: 'delivered',
      provider_message_id: message.message_id ?? null,
      body: message.body ?? null,
      is_read: false,
    });

    // Log event
    await supabase.from('events').insert({
      contact_id: contact.id,
      type: 'whatsapp_inbound',
      meta: {
        message_id: message.message_id,
        body: message.body,
        timestamp: message.timestamp || new Date().toISOString(),
        last_inbound_whatsapp_at: lastInbound?.created_at || new Date().toISOString(),
      },
    });

    // Update opt-in status if not already opted in
    if (!contact.opt_in_status) {
      await supabase
        .from('contacts')
        .update({
          opt_in_status: true,
          opt_in_timestamp: new Date().toISOString(),
          opt_in_source: 'whatsapp_inbound',
        })
        .eq('id', contact.id);
    }

    return NextResponse.json({
      success: true,
      contact_id: contact.id,
      message: 'Message logged',
    });
  } catch (error) {
    console.error('WhatsApp webhook error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid webhook payload', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process webhook' },
      { status: 500 }
    );
  }
}
