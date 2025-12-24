import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Get unique sources
    const { data: allContacts } = await supabase
      .from('contacts')
      .select('source')
      .not('source', 'is', null);

    const sources = Array.from(
      new Set((allContacts || []).map(c => c.source).filter(Boolean))
    ) as string[];

    return NextResponse.json({
      contacts: contacts || [],
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




