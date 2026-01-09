import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/whatsapp/templates/[id]
 * Get a single template by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { id } = params;

    const { data: template, error } = await supabase
      .from('whatsapp_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Template fetch error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch template',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/whatsapp/templates/[id]
 * Update a template
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { id } = params;
    const body = await request.json();

    const { name, language, category, status, components, variable_count } = body;

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

    const updateData: any = {
      name,
      language,
      category: category || 'MARKETING',
      status: status || 'APPROVED',
      components,
      variable_count: variable_count || 0,
      updated_at: new Date().toISOString(),
    };

    // Include image1-image8 fields if provided
    if (body.image1 !== undefined) updateData.image1 = body.image1;
    if (body.image2 !== undefined) updateData.image2 = body.image2;
    if (body.image3 !== undefined) updateData.image3 = body.image3;
    if (body.image4 !== undefined) updateData.image4 = body.image4;
    if (body.image5 !== undefined) updateData.image5 = body.image5;
    if (body.image6 !== undefined) updateData.image6 = body.image6;
    if (body.image7 !== undefined) updateData.image7 = body.image7;
    if (body.image8 !== undefined) updateData.image8 = body.image8;

    // Include button1-button2 fields if provided
    if (body.button1_text !== undefined) updateData.button1_text = body.button1_text;
    if (body.button1_type !== undefined) updateData.button1_type = body.button1_type;
    if (body.button1_url !== undefined) updateData.button1_url = body.button1_url;
    if (body.button1_phone !== undefined) updateData.button1_phone = body.button1_phone;
    if (body.button2_text !== undefined) updateData.button2_text = body.button2_text;
    if (body.button2_type !== undefined) updateData.button2_type = body.button2_type;
    if (body.button2_url !== undefined) updateData.button2_url = body.button2_url;
    if (body.button2_phone !== undefined) updateData.button2_phone = body.button2_phone;

    const { data: template, error } = await supabase
      .from('whatsapp_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating template:', error);
      if (error.code === '23505') {
        return NextResponse.json(
          { error: 'Template with this name and language already exists' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: error.message || 'Failed to update template' },
        { status: 500 }
      );
    }

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Template update error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to update template',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/whatsapp/templates/[id]
 * Delete a template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { id } = params;

    // Check if template exists and is custom (don't allow deleting Meta templates)
    const { data: template, error: fetchError } = await supabase
      .from('whatsapp_templates')
      .select('is_custom')
      .eq('id', id)
      .single();

    if (fetchError || !template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    if (!template.is_custom) {
      return NextResponse.json(
        { error: 'Cannot delete Meta templates. Only custom templates can be deleted.' },
        { status: 403 }
      );
    }

    const { error } = await supabase
      .from('whatsapp_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting template:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to delete template' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Template deletion error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to delete template',
      },
      { status: 500 }
    );
  }
}


