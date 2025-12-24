import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/whatsapp/templates
 * Fetches WhatsApp templates from database
 * Query params:
 *   - category: Filter by category (optional)
 *   - language: Filter by language (optional)
 *   - status: Filter by status (default: APPROVED)
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const searchParams = request.nextUrl.searchParams;
    
    const category = searchParams.get('category');
    const language = searchParams.get('language');
    const status = searchParams.get('status') || 'APPROVED';

    // Build query
    let query = supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('status', status)
      .order('name', { ascending: true })
      .order('language', { ascending: true });

    if (category) {
      query = query.eq('category', category);
    }

    if (language) {
      query = query.eq('language', language);
    }

    const { data: templates, error } = await query;

    if (error) {
      console.error('Error fetching templates:', error);
      return NextResponse.json(
        { error: 'Failed to fetch templates' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      templates: templates || [],
    });
  } catch (error) {
    console.error('Templates fetch error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch templates',
      },
      { status: 500 }
    );
  }
}

