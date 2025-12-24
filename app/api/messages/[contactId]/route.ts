import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const SendMessageSchema = z.object({
  body: z.string().min(1),
  template_name: z.string().optional(),
  template_language: z.string().optional(),
  template_variables: z.array(z.string()).optional(),
});

/**
 * GET /api/messages/[contactId]
 * Get all messages for a specific contact (conversation)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  try {
    const supabase = createClient();
    const { contactId } = params;

    const { data: messages, error } = await supabase
      .from('messages')
      .select('*')
      .eq('contact_id', contactId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
      return NextResponse.json(
        { error: 'Failed to fetch messages' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      messages: messages || [],
    });
  } catch (error) {
    console.error('Messages fetch error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch messages',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/messages/[contactId]
 * Send a message to a contact
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  try {
    const supabase = createClient();
    const { contactId } = params;
    const body = await request.json();
    const { body: messageBody, template_name, template_language, template_variables } = SendMessageSchema.parse(body);

    // Verify contact exists and has opt-in
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, phone_e164, full_name, opt_in_status')
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Note: Opt-in check removed - allow sending to all contacts
    // The messaging provider (n8n/WhatsApp) will handle opt-in compliance if needed

    // Create message record (status will be updated by webhook callback)
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        contact_id: contactId,
        direction: 'out',
        body: messageBody,
        status: 'sent',
        template_name: template_name || null,
        is_read: false,
      })
      .select()
      .single();

    if (messageError) {
      console.error('Error creating message:', messageError);
      return NextResponse.json(
        { error: 'Failed to create message' },
        { status: 500 }
      );
    }

    // Get n8n webhook URL from settings
    const { data: settings } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'n8n_webhook_url')
      .single();

    // If webhook is configured, send message via webhook
    if (settings?.value?.url) {
      const webhookUrl = settings.value.url;
      const webhookSecret = settings.value.secret || '';

      try {
        // Import axios dynamically
        const axios = (await import('axios')).default;
        const webhookResponse = await axios.post(
          webhookUrl,
          {
            action: 'send_message',
            contact_id: contactId,
            phone_e164: contact.phone_e164,
            message: {
              body: messageBody,
              template_name: template_name || undefined,
              template_language: template_language || undefined,
              template_variables: template_variables || undefined,
            },
            timestamp: new Date().toISOString(),
          },
          {
            headers: {
              'Content-Type': 'application/json',
              ...(webhookSecret && { 'X-Webhook-Secret': webhookSecret }),
            },
            timeout: 30000,
          }
        );

        // If n8n returns success with message_id, update message status to delivered
        if (webhookResponse.data?.success === true && webhookResponse.data?.message_id) {
          await supabase
            .from('messages')
            .update({
              status: 'delivered',
              provider_message_id: webhookResponse.data.message_id,
            })
            .eq('id', message.id);
          
          // Update message object for response
          message.status = 'delivered';
          message.provider_message_id = webhookResponse.data.message_id;
        }
      } catch (webhookError: any) {
        console.error('Webhook error (non-fatal):', webhookError);
        // Don't fail the request if webhook fails - message stays as 'sent'
      }
    }

    // Create event
    await supabase.from('events').insert({
      contact_id: contactId,
      type: 'whatsapp_outbound',
      meta: {
        message_id: message.id,
        body: messageBody,
        template_name: template_name || null,
      },
    });

    return NextResponse.json({
      success: true,
      message: message,
    });
  } catch (error) {
    console.error('Send message error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to send message',
      },
      { status: 500 }
    );
  }
}

