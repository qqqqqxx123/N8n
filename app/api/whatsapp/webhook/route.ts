import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { normalizePhoneToE164 } from '@/lib/utils/phone';

const InboundMessageSchema = z.object({
  from: z.string(), // Phone number
  body: z.string().optional(),
  message: z.string().optional(), // Alternative field name for message body
  message_id: z.string().optional(),
  timestamp: z.string().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  success: z.boolean().optional(),
  stored: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Log incoming webhook for debugging
    console.log('[INBOUND WEBHOOK] Received payload:', JSON.stringify(body, null, 2));
    
    // Handle array format - extract first element if it's an array
    const rawMessage = Array.isArray(body) ? body[0] : body;
    
    // Parse and validate the message
    let parsed;
    try {
      parsed = InboundMessageSchema.parse(rawMessage);
    } catch (parseError) {
      console.error('[INBOUND WEBHOOK] Validation error:', parseError);
      // Try to extract basic fields even if validation fails
      parsed = {
        from: rawMessage.from || rawMessage.phone_e164 || rawMessage.phone || '',
        body: rawMessage.body || rawMessage.message || rawMessage.text || '',
        message_id: rawMessage.message_id || rawMessage.id || null,
        timestamp: rawMessage.timestamp || new Date().toISOString(),
        type: rawMessage.type || 'text',
      };
      console.warn('[INBOUND WEBHOOK] Using fallback parsing:', parsed);
    }
    
    // Map 'message' field to 'body' if body is not present
    const message = {
      ...parsed,
      body: parsed.body || parsed.message || null,
    };

    console.log('[INBOUND WEBHOOK] Processed message:', JSON.stringify(message, null, 2));

    const supabase = createClient();

    // Normalize phone number - try multiple country codes
    // First try without default (for numbers that already have country code)
    // Then try with US (1) for 10-11 digit numbers
    // Finally try with Hong Kong (852) as default
    let normalizedPhone = normalizePhoneToE164(message.from);
    
    if (!normalizedPhone) {
      // Try US country code for 10-11 digit numbers
      if (message.from.replace(/\D/g, '').length === 10 || message.from.replace(/\D/g, '').length === 11) {
        normalizedPhone = normalizePhoneToE164(message.from, '1');
      }
    }
    
    if (!normalizedPhone) {
      // Try Hong Kong as default
      normalizedPhone = normalizePhoneToE164(message.from, '852');
    }

    if (!normalizedPhone) {
      console.error('[INBOUND WEBHOOK] Failed to normalize phone:', message.from);
      // Still try to save the message with the original phone number
      console.warn('[INBOUND WEBHOOK] Attempting to save with original phone format:', message.from);
      normalizedPhone = message.from; // Use original format as fallback
    }

    console.log('[INBOUND WEBHOOK] Normalized phone:', normalizedPhone);

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

      // If contact creation fails, still try to store the message with phone_e164
      // The trigger will auto-link it when contact is created later
      if (createError || !newContact) {
        console.error('Failed to create contact, storing message with phone_e164 only:', createError);
        
        const { data: orphanedMessage, error: orphanError } = await supabase.from('messages').insert({
          contact_id: null, // Will be linked later via trigger
          phone_e164: normalizedPhone,
          direction: 'in',
          status: 'delivered',
          provider_message_id: message.message_id ?? null,
          body: message.body ?? null,
          is_read: false,
        }).select().single();

        if (orphanError) {
          console.error('Error inserting orphaned message:', orphanError);
          return NextResponse.json({ error: 'Failed to create contact and store message' }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          contact_id: null,
          message: 'Message stored (contact will be created and linked later)',
          phone_e164: normalizedPhone,
        });
      }

      const { data: insertedMessage, error: messageError } = await supabase.from('messages').insert({
        contact_id: newContact.id,
        phone_e164: normalizedPhone, // Store phone for linking if contact_id fails
        direction: 'in',
        status: 'delivered',
        provider_message_id: message.message_id ?? null,
        body: message.body ?? null,
        is_read: false,
      }).select().single();

      if (messageError) {
        console.error('Error inserting message for new contact:', messageError);
        // Try to save as orphaned message if contact insert fails
        const { error: orphanError } = await supabase.from('messages').insert({
          contact_id: null,
          phone_e164: normalizedPhone,
          direction: 'in',
          status: 'delivered',
          provider_message_id: message.message_id ?? null,
          body: message.body ?? null,
          is_read: false,
        });
        
        if (orphanError) {
          console.error('Error inserting orphaned message:', orphanError);
          return NextResponse.json({ 
            error: 'Failed to save message to database', 
            details: messageError.message 
          }, { status: 500 });
        }
        console.log('Message saved as orphaned (will be linked later)');
      } else {
        console.log('Message inserted successfully for new contact:', insertedMessage);
      }

      await supabase.from('events').insert({
        contact_id: newContact.id,
        type: 'whatsapp_inbound',
        meta: {
          message_id: message.message_id,
          body: message.body,
          timestamp: message.timestamp || new Date().toISOString(),
        },
      });

      // Forward message to inbound webhook URL if configured and connection is active
      try {
        // Check if WhatsApp connection is active
        const { data: connection } = await supabase
          .from('whatsapp_connections')
          .select('phone_number, status')
          .eq('status', 'connected')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (connection) {
          // Get inbound webhook URL from settings
          const { data: inboundWebhookSetting } = await supabase
            .from('settings')
            .select('value')
            .eq('key', 'n8n_webhook_inbound_url')
            .single();

          const inboundWebhookUrl = inboundWebhookSetting?.value?.url;

          if (inboundWebhookUrl) {
            // Forward message to inbound webhook
            const webhookPayload = {
              from: normalizedPhone,
              to: connection.phone_number,
              body: message.body,
              message: message.body, // Alternative field name
              message_id: message.message_id,
              timestamp: message.timestamp || new Date().toISOString(),
              type: message.type || 'text',
              contact_id: newContact.id,
              direction: 'in',
            };

            try {
              const webhookResponse = await fetch(inboundWebhookUrl, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify(webhookPayload),
              });

              if (!webhookResponse.ok) {
                console.error('Failed to forward message to inbound webhook:', webhookResponse.statusText);
              } else {
                console.log('Message forwarded to inbound webhook successfully');
              }
            } catch (webhookError) {
              console.error('Error forwarding message to inbound webhook:', webhookError);
              // Don't fail the request if webhook forwarding fails
            }
          }
        }
      } catch (forwardError) {
        console.error('Error checking connection or forwarding message:', forwardError);
        // Don't fail the request if forwarding fails
      }

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

    // Log message - CRITICAL: This must succeed or return an error
    const { data: insertedMessage, error: messageError } = await supabase.from('messages').insert({
      contact_id: contact.id,
      phone_e164: normalizedPhone, // Store phone for linking if contact_id fails
      direction: 'in',
      status: 'delivered',
      provider_message_id: message.message_id ?? null,
      body: message.body ?? null,
      is_read: false,
    }).select().single();

    if (messageError) {
      console.error('Error inserting message for existing contact:', messageError);
      // Try to save as orphaned message if contact insert fails
      const { error: orphanError } = await supabase.from('messages').insert({
        contact_id: null,
        phone_e164: normalizedPhone,
        direction: 'in',
        status: 'delivered',
        provider_message_id: message.message_id ?? null,
        body: message.body ?? null,
        is_read: false,
      });
      
      if (orphanError) {
        console.error('Error inserting orphaned message:', orphanError);
        return NextResponse.json({ 
          error: 'Failed to save message to database', 
          details: messageError.message 
        }, { status: 500 });
      }
      console.log('Message saved as orphaned (will be linked later)');
    } else {
      console.log('Message inserted successfully for existing contact:', insertedMessage);
    }

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

    // Forward message to inbound webhook URL if configured and connection is active
    try {
      // Check if WhatsApp connection is active
      const { data: connection } = await supabase
        .from('whatsapp_connections')
        .select('phone_number, status')
        .eq('status', 'connected')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (connection) {
        // Get inbound webhook URL from settings
        const { data: inboundWebhookSetting } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'n8n_webhook_inbound_url')
          .single();

        const inboundWebhookUrl = inboundWebhookSetting?.value?.url;

        if (inboundWebhookUrl) {
          // Forward message to inbound webhook
          const webhookPayload = {
            from: normalizedPhone,
            to: connection.phone_number,
            body: message.body,
            message: message.body, // Alternative field name
            message_id: message.message_id,
            timestamp: message.timestamp || new Date().toISOString(),
            type: message.type || 'text',
            contact_id: contact.id,
            direction: 'in',
          };

          try {
            const webhookResponse = await fetch(inboundWebhookUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(webhookPayload),
            });

            if (!webhookResponse.ok) {
              console.error('Failed to forward message to inbound webhook:', webhookResponse.statusText);
            } else {
              console.log('Message forwarded to inbound webhook successfully');
            }
          } catch (webhookError) {
            console.error('Error forwarding message to inbound webhook:', webhookError);
            // Don't fail the request if webhook forwarding fails
          }
        }
      }
    } catch (forwardError) {
      console.error('Error checking connection or forwarding message:', forwardError);
      // Don't fail the request if forwarding fails
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
