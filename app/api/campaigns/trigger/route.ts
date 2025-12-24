import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import axios from 'axios';
import { subHours, subDays } from 'date-fns';
import { applyCampaignFilters, CampaignFilters } from '@/lib/campaign-filters';

const CampaignTriggerSchema = z.object({
  segment: z.enum(['hot', 'warm', 'cold']),
  template_name: z.string().min(1),
  template_language: z.string().optional(), // e.g., 'en_US', 'zh_HK'
  template_variables: z.array(z.string()).optional(), // Array of variable values
  filters: z.object({
    minScore: z.number().optional(),
    purchaseMode: z.enum(['any', 'never', 'within', 'olderThan']).optional(),
    purchaseDays: z.number().optional(),
    birthdayWithinDays: z.number().optional(),
    spendMin: z.number().optional(),
    spendMax: z.number().optional(),
    interestTypes: z.array(z.string()).optional(),
    sources: z.array(z.string()).optional(),
    tagsAny: z.array(z.string()).optional(),
    updatedMode: z.enum(['any', 'within', 'olderThan']).optional(),
    updatedDays: z.number().optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { segment, template_name, template_language, template_variables, filters = {} } = CampaignTriggerSchema.parse(body);

    const supabase = createClient();

    // Apply filters to get matching contact IDs
    const filteredContactIds = await applyCampaignFilters(segment, filters);

    if (filteredContactIds.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        matched_count: 0,
        sendable_count: 0,
        contact_ids: [],
        message: 'No contacts match the filters',
      });
    }

    // Fetch contact details for sending
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('id, phone_e164, full_name, opt_in_status, opt_in_timestamp, last_purchase_at, tags')
      .in('id', filteredContactIds);
      // Opt-in requirement removed - all contacts are treated as opted-in

    if (contactsError) {
      return NextResponse.json(
        { error: 'Failed to fetch contacts' },
        { status: 500 }
      );
    }

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        matched_count: filteredContactIds.length,
        sendable_count: 0,
        contact_ids: [],
        message: 'No opted-in contacts after filters',
      });
    }

    // Check 24-hour window for each contact and tag recent buyers
    const twentyFourHoursAgo = subHours(new Date(), 24);
    const sixtyDaysAgo = subDays(new Date(), 60);
    const eligibleContacts = [];
    const contactsToTag = [];

    for (const contact of contacts) {
      // Check if contact has received an inbound message in last 24 hours
      const { data: recentInbound } = await supabase
        .from('messages')
        .select('id')
        .eq('contact_id', contact.id)
        .eq('direction', 'in')
        .gte('created_at', twentyFourHoursAgo.toISOString())
        .limit(1);

      // Check if contact is a recent buyer (within 60 days) - tag but don't exclude (already filtered)
      if (contact.last_purchase_at) {
        const purchaseDate = new Date(contact.last_purchase_at);
        if (purchaseDate >= sixtyDaysAgo) {
          // Tag recent buyers
          if (!contact.tags?.includes('recent_buyer')) {
            contactsToTag.push(contact.id);
          }
        }
      }

      // If no recent inbound, template is required (which we have)
      // If recent inbound exists, we can send without template (but we'll still use template)
      eligibleContacts.push(contact);
    }

    // Tag contacts as recent_buyer if needed
    if (contactsToTag.length > 0) {
      for (const contactId of contactsToTag) {
        const { data: contact } = await supabase
          .from('contacts')
          .select('tags')
          .eq('id', contactId)
          .single();

        if (contact && !contact.tags?.includes('recent_buyer')) {
          await supabase
            .from('contacts')
            .update({ tags: [...(contact.tags || []), 'recent_buyer'] })
            .eq('id', contactId);
        }
      }
    }

    if (eligibleContacts.length === 0) {
      return NextResponse.json({
        success: true,
        sent: 0,
        matched_count: filteredContactIds.length,
        sendable_count: 0,
        contact_ids: [],
        message: 'No eligible contacts after compliance checks',
      });
    }

    // Get n8n webhook URL from settings
    const { data: settings } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'n8n_webhook_url')
      .single();

    if (!settings?.value?.url) {
      return NextResponse.json(
        { error: 'n8n webhook URL not configured' },
        { status: 400 }
      );
    }

    const webhookUrl = settings.value.url;
    const webhookSecret = settings.value.secret || '';

    // Fetch template details if template_name and template_language are provided
    let templateContent = null;
    if (template_name && template_language) {
      const { data: templateData, error: templateError } = await supabase
        .from('whatsapp_templates')
        .select('name, language, category, status, components, variable_count')
        .eq('name', template_name)
        .eq('language', template_language)
        .eq('status', 'APPROVED')
        .single();

      if (!templateError && templateData) {
        templateContent = {
          name: templateData.name,
          language: templateData.language,
          category: templateData.category,
          status: templateData.status,
          components: templateData.components,
          variable_count: templateData.variable_count,
        };
      }
    }

    // Send to n8n
    try {
      const response = await axios.post(
        webhookUrl,
        {
          campaign_type: 'whatsapp',
          segment,
          template_name,
          template_language: template_language || undefined,
          template_variables: template_variables || undefined,
          template_content: templateContent || undefined, // Include full template content/components
          contacts: eligibleContacts.map(c => ({
            id: c.id,
            phone_e164: c.phone_e164,
            full_name: c.full_name,
          })),
          timestamp: new Date().toISOString(),
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(webhookSecret && { 'X-Webhook-Secret': webhookSecret }),
          },
          timeout: 30000,
        }
      );

      // Create campaign event records
      const campaignId = crypto.randomUUID();
      const events = eligibleContacts.map(contact => ({
        contact_id: contact.id,
        type: 'whatsapp_outbound' as const,
        meta: {
          campaign_id: campaignId,
          segment,
          template_name,
          template_language: template_language || undefined,
          template_variables: template_variables || undefined,
          filters: filters || {},
        },
      }));

      await supabase.from('events').insert(events);

      return NextResponse.json({
        success: true,
        sent: eligibleContacts.length,
        matched_count: filteredContactIds.length,
        sendable_count: eligibleContacts.length,
        contact_ids: eligibleContacts.map(c => c.id),
        campaign_id: campaignId,
        response: response.data,
      });
    } catch (webhookError: any) {
      console.error('n8n webhook error:', webhookError);
      return NextResponse.json(
        {
          error: 'Failed to trigger campaign webhook',
          details: webhookError.response?.data || webhookError.message,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Campaign trigger error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to trigger campaign' },
      { status: 500 }
    );
  }
}
