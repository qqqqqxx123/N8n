import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import axios from 'axios';

interface MetaTemplate {
  name: string;
  language: string;
  status: string;
  category?: string;
  components?: Array<{
    type: string;
    text?: string;
    format?: string;
    buttons?: Array<{
      type: string;
      text?: string;
    }>;
  }>;
}

interface MetaTemplatesResponse {
  data: MetaTemplate[];
  paging?: {
    next?: string;
  };
}

/**
 * Extract variable count from template components
 * Finds the maximum variable number ({{1}}, {{2}}, etc.)
 */
function extractVariableCount(components: MetaTemplate['components']): number {
  if (!components || !Array.isArray(components)) return 0;

  let maxVar = 0;
  const variablePattern = /\{\{(\d+)\}\}/g;

  for (const component of components) {
    if (component?.text) {
      const matches = component.text.matchAll(variablePattern);
      for (const match of matches) {
        const varNum = parseInt(match[1], 10);
        if (varNum > maxVar) {
          maxVar = varNum;
        }
      }
    }
  }

  return maxVar;
}

/**
 * GET /api/whatsapp/templates/sync
 * Syncs Meta WhatsApp Templates from Meta Graph API to database
 * Only syncs APPROVED templates by default
 */
export async function GET(request: NextRequest) {
  try {
    const wabaId = process.env.META_WABA_ID;
    const accessToken = process.env.META_ACCESS_TOKEN;

    if (!wabaId || !accessToken) {
      return NextResponse.json(
        { error: 'META_WABA_ID and META_ACCESS_TOKEN must be configured' },
        { status: 500 }
      );
    }

    const supabase = createClient();

    // Fetch templates from Meta Graph API
    let allTemplates: MetaTemplate[] = [];
    let nextUrl: string | undefined = `https://graph.facebook.com/v18.0/${wabaId}/message_templates`;

    // Paginate through all templates
    
    import type { AxiosResponse } from "axios";

while (nextUrl) {
  try {
    const response: AxiosResponse<MetaTemplatesResponse> =
      await axios.get(nextUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        timeout: 30000,
      });


        if (response.data.data) {
          allTemplates = allTemplates.concat(response.data.data);
        }

        nextUrl = response.data.paging?.next;
      } catch (apiError: any) {
        console.error('Meta API error:', apiError);
        
        if (apiError.response?.status === 401) {
          return NextResponse.json(
            { error: 'Invalid or expired Meta access token' },
            { status: 401 }
          );
        }
        
        if (apiError.response?.status === 403) {
          return NextResponse.json(
            { error: 'Insufficient permissions to access Meta templates' },
            { status: 403 }
          );
        }

        if (apiError.response?.status === 429) {
          return NextResponse.json(
            { error: 'Meta API rate limit exceeded. Please try again later.' },
            { status: 429 }
          );
        }

        throw new Error(`Meta API error: ${apiError.response?.data?.error?.message || apiError.message}`);
      }
    }

    if (allTemplates.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        message: 'No templates found in Meta account',
      });
    }

    // Filter and upsert templates
    let syncedCount = 0;
    let skippedCount = 0;

    for (const template of allTemplates) {
      // Only sync APPROVED templates (can be changed to include others)
      if (template.status !== 'APPROVED') {
        skippedCount++;
        continue;
      }

      const variableCount = extractVariableCount(template.components);

      // Upsert template
      const { error: upsertError } = await supabase
        .from('whatsapp_templates')
        .upsert(
          {
            waba_id: wabaId,
            name: template.name,
            language: template.language,
            category: template.category || null,
            status: template.status,
            components: Array.isArray(template.components) ? template.components : [],
            variable_count: variableCount,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'waba_id,name,language',
          }
        );

      if (upsertError) {
        console.error(`Error upserting template ${template.name}:`, upsertError);
        continue;
      }

      syncedCount++;
    }

    return NextResponse.json({
      success: true,
      synced: syncedCount,
      skipped: skippedCount,
      total: allTemplates.length,
      message: `Successfully synced ${syncedCount} approved templates`,
    });
  } catch (error) {
    console.error('Template sync error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to sync templates',
      },
      { status: 500 }
    );
  }
}

