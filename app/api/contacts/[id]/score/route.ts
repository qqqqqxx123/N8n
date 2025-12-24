import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();

    const { data: score, error } = await supabase
      .from('scores')
      .select('*')
      .eq('contact_id', params.id)
      .single();

    if (error || !score) {
      return NextResponse.json(
        { score: null },
        { status: 200 }
      );
    }

    return NextResponse.json({ score });
  } catch (error) {
    console.error('Score fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch score' },
      { status: 500 }
    );
  }
}






