import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const WA_BRIDGE_URL = process.env.WA_BRIDGE_URL || 'http://localhost:3001';
const WA_BRIDGE_API_KEY = process.env.WA_BRIDGE_API_KEY || '';

/**
 * GET /api/whatsapp/connection
 * Returns the current WhatsApp connection status from wa-bridge
 */
export async function GET() {
  try {
    const supabase = createClient();

    // Get status from wa-bridge
    const response = await fetch(`${WA_BRIDGE_URL}/status`, {
      method: 'GET',
      headers: {
        'X-API-Key': WA_BRIDGE_API_KEY,
      },
    });

    if (!response.ok) {
      // If wa-bridge is not available, return not_connected
      console.warn('wa-bridge not available, returning not_connected');
      return NextResponse.json({
        status: 'not_connected',
        phoneNumber: null,
        qrCodeData: null,
        qrCodeExpiresAt: null,
      });
    }

    const waBridgeStatus = await response.json();

    // Get stored connection from database
    const { data: connection } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    // Determine status based on wa-bridge and stored data
    let status: string;
    let phoneNumber: string | null = null;
    let qrCodeData: string | null = null;
    let qrCodeExpiresAt: string | null = null;

    if (waBridgeStatus.connected) {
      status = 'connected';
      phoneNumber = waBridgeStatus.phoneNumber || null;

      // Update database
      if (connection) {
        await supabase
          .from('whatsapp_connections')
          .update({
            status: 'connected',
            phone_number: phoneNumber,
            connected_at: new Date().toISOString(),
            qr_code_data: null,
            qr_code_expires_at: null,
          })
          .eq('id', connection.id);
      } else {
        await supabase.from('whatsapp_connections').insert({
          status: 'connected',
          phone_number: phoneNumber,
          connected_at: new Date().toISOString(),
        });
      }
    } else {
      // Not connected - check if we have a pending QR
      if (connection && connection.status === 'qr_pending' && connection.qr_code_expires_at) {
        const expiresAt = new Date(connection.qr_code_expires_at).getTime();
        const now = Date.now();
        if (now > expiresAt) {
          status = 'expired';
          await supabase
            .from('whatsapp_connections')
            .update({ status: 'expired' })
            .eq('id', connection.id);
        } else {
          status = 'qr_pending';
          qrCodeData = connection.qr_code_data;
          qrCodeExpiresAt = connection.qr_code_expires_at;
        }
      } else {
        status = 'not_connected';
      }
    }

    return NextResponse.json({
      status,
      phoneNumber,
      qrCodeData,
      qrCodeExpiresAt,
    });
  } catch (error) {
    console.error('Connection status fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch connection status' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/whatsapp/connection
 * Disconnects the WhatsApp connection via wa-bridge
 */
export async function DELETE() {
  try {
    const supabase = createClient();

    // Call wa-bridge to disconnect
    const response = await fetch(`${WA_BRIDGE_URL}/disconnect`, {
      method: 'POST',
      headers: {
        'X-API-Key': WA_BRIDGE_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `wa-bridge returned ${response.status}`);
    }

    // Update database
    const { data: connection } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (connection) {
      await supabase
        .from('whatsapp_connections')
        .update({
          status: 'not_connected',
          disconnected_at: new Date().toISOString(),
          qr_code_data: null,
          qr_code_expires_at: null,
        })
        .eq('id', connection.id);
    }

    return NextResponse.json({ success: true, message: 'Disconnected successfully' });
  } catch (error) {
    console.error('Disconnect error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to disconnect' },
      { status: 500 }
    );
  }
}

