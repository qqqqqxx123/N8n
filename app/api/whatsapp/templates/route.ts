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
    const isCustom = searchParams.get('is_custom');

    // Build query
    let query = supabase
      .from('whatsapp_templates')
      .select('*')
      .order('name', { ascending: true })
      .order('language', { ascending: true });

    // Only filter by status if not filtering by is_custom (custom templates might have different status)
    if (isCustom === null || isCustom === undefined) {
      query = query.eq('status', status);
    }

    if (category) {
      query = query.eq('category', category);
    }

    if (language) {
      query = query.eq('language', language);
    }

    if (isCustom !== null && isCustom !== undefined) {
      query = query.eq('is_custom', isCustom === 'true');
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

/**
 * POST /api/whatsapp/templates
 * Create a new custom WhatsApp template
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const body = await request.json();

    const { name, language, category, status, components, variable_count, is_custom } = body;

    if (!name || !language) {
      return NextResponse.json(
        { error: 'Name and language are required' },
        { status: 400 }
      );
    }

    if (!components || !Array.isArray(components) || components.length === 0) {
      return NextResponse.json(
        { error: 'At least one component is required' },
        { status: 400 }
      );
    }

    // For custom templates, waba_id is optional
    const templateData: any = {
      name,
      language,
      category: category || 'MARKETING',
      status: status || 'APPROVED',
      components,
      variable_count: variable_count || 0,
      is_custom: is_custom !== undefined ? is_custom : true,
    };

    // Only set waba_id if provided (for Meta templates)
    if (body.waba_id) {
      templateData.waba_id = body.waba_id;
    }

    // Include image1-image8 fields if provided
    if (body.image1 !== undefined) templateData.image1 = body.image1;
    if (body.image2 !== undefined) templateData.image2 = body.image2;
    if (body.image3 !== undefined) templateData.image3 = body.image3;
    if (body.image4 !== undefined) templateData.image4 = body.image4;
    if (body.image5 !== undefined) templateData.image5 = body.image5;
    if (body.image6 !== undefined) templateData.image6 = body.image6;
    if (body.image7 !== undefined) templateData.image7 = body.image7;
    if (body.image8 !== undefined) templateData.image8 = body.image8;

    // Include button1-button2 fields if provided
    if (body.button1_text !== undefined) templateData.button1_text = body.button1_text;
    if (body.button1_type !== undefined) templateData.button1_type = body.button1_type;
    if (body.button1_url !== undefined) templateData.button1_url = body.button1_url;
    if (body.button1_phone !== undefined) templateData.button1_phone = body.button1_phone;
    if (body.button2_text !== undefined) templateData.button2_text = body.button2_text;
    if (body.button2_type !== undefined) templateData.button2_type = body.button2_type;
    if (body.button2_url !== undefined) templateData.button2_url = body.button2_url;
    if (body.button2_phone !== undefined) templateData.button2_phone = body.button2_phone;

    const { data: template, error } = await supabase
      .from('whatsapp_templates')
      .insert(templateData)
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Template with this name and language already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: error.message || 'Failed to create template' },
        { status: 500 }
      );
    }

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Template creation error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to create template',
      },
      { status: 500 }
    );
  }
}

