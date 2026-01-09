import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ user: null });
    }

    const supabase = createClient();

    // Find session
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, user_id, expires_at')
      .eq('session_token', sessionToken)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (sessionError || !session) {
      // Invalid or expired session, clear cookie
      cookieStore.delete('session_token');
      return NextResponse.json({ user: null });
    }

    // Get user information
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id, username, full_name, email')
      .eq('id', session.user_id)
      .single();

    if (userError || !user) {
      // User not found, clear session
      cookieStore.delete('session_token');
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Session check error:', error);
    return NextResponse.json({ user: null });
  }
}

