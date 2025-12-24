import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = createClient();

    const { data: settings } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'whatsapp_templates')
      .single();

    return NextResponse.json({
      templates: settings?.value || [],
    });
  } catch (error) {
    console.error('Templates fetch error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch templates' },
      { status: 500 }
    );
  }
}






