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

  if (!sessionToken) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
