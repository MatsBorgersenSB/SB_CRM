import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { resolveAuthSecret } from "@/lib/auth-env";

/**
 * Strict auth guard for application pages.
 * NextAuth (`/api/auth/*`) and the sign-in page are excluded via `matcher`
 * so middleware never redirects/intercepts the OAuth callback.
 *
 * Outlook task panes load without a session so they can render a Sign-in CTA
 * (Office Dialog SSO). Unauthenticated `/api/*` returns JSON 401 — never an
 * HTML redirect — so fetch() in the add-in can detect auth state cleanly.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);

  // Ghost CRA /static/js chunks (not shipped by this Next app). Never redirect them
  // to HTML /auth/signin — that produces script SyntaxErrors and confusing stacks.
  if (pathname.startsWith("/static/")) {
    return new NextResponse(
      "Gone: SmartCRM no longer serves CRA /static assets. Use /outlook-addin.",
      {
        status: 410,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  if (
    pathname.startsWith("/api/cron") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/azure-start") ||
    // Dialog bridge claim runs in the task-pane iframe before a session cookie exists.
    pathname.startsWith("/api/outlook/dialog-bridge") ||
    pathname.startsWith("/auth/signin") ||
    pathname.startsWith("/outlook-addin") ||
    pathname.startsWith("/outlook/") ||
    pathname.startsWith("/teams/")
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

    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized", code: "AUTH_REQUIRED" },
        { status: 401 },
      );
    }

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
    "/((?!api/auth|api/azure-start|api/outlook/dialog-bridge|auth/signin|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
