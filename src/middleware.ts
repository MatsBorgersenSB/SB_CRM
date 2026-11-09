import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decode, getToken } from "next-auth/jwt";
import { resolveAuthSecret } from "@/lib/auth-env";
import {
  OUTLOOK_SESSION_HEADER,
  sessionCookieName,
} from "@/lib/outlook-dialog-bridge";
import {
  SMARTCRM_PRODUCTION_ORIGIN,
  isNonCanonicalVercelHost,
} from "@/lib/smartcrm-origin";
import { applyTrustedRoleHeader } from "@/lib/security/trusted-role-header";

function appendOutlookSessionCookies(headers: Headers, sessionToken: string): void {
  const clean = sessionToken.trim();
  if (!clean) return;
  const existing = headers.get("cookie")?.trim() || "";
  if (
    existing.includes("__Secure-authjs.session-token=") ||
    existing.includes("authjs.session-token=")
  ) {
    return;
  }
  const appended = `__Secure-authjs.session-token=${clean}; authjs.session-token=${clean}`;
  headers.set("cookie", existing ? `${existing}; ${appended}` : appended);
}

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
  // Never trust a client-supplied role; it is re-derived from the session below.
  applyTrustedRoleHeader(requestHeaders, undefined);

  const outlookHeaderToken = request.headers.get(OUTLOOK_SESSION_HEADER)?.trim() || "";
  if (outlookHeaderToken) {
    appendOutlookSessionCookies(requestHeaders, outlookHeaderToken);
  }

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
    pathname.startsWith("/api/m365/graph-webhook") ||
    pathname.startsWith("/api/health") ||
    // Inngest calls are machine-to-machine (verified by INNGEST_SIGNING_KEY).
    pathname.startsWith("/api/inngest") ||
    // Sentry tunnel (next.config.ts `tunnelRoute`) — browser events carry no session.
    pathname.startsWith("/monitoring") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/azure-start") ||
    // Dialog bridge claim runs in the task-pane iframe before a session cookie exists.
    pathname.startsWith("/api/outlook/dialog-bridge") ||
    pathname.startsWith("/auth/signin") ||
    pathname.startsWith("/outlook-addin") ||
    pathname.startsWith("/outlook/") ||
    pathname.startsWith("/teams/") ||
    pathname.startsWith("/meet/") ||
    pathname.startsWith("/api/public/meeting-slots")
  ) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  // Redirect per-deployment *.vercel.app URLs (e.g. Vercel "Visit" button) to the
  // canonical host before auth checks so cookies and OAuth callbacks share one origin.
  if (
    !pathname.startsWith("/api/") &&
    (request.method === "GET" || request.method === "HEAD") &&
    isNonCanonicalVercelHost(request.nextUrl.hostname)
  ) {
    const canonicalUrl = new URL(
      `${pathname}${request.nextUrl.search}`,
      SMARTCRM_PRODUCTION_ORIGIN,
    );
    return NextResponse.redirect(canonicalUrl);
  }

  // Vercel is HTTPS — Auth.js sets `__Secure-authjs.session-token`.
  // getToken defaults secureCookie=false → looks for the wrong cookie name →
  // post-Microsoft login always appears logged out and bounces to /auth/signin.
  const secureCookie =
    request.nextUrl.protocol === "https:" ||
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1";

  const secret = resolveAuthSecret();
  let token = await getToken({
    req: request,
    secret,
    secureCookie,
  });

  if (!token && outlookHeaderToken) {
    token =
      (await decode({
        token: outlookHeaderToken,
        secret,
        salt: sessionCookieName(secureCookie),
      }).catch(() => null)) ??
      (await decode({
        token: outlookHeaderToken,
        secret,
        salt: sessionCookieName(!secureCookie),
      }).catch(() => null));
  }

  if (!token) {
    if (process.env.AUTH_TRACE === "1") console.log(
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

  // Same fallback as the session callback in lib/auth.ts.
  applyTrustedRoleHeader(requestHeaders, token.accessRole ?? "commercial");

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: [
    "/((?!api/auth|api/inngest|monitoring|api/azure-start|api/outlook/dialog-bridge|auth/signin|_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
