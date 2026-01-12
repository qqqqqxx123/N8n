import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const SettingsSchema = z.object({
  n8n_webhook_url: z.string().url().or(z.literal('')).optional(),
  n8n_webhook_inbound_url: z.string().url().or(z.literal('')).optional(),
  n8n_webhook_secret: z.string().optional(),
  templates: z.array(z.object({
    id: z.string(),
    name: z.string(),
    message: z.string().optional(),
  })).optional(),
});

export async function GET() {
  try {
    const supabase = createClient();

    const [webhookSettings, inboundWebhookSettings, templatesSettings] = await Promise.all([
      supabase.from('settings').select('value').eq('key', 'n8n_webhook_url').single(),
      supabase.from('settings').select('value').eq('key', 'n8n_webhook_inbound_url').single(),
      supabase.from('settings').select('value').eq('key', 'whatsapp_templates').single(),
    ]);

    const settings = {
      n8n_webhook_url: webhookSettings.data?.value?.url || '',
      n8n_webhook_inbound_url: inboundWebhookSettings.data?.value?.url || '',
      n8n_webhook_secret: webhookSettings.data?.value?.secret || '',
      templates: templatesSettings.data?.value || [],
    };

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Settings fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = SettingsSchema.parse(body);

    const supabase = createClient();

    // Update outbound webhook settings
    if (validated.n8n_webhook_url !== undefined || validated.n8n_webhook_secret !== undefined) {
      const { data: existing } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'n8n_webhook_url')
        .single();

      const currentValue = existing?.value || {};
      const newValue = {
        url: validated.n8n_webhook_url !== undefined ? validated.n8n_webhook_url : currentValue.url,
        secret: validated.n8n_webhook_secret !== undefined ? validated.n8n_webhook_secret : currentValue.secret,
      };

      await supabase
        .from('settings')
        .upsert({
          key: 'n8n_webhook_url',
          value: newValue,
          updated_at: new Date().toISOString(),
        });
    }

    // Update inbound webhook settings
    if (validated.n8n_webhook_inbound_url !== undefined) {
      await supabase
        .from('settings')
        .upsert({
          key: 'n8n_webhook_inbound_url',
          value: { url: validated.n8n_webhook_inbound_url },
          updated_at: new Date().toISOString(),
        });

      // Notify wa-bridge to refresh webhook URL if it's running
      try {
        const waBridgeUrl = process.env.WA_BRIDGE_URL || 'http://localhost:3001';
        const waBridgeApiKey = process.env.WA_BRIDGE_API_KEY || '';
        
        if (waBridgeUrl && waBridgeApiKey) {
          await fetch(`${waBridgeUrl}/refresh-webhook`, {
            method: 'POST',
            headers: {
              'X-API-Key': waBridgeApiKey,
            },
          }).catch((err) => {
            // Non-fatal - wa-bridge might not be running
            console.log('wa-bridge not available for webhook refresh:', err.message);
          });
        }
      } catch (error) {
        // Non-fatal error - continue even if wa-bridge refresh fails
        console.log('Failed to notify wa-bridge of webhook change:', error);
      }
    }

    // Update templates
    if (validated.templates !== undefined) {
      await supabase
        .from('settings')
        .upsert({
          key: 'whatsapp_templates',
          value: validated.templates,
          updated_at: new Date().toISOString(),
        });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Settings save error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid settings data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save settings' },
      { status: 500 }
    );
  }
}


