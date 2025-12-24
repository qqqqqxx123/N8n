import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/messages/unread-count
 * Returns the count of unread inbound messages
 */
export async function GET() {
  try {
    const supabase = createClient();

    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('direction', 'in')
      .eq('is_read', false);

    if (error) {
      console.error('Error fetching unread count:', error);
      return NextResponse.json(
        { error: 'Failed to fetch unread count' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      unreadCount: count || 0,
    });
  } catch (error) {
    console.error('Unread count error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to get unread count',
      },
      { status: 500 }
    );
  }
}

