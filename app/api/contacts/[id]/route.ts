import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { normalizeDOB } from '@/lib/utils/dob';

const UpdateContactSchema = z.object({
  full_name: z.string().optional(),
  phone_e164: z.string().optional(),
  tags: z.array(z.string()).optional(),
  total_spend: z.number().optional(),
  DOB: z.string().optional().nullable(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    const { data: contact, error } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ contact });
  } catch (error) {
    console.error('Contact fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch contact' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const body = await request.json();
    const validated = UpdateContactSchema.parse(body);

    // Build update object
    const updateData: Record<string, any> = {};
    
    if (validated.full_name !== undefined) {
      updateData.full_name = validated.full_name;
    }
    
    if (validated.phone_e164 !== undefined) {
      updateData.phone_e164 = validated.phone_e164;
    }
    
    if (validated.tags !== undefined) {
      updateData.tags = validated.tags;
    }
    
    if (validated.total_spend !== undefined) {
      updateData.total_spend = validated.total_spend;
    }
    
    if (validated.DOB !== undefined) {
      // Normalize DOB to YYYY-MM-DD format
      updateData.DOB = validated.DOB ? normalizeDOB(validated.DOB) : null;
    }

    const { data: contact, error } = await supabase
      .from('contacts')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Contact update error:', error);
      return NextResponse.json(
        { error: error.message || 'Failed to update contact' },
        { status: 500 }
      );
    }

    if (!contact) {
      return NextResponse.json(
        { error: 'Contact not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ contact });
  } catch (error) {
    console.error('Contact update error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update contact' },
      { status: 500 }
    );
  }
}






