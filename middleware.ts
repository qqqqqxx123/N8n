import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ✅ Allow Next internals + public files + auth pages
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname === "/login" ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  ) {
    return NextResponse.next();
  }

  // ✅ If you serve files from /public (e.g. /test.txt, /images/...)
  // allow common static extensions:
  if (/\.(.*)$/.test(pathname)) {
    return NextResponse.next();
  }

  // --- your auth logic below ---
  // Check for session_token cookie (set by login action)
  const sessionToken = request.cookies.get("session_token")?.value;

  // Debug logging (remove in production)
  if (process.env.NODE_ENV === 'development') {
    const allCookies = request.cookies.getAll();
    console.log('[Middleware] Path:', pathname);
    console.log('[Middleware] All cookies:', allCookies.map(c => c.name));
    console.log('[Middleware] Has session_token:', !!sessionToken);
    if (sessionToken) {
      console.log('[Middleware] Session token length:', sessionToken.length);
    }
  }

  if (!sessionToken) {
    // Redirect to login, but preserve the intended destination
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    // Don't clear search params - we might want to redirect back after login
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
