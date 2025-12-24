import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { applyCampaignFilters } from '@/lib/campaign-filters';

const FilteredContactsSchema = z.object({
  segment: z.enum(['hot', 'warm', 'cold']),
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
    const { segment, filters = {} } = FilteredContactsSchema.parse(body);

    const supabase = createClient();

    // Apply filters to get matching contact IDs
    const filteredContactIds = await applyCampaignFilters(segment, filters);

    if (filteredContactIds.length === 0) {
      return NextResponse.json({
        contacts: [],
      });
    }

    // Fetch full contact details
    const { data: contacts, error: contactsError } = await supabase
      .from('contacts')
      .select('*')
      .in('id', filteredContactIds)
      .order('created_at', { ascending: false });

    if (contactsError) {
      return NextResponse.json(
        { error: 'Failed to fetch contacts' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      contacts: contacts || [],
    });
  } catch (error) {
    console.error('Filtered contacts error:', error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch filtered contacts' },
      { status: 500 }
    );
  }
}



