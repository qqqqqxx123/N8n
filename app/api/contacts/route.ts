import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { normalizePhoneToE164 } from '@/lib/utils/phone';
import { normalizeDOB } from '@/lib/utils/dob';

const CreateContactSchema = z.object({
  phone_e164: z.string(),
  full_name: z.string().optional(),
  source: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = CreateContactSchema.parse(body);

    const supabase = createClient();

    // Normalize phone number
    const normalizedPhone = normalizePhoneToE164(validated.phone_e164);
    if (!normalizedPhone) {
      return NextResponse.json(
        { error: 'Invalid phone number format' },
        { status: 400 }
      );
    }

    // Check if contact already exists
    const { data: existing } = await supabase
      .from('contacts')
      .select('id')
      .eq('phone_e164', normalizedPhone)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'Contact already exists', contact: existing },
        { status: 409 }
      );
    }

    // Create new contact
    const { data: contact, error } = await supabase
      .from('contacts')
      .insert({
        phone_e164: normalizedPhone,
        full_name: validated.full_name || null,
        source: validated.source || 'manual_add',
        tags: validated.tags || [],
        opt_in_status: true, // Assume opt-in when manually added
        opt_in_timestamp: new Date().toISOString(),
        opt_in_source: 'manual_add',
      })
      .select()
      .single();

    if (error || !contact) {
      console.error('Contact creation error:', error);
      return NextResponse.json(
        { error: error?.message || 'Failed to create contact' },
        { status: 500 }
      );
    }

    // Link existing messages to this contact
    await supabase
      .from('messages')
      .update({ contact_id: contact.id })
      .eq('phone_e164', normalizedPhone)
      .is('contact_id', null);

    return NextResponse.json({ contact });
  } catch (error) {
    console.error('Create contact error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create contact' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const segment = searchParams.get('segment');
    const search = searchParams.get('search');
    const source = searchParams.get('source');

    const supabase = createClient();

    // Get limit from query params (default: 100, max: 1000)
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 1000) : 100;

    // Build contacts query
    let contactsQuery = supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Filter by segment if provided
    if (segment && segment !== 'all') {
      const { data: scores } = await supabase
        .from('scores')
        .select('contact_id')
        .eq('segment', segment);

      if (scores && scores.length > 0) {
        const contactIds = scores.map(s => s.contact_id);
        contactsQuery = contactsQuery.in('id', contactIds);
      } else {
        // No contacts in this segment
        return NextResponse.json({
          contacts: [],
          sources: [],
        });
      }
    }

    // Apply search filter
    if (search) {
      const searchPattern = `%${search}%`;
      // Supabase or() syntax: column.operator.value,column.operator.value
      // For ilike, the pattern should be URL encoded
      const encodedPattern = encodeURIComponent(searchPattern);
      contactsQuery = contactsQuery.or(`full_name.ilike.${encodedPattern},phone_e164.ilike.${encodedPattern}`);
    }

    // Apply source filter
    if (source) {
      contactsQuery = contactsQuery.eq('source', source);
    }

    const { data: contacts, error: contactsError } = await contactsQuery;

    if (contactsError) {
      console.error('Contacts query error:', contactsError);
      console.error('Query params:', { segment, search, source });
      return NextResponse.json(
        { error: 'Failed to fetch contacts', details: contactsError.message },
        { status: 500 }
      );
    }

    // Fetch scores for all contacts
    const contactIds = (contacts || []).map(c => c.id);
    let scoresMap = new Map<string, { score: number; segment: string }>();
    
    if (contactIds.length > 0) {
      const { data: scores } = await supabase
        .from('scores')
        .select('contact_id, score, segment')
        .in('contact_id', contactIds);

      if (scores) {
        scores.forEach(s => {
          scoresMap.set(s.contact_id, { score: s.score, segment: s.segment });
        });
      }
    }

    // Attach scores to contacts
    const contactsWithScores = (contacts || []).map(contact => ({
      ...contact,
      score: scoresMap.get(contact.id)?.score ?? null,
      segment: scoresMap.get(contact.id)?.segment ?? null,
    }));

    // Get unique sources
    const { data: allContacts } = await supabase
      .from('contacts')
      .select('source')
      .not('source', 'is', null);

    const sources = Array.from(
      new Set((allContacts || []).map(c => c.source).filter(Boolean))
    ) as string[];

    return NextResponse.json({
      contacts: contactsWithScores,
      sources,
    });
  } catch (error) {
    console.error('Contacts fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch contacts' },
      { status: 500 }
    );
  }
}




