import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/messages/conversations
 * Returns list of conversations grouped by contact_id or phone_e164
 * Query params:
 *   - limit: Number of conversations to return (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Get all messages with optional contact join
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        contact_id,
        phone_e164,
        direction,
        body,
        status,
        is_read,
        created_at,
        contacts(
          id,
          full_name,
          phone_e164,
          opt_in_status
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit * 10); // Get more to filter unique conversations

    if (messagesError) {
      throw messagesError;
    }

    // Group by conversationKey = contact_id ?? phone_e164
    const conversationMap = new Map<string, {
      conversationKey: string;
      contact: any | null;
      phone_e164: string | null;
      latestMessage: any;
    }>();

    messages?.forEach((message: any) => {
      // Use contact_id if available, otherwise use phone_e164 as conversation key
      const conversationKey = message.contact_id || message.phone_e164;
      
      if (!conversationKey) return; // Skip messages without both contact_id and phone_e164

      if (!conversationMap.has(conversationKey)) {
        // If contact exists, use it; otherwise create a minimal contact object
        const contact = message.contacts || (message.phone_e164 ? {
          id: null,
          full_name: null,
          phone_e164: message.phone_e164,
          opt_in_status: true,
        } : null);

        conversationMap.set(conversationKey, {
          conversationKey,
          contact,
          phone_e164: message.phone_e164,
          latestMessage: {
            id: message.id,
            body: message.body,
            direction: message.direction,
            status: message.status,
            is_read: message.is_read,
            created_at: message.created_at,
          },
        });
      } else {
        // Update if this message is newer
        const existing = conversationMap.get(conversationKey)!;
        const existingTime = new Date(existing.latestMessage.created_at).getTime();
        const newTime = new Date(message.created_at).getTime();
        
        if (newTime > existingTime) {
          existing.latestMessage = {
            id: message.id,
            body: message.body,
            direction: message.direction,
            status: message.status,
            is_read: message.is_read,
            created_at: message.created_at,
          };
        }
      }
    });

    // Get unread counts per conversation
    const conversationKeys = Array.from(conversationMap.keys());
    const contactIds = conversationKeys.filter(k => k.includes('-') || k.length === 36); // UUIDs are 36 chars
    const phoneNumbers = conversationKeys.filter(k => !contactIds.includes(k));

    const unreadMap = new Map<string, number>();

    // Count unread for contact-based conversations
    if (contactIds.length > 0) {
      const { data: unreadByContact } = await supabase
        .from('messages')
        .select('contact_id')
        .in('contact_id', contactIds)
        .eq('direction', 'in')
        .eq('is_read', false);

      unreadByContact?.forEach((msg) => {
        const count = unreadMap.get(msg.contact_id) || 0;
        unreadMap.set(msg.contact_id, count + 1);
      });
    }

    // Count unread for phone-based conversations
    if (phoneNumbers.length > 0) {
      const { data: unreadByPhone } = await supabase
        .from('messages')
        .select('phone_e164')
        .in('phone_e164', phoneNumbers)
        .is('contact_id', null)
        .eq('direction', 'in')
        .eq('is_read', false);

      unreadByPhone?.forEach((msg) => {
        const count = unreadMap.get(msg.phone_e164) || 0;
        unreadMap.set(msg.phone_e164, count + 1);
      });
    }

    // Format response
    const formattedConversations = Array.from(conversationMap.values()).map((data) => ({
      conversationKey: data.conversationKey,
      contact: data.contact,
      phone_e164: data.phone_e164,
      latestMessage: data.latestMessage,
      unreadCount: unreadMap.get(data.conversationKey) || 0,
    }));

    // Sort by latest message time
    formattedConversations.sort((a, b) => 
      new Date(b.latestMessage.created_at).getTime() - new Date(a.latestMessage.created_at).getTime()
    );

    return NextResponse.json({
      conversations: formattedConversations.slice(0, limit),
    });
  } catch (error) {
    console.error('Conversations fetch error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch conversations',
      },
      { status: 500 }
    );
  }
}

