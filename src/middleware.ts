import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { resolveAuthSecret } from "@/lib/auth-env";

/**
 * Strict auth guard for application pages.
 * NextAuth (`/api/auth/*`) and the sign-in page are excluded via `matcher`
 * so middleware never redirects/intercepts the OAuth callback.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  // Defense-in-depth for machine/public API routes that may still match.
  if (
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/azure-start") ||
    pathname.startsWith("/auth/signin")
  ) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  const token = await getToken({
    req: request,
    secret: resolveAuthSecret(),
  });

  if (!token) {
    const signInUrl = new URL("/auth/signin", request.nextUrl.origin);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api/auth / api/azure-start / auth/signin
     * - static assets
     *
     * NOTE: auth/signin is excluded from matcher, so x-pathname is not set there.
     * Root layout detects /auth via the URL fallback below is not available —
     * use a dedicated auth layout without SessionProvider instead.
     */
    "/((?!api/auth|api/azure-start|auth/signin|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
