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

  // Vercel is HTTPS — Auth.js sets `__Secure-authjs.session-token`.
  // getToken defaults secureCookie=false → looks for the wrong cookie name →
  // post-Microsoft login always appears logged out and bounces to /auth/signin.
  const secureCookie =
    request.nextUrl.protocol === "https:" ||
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1";

  const token = await getToken({
    req: request,
    secret: resolveAuthSecret(),
    secureCookie,
  });

  if (!token) {
    console.log(
      "[SmartCRM AuthTrace]",
      JSON.stringify({
        step: "middleware.no_token",
        pathname,
        secureCookie,
        cookieNames: request.cookies
          .getAll()
          .map((c) => c.name)
          .filter((n) => /auth|session/i.test(n)),
      }),
    );
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
    "/((?!api/auth|api/azure-start|auth/signin|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
