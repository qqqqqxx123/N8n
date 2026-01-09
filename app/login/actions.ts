'use server';

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

export async function loginAction(formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    redirect('/login?error=' + encodeURIComponent('Username and password are required'));
  }

  const supabase = createClient();

  // Find user by username in custom users table
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id, username, password_hash, full_name, email')
    .eq('username', username)
    .single();

  if (userError || !user) {
    console.error('User lookup error:', userError);
    redirect('/login?error=' + encodeURIComponent('Invalid username or password'));
  }

  // Verify password using bcrypt
  const isValidPassword = await bcrypt.compare(password, user.password_hash);

  if (!isValidPassword) {
    console.error('Password verification failed for user:', username);
    redirect('/login?error=' + encodeURIComponent('Invalid username or password'));
  }

  // Generate session token
  const sessionToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30); // 30 days session

  // Create session in database
  const { error: sessionError } = await supabase
    .from('sessions')
    .insert({
      user_id: user.id,
      session_token: sessionToken,
      expires_at: expiresAt.toISOString(),
    });

  if (sessionError) {
    console.error('Error creating session:', sessionError);
    redirect('/login?error=' + encodeURIComponent('Failed to create session: ' + sessionError.message));
  }

  // Set cookie with session token using Supabase SSR cookie handling
  // Only use secure cookies if actually using HTTPS (not just production mode)
  const cookieStore = cookies();
  const useSecureCookies = process.env.USE_SECURE_COOKIES === 'true' || 
    (process.env.NODE_ENV === 'production' && process.env.NEXT_PUBLIC_APP_URL?.startsWith('https://'));
  
  cookieStore.set('session_token', sessionToken, {
    httpOnly: true,
    secure: useSecureCookies,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: '/',
  });

  // Redirect to home page on success
  // Note: redirect() throws a NEXT_REDIRECT error which is expected behavior
  redirect('/');
}

