import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';

export async function getSession() {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get('session_token')?.value;

  if (!sessionToken) {
    return null;
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
    return null;
  }

  // Get user information
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, username, full_name, email')
    .eq('id', session.user_id)
    .single();

  if (userError || !user) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    email: user.email,
  };
}

export async function requireAuth() {
  const session = await getSession();
  
  if (!session) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  return { session };
}

