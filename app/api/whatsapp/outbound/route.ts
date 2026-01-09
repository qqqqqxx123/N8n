import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { normalizePhoneToE164 } from '@/lib/utils/phone';

const OutboundMessageSchema = z.object({
  from: z.string(), // Phone number (actually "to" since it's outbound)
  body: z.string().optional(),
  message: z.string().optional(), // Alternative field name for message body
  message_id: z.string().optional(),
  timestamp: z.string().optional(),
  type: z.string().optional(),
  phone_e164: z.string().optional(),
  direction: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Log incoming webhook for debugging
    console.log('[OUTBOUND WEBHOOK] Received payload from wa-bridge:', JSON.stringify(body, null, 2));
    
    // Parse and validate the message
    let parsed;
    try {
      parsed = OutboundMessageSchema.parse(body);
    } catch (parseError) {
      console.error('[OUTBOUND WEBHOOK] Validation error:', parseError);
      // Try to extract basic fields even if validation fails
      parsed = {
        from: body.from || body.phone_e164 || body.phone || '',
        body: body.body || body.message || body.text || '',
        message_id: body.message_id || body.id || null,
        timestamp: body.timestamp || new Date().toISOString(),
        type: body.type || 'text',
        phone_e164: body.phone_e164 || body.from,
        direction: 'out',
      };
      console.warn('[OUTBOUND WEBHOOK] Using fallback parsing:', parsed);
    }
    
    // Map 'message' field to 'body' if body is not present
    const message = {
      ...parsed,
      body: parsed.body || parsed.message || null,
    };

    console.log('[OUTBOUND WEBHOOK] Processed message:', JSON.stringify(message, null, 2));

    const supabase = createClient();

    // Normalize phone number
    let normalizedPhone = normalizePhoneToE164(message.from || message.phone_e164 || '');
    
    if (!normalizedPhone) {
      // Try US country code for 10-11 digit numbers
      const phoneDigits = (message.from || message.phone_e164 || '').replace(/\D/g, '');
      if (phoneDigits.length === 10 || phoneDigits.length === 11) {
        normalizedPhone = normalizePhoneToE164(message.from || message.phone_e164 || '', '1');
      }
    }
    
    if (!normalizedPhone) {
      // Try Hong Kong as default
      normalizedPhone = normalizePhoneToE164(message.from || message.phone_e164 || '', '852');
    }

    if (!normalizedPhone) {
      console.error('[OUTBOUND WEBHOOK] Failed to normalize phone:', message.from || message.phone_e164);
      // Still try to save with original format
      normalizedPhone = message.from || message.phone_e164 || '';
      console.warn('[OUTBOUND WEBHOOK] Using original phone format:', normalizedPhone);
    }

    console.log('[OUTBOUND WEBHOOK] Normalized phone:', normalizedPhone);

    // Find contact by phone
    const { data: contact, error: contactError } = await supabase
      .from('contacts')
      .select('id, opt_in_status')
      .eq('phone_e164', normalizedPhone)
      .single();

    let contactId: string | null = null;

    // Contact doesn't exist -> create a new one
    if (contactError || !contact) {
      const { data: newContact, error: createError } = await supabase
        .from('contacts')
        .insert({
          phone_e164: normalizedPhone,
          source: 'whatsapp_outbound',
          opt_in_status: true, // Outbound implies opt-in
          opt_in_timestamp: new Date().toISOString(),
          opt_in_source: 'whatsapp_outbound',
        })
        .select('id')
        .single();

      if (createError || !newContact) {
        console.error('[OUTBOUND WEBHOOK] Failed to create contact, storing message with phone_e164 only:', createError);
        
        const { data: orphanedMessage, error: orphanError } = await supabase.from('messages').insert({
          contact_id: null, // Will be linked later via trigger
          phone_e164: normalizedPhone,
          direction: 'out',
          status: 'delivered',
          provider_message_id: message.message_id ?? null,
          body: message.body ?? null,
          is_read: false,
        }).select().single();

        if (orphanError) {
          console.error('[OUTBOUND WEBHOOK] Error inserting orphaned message:', orphanError);
          return NextResponse.json({ error: 'Failed to create contact and store message' }, { status: 500 });
        }

        return NextResponse.json({
          success: true,
          contact_id: null,
          message: 'Message stored (contact will be created and linked later)',
          phone_e164: normalizedPhone,
        });
      }

      contactId = newContact.id;
    } else {
      contactId = contact.id;
    }

    // Check for duplicate message before inserting
    // A message might already exist if it was created by the CRM when sending
    let existingMessage = null;
    
    if (message.message_id) {
      // Check by provider_message_id first (most reliable)
      const { data: existingByProviderId } = await supabase
        .from('messages')
        .select('id, contact_id, body, created_at, status, provider_message_id')
        .eq('provider_message_id', message.message_id)
        .eq('direction', 'out')
        .maybeSingle();
      
      if (existingByProviderId) {
        existingMessage = existingByProviderId;
        console.log('[OUTBOUND WEBHOOK] Duplicate message detected by provider_message_id, will update:', existingByProviderId.id);
      }
    }
    
    // If not found by provider_message_id, check by contact_id, body, and recent timestamp
    // This catches messages created by CRM that don't have provider_message_id yet
    // Extended time window (2 minutes) to catch messages that might have delays from wa-bridge
    if (!existingMessage && message.body) {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const trimmedBody = message.body.trim();
      
      console.log('[OUTBOUND WEBHOOK] Checking for duplicate by content:', {
        contactId,
        phone: normalizedPhone,
        body: trimmedBody,
        bodyLength: trimmedBody.length,
        since: twoMinutesAgo
      });
      
      // Get ALL recent outbound messages for this contact/phone
      let allRecentQuery = supabase
        .from('messages')
        .select('id, contact_id, body, created_at, provider_message_id, status, phone_e164')
        .eq('direction', 'out')
        .gte('created_at', twoMinutesAgo)
        .order('created_at', { ascending: false });
      
      if (contactId) {
        allRecentQuery = allRecentQuery.eq('contact_id', contactId);
      } else if (normalizedPhone) {
        allRecentQuery = allRecentQuery.eq('phone_e164', normalizedPhone);
      }
      
      const { data: allRecent } = await allRecentQuery.limit(50);
      
      if (allRecent && allRecent.length > 0) {
        console.log(`[OUTBOUND WEBHOOK] Found ${allRecent.length} recent outbound messages to check`);
        
        // First, try exact body match (trimmed) - most reliable
        let matching = allRecent.find(m => {
          if (!m.body) return false;
          return m.body.trim() === trimmedBody;
        });
        
        if (matching) {
          existingMessage = matching;
          console.log('[OUTBOUND WEBHOOK] Found duplicate by exact body match:', {
            id: matching.id,
            body: matching.body,
            status: matching.status
          });
        } else {
          // Second, try fuzzy match - check if messages are very similar (within 5 characters difference)
          // This handles cases where body might be slightly different (e.g., whitespace, encoding)
          const fuzzyMatch = allRecent.find(m => {
            if (!m.body) return false;
            const mBodyTrimmed = m.body.trim();
            const lenDiff = Math.abs(mBodyTrimmed.length - trimmedBody.length);
            // If lengths are similar and one contains the other (or vice versa), it's likely the same message
            if (lenDiff <= 5) {
              return mBodyTrimmed === trimmedBody || 
                     mBodyTrimmed.includes(trimmedBody) || 
                     trimmedBody.includes(mBodyTrimmed);
            }
            return false;
          });
          
          if (fuzzyMatch) {
            existingMessage = fuzzyMatch;
            console.log('[OUTBOUND WEBHOOK] Found duplicate by fuzzy body match:', {
              id: fuzzyMatch.id,
              body: fuzzyMatch.body,
              status: fuzzyMatch.status
            });
          } else if (allRecent.length > 0) {
            // Last resort: if there are any recent messages (within 2 minutes) from the same contact/phone,
            // and we're getting this webhook from wa-bridge (provider: 'wa-bridge-mobile'),
            // assume it's a duplicate to prevent false duplicates
            // This is conservative but prevents duplicates when wa-bridge sends webhooks
            const isWaBridgeWebhook = body.provider === 'wa-bridge-mobile';
            if (isWaBridgeWebhook) {
              existingMessage = allRecent[0];
              console.log('[OUTBOUND WEBHOOK] Found recent message from wa-bridge webhook, treating as duplicate:', {
                id: existingMessage.id,
                body: existingMessage.body,
                status: existingMessage.status,
                created_at: existingMessage.created_at
              });
            }
          }
        }
      } else {
        console.log('[OUTBOUND WEBHOOK] No recent messages found to check');
      }
    }
    
    // If we found an existing message, update it instead of creating a new one
    if (existingMessage) {
      const updateData: Record<string, any> = {
        status: 'delivered', // Update status to delivered
      };
      
      // Update provider_message_id if it's missing or different
      if (message.message_id) {
        if (!existingMessage.provider_message_id || existingMessage.provider_message_id !== message.message_id) {
          updateData.provider_message_id = message.message_id;
        }
      }
      
      // Only update if there are changes
      if (Object.keys(updateData).length > 1 || (updateData.provider_message_id && !existingMessage.provider_message_id)) {
        const { error: updateError } = await supabase
          .from('messages')
          .update(updateData)
          .eq('id', existingMessage.id);
        
        if (updateError) {
          console.error('[OUTBOUND WEBHOOK] Error updating existing message:', updateError);
        } else {
          console.log('[OUTBOUND WEBHOOK] Updated existing message:', existingMessage.id, updateData);
        }
      } else {
        console.log('[OUTBOUND WEBHOOK] Existing message already up to date, skipping update:', existingMessage.id);
      }
    }

    // Final safety check: if we still don't have an existing message but there's a very recent one
    // (within 2 minutes), check if body matches to avoid race conditions
    // This is a last resort check for messages that might have been created just before this webhook was called
    if (!existingMessage && contactId && message.body) {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      const trimmedBody = message.body.trim();
      
      const { data: veryRecentMessages } = await supabase
        .from('messages')
        .select('id, body, status, created_at, provider_message_id')
        .eq('contact_id', contactId)
        .eq('direction', 'out')
        .gte('created_at', twoMinutesAgo)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (veryRecentMessages && veryRecentMessages.length > 0) {
        // Find matching message by body (exact or fuzzy)
        for (const veryRecentCheck of veryRecentMessages) {
          if (!veryRecentCheck.body) continue;
          
          // Check if bodies match (exact or fuzzy)
          const recentBodyTrimmed = veryRecentCheck.body.trim();
          const lenDiff = Math.abs(recentBodyTrimmed.length - trimmedBody.length);
          
          if (recentBodyTrimmed === trimmedBody || 
              (lenDiff <= 5 && (recentBodyTrimmed.includes(trimmedBody) || trimmedBody.includes(recentBodyTrimmed)))) {
            existingMessage = veryRecentCheck;
            console.log('[OUTBOUND WEBHOOK] Safety check: Found very recent matching message (within 2m), preventing duplicate:', {
              id: veryRecentCheck.id,
              body: veryRecentCheck.body,
              status: veryRecentCheck.status,
              provider_message_id: veryRecentCheck.provider_message_id
            });
            break;
          }
        }
      }
    }

    // Only insert if no duplicate found
    if (!existingMessage) {
      console.log('[OUTBOUND WEBHOOK] No existing message found, will insert new message');
      const { data: insertedMessage, error: messageError } = await supabase.from('messages').insert({
        contact_id: contactId,
        phone_e164: normalizedPhone,
        direction: 'out',
        status: 'delivered',
        provider_message_id: message.message_id ?? null,
        body: message.body ?? null,
        is_read: false,
      }).select().single();

      if (messageError) {
        console.error('[OUTBOUND WEBHOOK] Error inserting message:', messageError);
        // Try to save as orphaned message
        const { error: orphanError } = await supabase.from('messages').insert({
          contact_id: null,
          phone_e164: normalizedPhone,
          direction: 'out',
          status: 'delivered',
          provider_message_id: message.message_id ?? null,
          body: message.body ?? null,
          is_read: false,
        });
        
        if (orphanError) {
          console.error('[OUTBOUND WEBHOOK] Error inserting orphaned message:', orphanError);
          return NextResponse.json({ 
            error: 'Failed to save message to database', 
            details: messageError.message 
          }, { status: 500 });
        }
        console.log('[OUTBOUND WEBHOOK] Message saved as orphaned (will be linked later)');
      } else {
        console.log('[OUTBOUND WEBHOOK] Message inserted successfully:', insertedMessage);
      }
    } else {
      console.log('[OUTBOUND WEBHOOK] Skipped duplicate message insert, using existing message:', existingMessage.id);
    }

    // Create event only if we inserted a new message (not a duplicate)
    if (contactId && !existingMessage) {
      await supabase.from('events').insert({
        contact_id: contactId,
        type: 'whatsapp_outbound',
        meta: {
          message_id: message.message_id,
          body: message.body,
          timestamp: message.timestamp || new Date().toISOString(),
          source: 'mobile_device',
        },
      });
    }

    // Forward to outbound webhook URL if configured
    try {
      const { data: outboundWebhookSetting } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'n8n_webhook_url')
        .single();

      const outboundWebhookUrl = outboundWebhookSetting?.value?.url;
      const webhookSecret = outboundWebhookSetting?.value?.secret || '';

      if (outboundWebhookUrl) {
        // Forward message to outbound webhook
        const webhookPayload = {
          action: 'message_sent',
          direction: 'out',
          from: normalizedPhone, // This is actually "to" since it's outbound
          to: normalizedPhone,
          body: message.body,
          message: message.body,
          message_id: message.message_id,
          timestamp: message.timestamp || new Date().toISOString(),
          type: message.type || 'text',
          contact_id: contactId,
          provider: 'wa-bridge-mobile',
        };

        try {
          const webhookResponse = await fetch(outboundWebhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(webhookSecret && { 'X-Webhook-Secret': webhookSecret }),
            },
            body: JSON.stringify(webhookPayload),
          });

          if (!webhookResponse.ok) {
            console.error('[OUTBOUND WEBHOOK] Failed to forward message to outbound webhook:', webhookResponse.statusText);
          } else {
            console.log('[OUTBOUND WEBHOOK] Message forwarded to outbound webhook successfully');
          }
        } catch (webhookError) {
          console.error('[OUTBOUND WEBHOOK] Error forwarding message to outbound webhook:', webhookError);
          // Don't fail the request if webhook forwarding fails
        }
      }
    } catch (forwardError) {
      console.error('[OUTBOUND WEBHOOK] Error checking connection or forwarding message:', forwardError);
      // Don't fail the request if forwarding fails
    }

    return NextResponse.json({
      success: true,
      contact_id: contactId,
      message: 'Outbound message logged',
    });
  } catch (error) {
    console.error('[OUTBOUND WEBHOOK] Error:', error);

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


