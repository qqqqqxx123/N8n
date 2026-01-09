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
 * Get all messages for a specific contact or phone number (conversation)
 * contactId can be either a UUID (contact_id) or a phone number (phone_e164)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  try {
    const supabase = createClient();
    const { contactId } = params;

    // Check if contactId is a UUID (36 characters with hyphens) or phone number
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contactId);

    let messagesQuery = supabase
      .from('messages')
      .select('*');

    if (isUUID) {
      // Fetch by contact_id
      messagesQuery = messagesQuery.eq('contact_id', contactId);
    } else {
      // Fetch by phone_e164 (for orphaned messages)
      messagesQuery = messagesQuery.eq('phone_e164', contactId).is('contact_id', null);
    }

    const { data: messages, error } = await messagesQuery.order('created_at', { ascending: true });

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

    // WhatsApp Account Protection: Check if we can send this message
    const { canSendMessage } = await import('@/lib/utils/whatsapp-protection');
    const isTemplate = !!template_name;
    const protectionCheck = await canSendMessage(contactId, isTemplate);

    if (!protectionCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Cannot send message - protection limits exceeded',
          reasons: protectionCheck.reasons,
          details: {
            dailyQuota: {
              sent: protectionCheck.dailyQuota.sentToday,
              limit: protectionCheck.dailyQuota.remaining + protectionCheck.dailyQuota.sentToday,
              remaining: protectionCheck.dailyQuota.remaining,
            },
            hourlyQuota: {
              sent: protectionCheck.hourlyQuota.sentThisHour,
              limit: protectionCheck.hourlyQuota.remaining + protectionCheck.hourlyQuota.sentThisHour,
              remaining: protectionCheck.hourlyQuota.remaining,
            },
            contactFrequency: {
              messagesToday: protectionCheck.contactFrequency.messagesToday,
              lastMessageAt: protectionCheck.contactFrequency.lastMessageAt,
            },
            window24h: {
              inWindow: protectionCheck.window24h.inWindow,
              canSendFreeForm: protectionCheck.window24h.canSendFreeForm,
            },
          },
        },
        { status: 429 }
      );
    }

    // Note: Opt-in check removed - allow sending to all contacts
    // The messaging provider (n8n/WhatsApp) will handle opt-in compliance if needed

    // Create message record (status will be updated by webhook callback)
    const { data: message, error: messageError } = await supabase
      .from('messages')
      .insert({
        contact_id: contactId,
        phone_e164: contact.phone_e164, // Store phone for linking if needed
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

    // Check if WhatsApp connection is active and send via wa-bridge
    const { data: connection } = await supabase
      .from('whatsapp_connections')
      .select('status')
      .eq('status', 'connected')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const WA_BRIDGE_URL = process.env.WA_BRIDGE_URL || 'http://localhost:3001';
    const WA_BRIDGE_API_KEY = process.env.WA_BRIDGE_API_KEY || '';

    // Try wa-bridge first if connected
    if (connection) {
      try {
        const response = await fetch(`${WA_BRIDGE_URL}/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': WA_BRIDGE_API_KEY,
          },
          body: JSON.stringify({
            to: contact.phone_e164,
            text: messageBody,
            template: template_name ? { name: template_name, language: template_language, variables: template_variables } : undefined,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.messageId) {
            await supabase
              .from('messages')
              .update({
                status: 'delivered',
                provider_message_id: data.messageId,
              })
              .eq('id', message.id);

            message.status = 'delivered';
            message.provider_message_id = data.messageId;
          }
        }
      } catch (error) {
        console.error('wa-bridge send error (non-fatal):', error);
        // Fall through to n8n webhook
      }
    }

    // Fallback to n8n webhook if wa-bridge not available or not connected
    if (message.status === 'sent') {
      const { data: settings } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'n8n_webhook_url')
        .single();

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
    }

    // Only notify outbound webhook when using n8n (not wa-bridge)
    // When using wa-bridge, the OutboundHandler will handle webhook notification when Baileys detects the sent message
    // This prevents duplicate message records from being created
    if (!connection && message.status === 'sent') {
      try {
        const { data: outboundWebhookSetting } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'n8n_webhook_url')
          .single();

        const outboundWebhookUrl = outboundWebhookSetting?.value?.url;
        const webhookSecret = outboundWebhookSetting?.value?.secret || '';

        if (outboundWebhookUrl) {
          // Notify outbound webhook about the sent message (only for n8n fallback)
          const webhookPayload = {
            action: 'message_sent',
            direction: 'out',
            contact_id: contactId,
            phone_e164: contact.phone_e164,
            message: {
              id: message.id,
              body: messageBody,
              status: message.status,
              template_name: template_name || undefined,
              template_language: template_language || undefined,
              template_variables: template_variables || undefined,
              provider_message_id: message.provider_message_id || undefined,
            },
            timestamp: new Date().toISOString(),
            provider: 'n8n',
          };

          try {
            const axios = (await import('axios')).default;
            await axios.post(
              outboundWebhookUrl,
              webhookPayload,
              {
                headers: {
                  'Content-Type': 'application/json',
                  ...(webhookSecret && { 'X-Webhook-Secret': webhookSecret }),
                },
                timeout: 10000,
              }
            );
            console.log('Outbound message notification sent to outbound webhook (n8n):', {
              messageId: message.id,
              status: message.status,
            });
          } catch (notifyError) {
            console.error('Failed to notify outbound webhook (non-fatal):', notifyError);
          }
        }
      } catch (notifyError) {
        console.error('Error notifying outbound webhook:', notifyError);
      }
    } else if (connection) {
      console.log('Skipping outbound webhook notification (wa-bridge will handle it):', {
        messageId: message.id,
      });
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

/**
 * DELETE /api/messages/[contactId]
 * Delete all messages for a specific contact
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  try {
    const supabase = createClient();
    const { contactId } = params;

    // Check if contactId is a UUID (36 characters with hyphens) or phone number
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(contactId);

    if (!isUUID) {
      return NextResponse.json(
        { error: 'Contact ID must be a valid UUID' },
        { status: 400 }
      );
    }

    // Verify contact exists
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id')
      .eq('id', contactId)
      .single();

    if (contactError || !contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    // Get count of messages before deleting
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('contact_id', contactId);

    // Delete all messages for this contact
    const { error: deleteError } = await supabase
      .from('messages')
      .delete()
      .eq('contact_id', contactId);

    if (deleteError) {
      console.error('Error deleting messages:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete messages' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Deleted all messages for contact ${contactId}`,
      deletedCount: count || 0,
    });
  } catch (error) {
    console.error('Delete messages error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete messages',
      },
      { status: 500 }
    );
  }
}

