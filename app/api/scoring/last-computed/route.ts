import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createClient();

    // Get the most recent computed_at timestamp from scores table
    const { data, error } = await supabase
      .from('scores')
      .select('computed_at')
      .order('computed_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 is "no rows returned", which is fine
      console.error('Error fetching last computed time:', error);
      return NextResponse.json(
        { error: 'Failed to fetch last computed time', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      last_computed_at: data?.computed_at || null,
    });
  } catch (error) {
    console.error('Error in last-computed endpoint:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch last computed time' },
      { status: 500 }
    );
  }
}



