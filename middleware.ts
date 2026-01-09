import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get('session_token')?.value;

  // Allow access to login page and API auth routes (including create-user for initial setup)
  if (pathname === '/login' || pathname.startsWith('/api/auth/')) {
    // If already logged in, redirect from login page to home
    if (pathname === '/login' && sessionToken) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // Allow webhook endpoints (they use API keys, not sessions)
  if (pathname.startsWith('/api/whatsapp/webhook') || 
      pathname.startsWith('/api/whatsapp/outbound') ||
      pathname.startsWith('/api/webhooks/') ||
      pathname.startsWith('/api/n8n/')) {
    return NextResponse.next();
  }

  // Protect all other routes - require authentication
  if (!sessionToken) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};

