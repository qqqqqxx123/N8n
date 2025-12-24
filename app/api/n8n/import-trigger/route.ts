import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import axios from 'axios';

const ImportTriggerSchema = z.object({
  import_batch_id: z.string().uuid(),
  contacts: z.array(z.object({
    id: z.string().uuid(),
    phone_e164: z.string(),
    full_name: z.string().nullable(),
  })),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { import_batch_id, contacts } = ImportTriggerSchema.parse(body);

    const supabase = createClient();

    // Get n8n webhook URL from settings
    const { data: settings, error: settingsError } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'n8n_webhook_url')
      .single();

    if (settingsError || !settings?.value?.url) {
      return NextResponse.json(
        { error: 'n8n webhook URL not configured' },
        { status: 400 }
      );
    }

    const webhookUrl = settings.value.url;
    const webhookSecret = settings.value.secret || '';

    // Send payload to n8n
    try {
      const response = await axios.post(
        webhookUrl,
        {
          import_batch_id,
          contacts,
          timestamp: new Date().toISOString(),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(webhookSecret && { 'X-Webhook-Secret': webhookSecret }),
          },
          timeout: 10000,
        }
      );

      return NextResponse.json({
        success: true,
        message: 'n8n webhook triggered successfully',
        response: response.data,
      });
    } catch (webhookError: any) {
      console.error('n8n webhook error:', webhookError);
      return NextResponse.json(
        {
          error: 'Failed to trigger n8n webhook',
          details: webhookError.response?.data || webhookError.message,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Import trigger error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to trigger import' },
      { status: 500 }
    );
  }
}






