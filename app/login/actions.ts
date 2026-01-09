'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function loginAction(formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  if (!username || !password) {
    redirect('/login?error=' + encodeURIComponent('Username and password are required'));
  }

  const supabase = createClient();

  // Treat username field as email
  const { data, error } = await supabase.auth.signInWithPassword({
    email: username,
    password: password,
  });

  if (error) {
    // Redirect back with error message
    redirect('/login?error=' + encodeURIComponent(error.message || 'Invalid email or password'));
  }

  if (!data.user || !data.session) {
    redirect('/login?error=' + encodeURIComponent('Login failed. Please try again.'));
  }

  // Redirect to home page on success
  redirect('/');
}

