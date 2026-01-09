import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const WA_BRIDGE_URL = process.env.WA_BRIDGE_URL || 'http://localhost:3001';
const WA_BRIDGE_API_KEY = process.env.WA_BRIDGE_API_KEY || '';

/**
 * POST /api/whatsapp/connection/qr
 * Generates a new QR code for WhatsApp connection via wa-bridge
 */
export async function POST() {
  try {
    const supabase = createClient();

    // Call wa-bridge to get QR code
    const response = await fetch(`${WA_BRIDGE_URL}/qr`, {
      method: 'GET',
      headers: {
        'X-API-Key': WA_BRIDGE_API_KEY,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `wa-bridge returned ${response.status}`);
    }

    const { qr, expiresAt } = await response.json();

    // Check if there's an existing connection
    const { data: existingConnection } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (existingConnection) {
      // Update existing connection
      const { error } = await supabase
        .from('whatsapp_connections')
        .update({
          status: 'qr_pending',
          qr_code_data: qr,
          qr_code_expires_at: expiresAt,
          phone_number: null,
          connected_at: null,
        })
        .eq('id', existingConnection.id);

      if (error) throw error;
    } else {
      // Create new connection
      const { error } = await supabase.from('whatsapp_connections').insert({
        status: 'qr_pending',
        qr_code_data: qr,
        qr_code_expires_at: expiresAt,
      });

      if (error) throw error;
    }

    // Update wa-bridge with CRM webhook URL
    await updateWaBridgeWebhook(supabase);

    return NextResponse.json({
      success: true,
      qrCodeData: qr,
      qrCodeExpiresAt: expiresAt,
    });
  } catch (error) {
    console.error('QR code generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate QR code' },
      { status: 500 }
    );
  }
}

async function updateWaBridgeWebhook(supabase: ReturnType<typeof createClient>) {
  try {
    // Get inbound webhook URL from settings
    const { data: inboundWebhookSetting } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'n8n_webhook_inbound_url')
      .single();

    const webhookUrl = inboundWebhookSetting?.value?.url;

    if (webhookUrl) {
      // Note: wa-bridge will fetch this from CRM on startup or we can add an endpoint
      // For now, we'll let wa-bridge fetch it when needed
    }
  } catch (error) {
    console.error('Error updating wa-bridge webhook:', error);
  }
}

