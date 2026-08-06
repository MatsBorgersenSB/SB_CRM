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

  // Defense-in-depth for machine/public API routes that may still match.
  if (
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/azure-start") ||
    pathname.startsWith("/auth/signin")
  ) {
    return NextResponse.next();
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

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - api/auth (NextAuth API routes / OAuth callback)
     * - auth/signin (Login page)
     * - _next/static, _next/image, favicon.ico (Static assets)
     * - common image extensions
     */
    "/((?!api/auth|api/azure-start|auth/signin|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
