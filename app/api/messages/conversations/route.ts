import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/messages/conversations
 * Returns list of conversations (contacts with recent messages)
 * Query params:
 *   - limit: Number of conversations to return (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Get latest message per contact using a subquery approach
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        contact_id,
        direction,
        body,
        status,
        is_read,
        created_at,
        contacts!inner(
          id,
          full_name,
          phone_e164,
          opt_in_status
        )
      `)
      .order('created_at', { ascending: false })
      .limit(limit * 10); // Get more to filter unique contacts

    if (messagesError) {
      throw messagesError;
    }

    // Group by contact_id and get latest message
    const conversationMap = new Map();
    messages?.forEach((message: any) => {
      const contactId = message.contact_id;
      if (!conversationMap.has(contactId)) {
        conversationMap.set(contactId, {
          contact: message.contacts,
          latestMessage: {
            id: message.id,
            body: message.body,
            direction: message.direction,
            status: message.status,
            is_read: message.is_read,
            created_at: message.created_at,
          },
        });
      }
    });

    // Get unread counts per contact
    const contactIds = Array.from(conversationMap.keys());
    const { data: unreadCounts } = await supabase
      .from('messages')
      .select('contact_id')
      .in('contact_id', contactIds)
      .eq('direction', 'in')
      .eq('is_read', false);

    const unreadMap = new Map<string, number>();
    unreadCounts?.forEach((msg) => {
      const count = unreadMap.get(msg.contact_id) || 0;
      unreadMap.set(msg.contact_id, count + 1);
    });

    // Format response
    const formattedConversations = Array.from(conversationMap.entries()).map(([contactId, data]: [string, any]) => ({
      contact: data.contact,
      latestMessage: data.latestMessage,
      unreadCount: unreadMap.get(contactId) || 0,
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

