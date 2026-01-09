import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { normalizePhoneToE164 } from '@/lib/utils/phone';
import { normalizeDOB } from '@/lib/utils/dob';

// Helper function to validate and parse dates
function isValidDate(dateString: string): boolean {
  if (!dateString || typeof dateString !== 'string') return false;
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date.getTime());
}

// Use the centralized DOB normalization function
const formatDOB = normalizeDOB;

// Helper function to safely parse and format timestamp dates (returns ISO string or null)
function formatTimestamp(timestampString: string | undefined): string | null {
  if (!timestampString || !timestampString.trim()) return null;
  
  const trimmed = timestampString.trim();
  
  // Validate the date before converting
  if (!isValidDate(trimmed)) {
    return null; // Return null for invalid dates instead of throwing
  }
  
  const date = new Date(trimmed);
  // Double-check the date is valid before calling toISOString
  if (isNaN(date.getTime())) {
    return null;
  }
  
  return date.toISOString();
}

const ImportRowSchema = z.object({
  full_name: z.string().optional(),
  phone_e164: z.string(),
  source: z.string().optional(),
  tags: z.array(z.string()).or(z.string()).optional(),
  dob: z.string().optional(),
  opt_in_status: z.boolean().optional(),
  opt_in_timestamp: z.string().optional(),
  opt_in_source: z.string().optional(),
  last_purchase_at: z.string().optional(),
  total_spend: z.number().optional(),
  interest_type: z.string().optional(),
});

const ImportRequestSchema = z.object({
  rows: z.array(ImportRowSchema),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { rows } = ImportRequestSchema.parse(body);

    const supabase = createClient();

    let imported = 0;
    let duplicates = 0;
    const importBatchId = crypto.randomUUID();

    // Process rows in batches
    for (const row of rows) {
      // Normalize phone to E.164 (using Hong Kong country code 852 as default)
      const normalizedPhone = normalizePhoneToE164(row.phone_e164) || normalizePhoneToE164(row.phone_e164, '852');
      if (!normalizedPhone) {
        continue; // Skip invalid phone numbers
      }

      // Check if contact already exists
      const { data: existing } = await supabase
        .from('contacts')
        .select('id')
        .eq('phone_e164', normalizedPhone)
        .single();

      if (existing) {
        duplicates++;
        continue;
      }

      // Prepare contact data
      const contactData: any = {
        phone_e164: normalizedPhone,
        full_name: row.full_name || null,
        source: row.source || 'csv_import',
        tags: Array.isArray(row.tags) ? row.tags : (row.tags ? [row.tags] : []),
        DOB: formatDOB(row.dob || ''), // Use uppercase DOB to match database column
        opt_in_status: row.opt_in_status ?? false,
        opt_in_timestamp: formatTimestamp(row.opt_in_timestamp),
        opt_in_source: row.opt_in_source || null,
        last_purchase_at: row.last_purchase_at?.trim() || null, // Store as varchar string
        total_spend: row.total_spend || 0,
        interest_type: row.interest_type || null,
      };

      // Insert contact
      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .insert(contactData)
        .select()
        .single();

      if (contactError || !contact) {
        console.error('Error inserting contact:', contactError);
        continue;
      }

      // Create csv_import event
      await supabase.from('events').insert({
        contact_id: contact.id,
        type: 'csv_import',
        meta: {
          import_batch_id: importBatchId,
          source_file: 'csv_upload',
        },
      });

      imported++;
    }

    // Trigger n8n webhook if contacts were imported
    if (imported > 0) {
      try {
        const { data: settings } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'n8n_webhook_url')
          .single();

        if (settings?.value?.url) {
          // Get imported contacts for webhook
          const { data: importedContacts } = await supabase
            .from('contacts')
            .select('id, phone_e164, full_name')
            .eq('source', 'csv_import')
            .order('created_at', { ascending: false })
            .limit(imported);

          await fetch('/api/n8n/import-trigger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              import_batch_id: importBatchId,
              contacts: importedContacts || [],
            }),
          });
        }
      } catch (webhookError) {
        console.error('Error triggering n8n webhook:', webhookError);
        // Don't fail the import if webhook fails
      }
    }

    return NextResponse.json({
      success: true,
      import_batch_id: importBatchId,
      counts: {
        imported,
        duplicates,
        total: rows.length,
      },
    });
  } catch (error) {
    console.error('CSV import error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to import CSV' },
      { status: 500 }
    );
  }
}


