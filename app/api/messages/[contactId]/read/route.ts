import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/messages/[contactId]/read
 * Mark all inbound messages for a contact as read
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { contactId: string } }
) {
  try {
    const supabase = createClient();
    const { contactId } = params;

    const { error } = await supabase
      .from('messages')
      .update({
        is_read: true,
        read_at: new Date().toISOString(),
      })
      .eq('contact_id', contactId)
      .eq('direction', 'in')
      .eq('is_read', false);

    if (error) {
      console.error('Error marking messages as read:', error);
      return NextResponse.json(
        { error: 'Failed to mark messages as read' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Mark read error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to mark messages as read',
      },
      { status: 500 }
    );
  }
}

