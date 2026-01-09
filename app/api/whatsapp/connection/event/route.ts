import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const ConnectionEventSchema = z.object({
  event: z.enum(['connected', 'disconnected', 'qr_expired']),
  phoneNumber: z.string().optional(),
  sessionId: z.string().optional(),
});

/**
 * POST /api/whatsapp/connection/event
 * Handles connection events from WhatsApp API provider
 * This endpoint should be called by your WhatsApp integration when:
 * - QR code is scanned and phone connects
 * - Connection is lost
 * - QR code expires
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = ConnectionEventSchema.parse(body);

    const supabase = createClient();

    // Get the current connection
    const { data: connection } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!connection) {
      return NextResponse.json({ error: 'No connection found' }, { status: 404 });
    }

    if (parsed.event === 'connected') {
      // Update connection status to connected
      await supabase
        .from('whatsapp_connections')
        .update({
          status: 'connected',
          phone_number: parsed.phoneNumber || null,
          connected_at: new Date().toISOString(),
          qr_code_data: null,
          qr_code_expires_at: null,
        })
        .eq('id', connection.id);

      return NextResponse.json({ success: true, message: 'Connection established' });
    } else if (parsed.event === 'disconnected') {
      // Update connection status to disconnected
      await supabase
        .from('whatsapp_connections')
        .update({
          status: 'not_connected',
          disconnected_at: new Date().toISOString(),
          qr_code_data: null,
          qr_code_expires_at: null,
        })
        .eq('id', connection.id);

      return NextResponse.json({ success: true, message: 'Connection disconnected' });
    } else if (parsed.event === 'qr_expired') {
      // Update connection status to expired
      await supabase
        .from('whatsapp_connections')
        .update({
          status: 'expired',
          qr_code_data: null,
          qr_code_expires_at: null,
        })
        .eq('id', connection.id);

      return NextResponse.json({ success: true, message: 'QR code expired' });
    }

    return NextResponse.json({ error: 'Unknown event type' }, { status: 400 });
  } catch (error) {
    console.error('Connection event error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid event payload', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process connection event' },
      { status: 500 }
    );
  }
}



