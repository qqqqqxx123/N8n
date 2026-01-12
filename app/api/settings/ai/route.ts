import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createClient();
    
    const { data: aiSetting, error } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'ai_enabled')
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error fetching AI setting:', error);
      return NextResponse.json(
        { error: 'Failed to fetch AI setting' },
        { status: 500 }
      );
    }

    // Default to false if not set
    const aiEnabled = aiSetting?.value?.enabled || false;

    return NextResponse.json({ ai_enabled: aiEnabled });
  } catch (error) {
    console.error('AI setting fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch AI setting' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { ai_enabled } = await request.json();

    if (typeof ai_enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'ai_enabled must be a boolean' },
        { status: 400 }
      );
    }

    const supabase = createClient();

    await supabase
      .from('settings')
      .upsert({
        key: 'ai_enabled',
        value: { enabled: ai_enabled },
        updated_at: new Date().toISOString(),
      });

    return NextResponse.json({ success: true, ai_enabled });
  } catch (error) {
    console.error('AI setting save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save AI setting' },
      { status: 500 }
    );
  }
}

