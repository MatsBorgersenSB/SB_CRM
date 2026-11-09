import { NextResponse, type NextRequest } from "next/server";
import { signIn } from "@/lib/auth";
import { authTrace } from "@/lib/auth-debug";
import { isSecureAuthCookies } from "@/lib/outlook-dialog-bridge";
import {
  SMARTCRM_PRODUCTION_ORIGIN,
  isNonCanonicalVercelHost,
} from "@/lib/smartcrm-origin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function normalizeCallbackUrl(rawCallbackUrl: string | null, requestOrigin: string): string {
  const fallback = "/";
  const value = rawCallbackUrl?.trim();
  if (!value) return fallback;
  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  try {
    const requestBase = new URL(requestOrigin);
    const absolute = new URL(value, requestBase.origin);
    if (absolute.origin !== requestBase.origin) {
      return fallback;
    }
    const path = `${absolute.pathname}${absolute.search}${absolute.hash}`;
    return path || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Server-side Azure AD sign-in start (outside /api/auth catch-all).
 *
 * Always returns an HTML document that navigates to Microsoft.
 * A raw 307 is fine for <a href>, but Next.js Link prefetch / fetch()
 * following that 307 to login.microsoftonline.com causes CORS errors.
 */
export async function GET(req: NextRequest) {
  const callbackUrl = normalizeCallbackUrl(
    req.nextUrl.searchParams.get("callbackUrl"),
    req.nextUrl.origin,
  );
  authTrace("azure-start.get", {
    callbackUrl,
    host: req.headers.get("host"),
    path: req.nextUrl.pathname,
    secFetchMode: req.headers.get("sec-fetch-mode"),
  });

  if (isNonCanonicalVercelHost(req.nextUrl.hostname)) {
    const canonicalStart = new URL("/api/azure-start", SMARTCRM_PRODUCTION_ORIGIN);
    canonicalStart.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(canonicalStart);
  }

  try {
    const url = await signIn("azure-ad", {
      redirectTo: callbackUrl,
      redirect: false,
    });

    if (!url || typeof url !== "string") {
      throw new Error("signIn returned empty redirect URL");
    }

    // Ensure the callback-url cookie is written on the same origin that will
    // receive Microsoft's /api/auth/callback/azure-ad redirect.
    let oauthCallbackOrigin = req.nextUrl.origin;
    try {
      const authorizeUrl = new URL(url);
      const redirectUri = authorizeUrl.searchParams.get("redirect_uri");
      if (redirectUri) {
        oauthCallbackOrigin = new URL(redirectUri).origin;
      }
    } catch {
      /* keep req.nextUrl.origin */
    }

    if (oauthCallbackOrigin !== req.nextUrl.origin) {
      const canonicalStart = new URL("/api/azure-start", oauthCallbackOrigin);
      canonicalStart.searchParams.set("callbackUrl", callbackUrl);
      return NextResponse.redirect(canonicalStart);
    }

    authTrace("azure-start.redirect", {
      callbackUrl,
      to: url.startsWith("https://login.microsoftonline.com")
        ? "login.microsoftonline.com"
        : url.slice(0, 120),
    });

    const safeUrl = escapeHtmlAttr(url);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta http-equiv="refresh" content="0;url=${safeUrl}"/>
  <title>Redirecting to Microsoft…</title>
  <script>window.location.replace(${JSON.stringify(url)});</script>
</head>
<body style="font-family:system-ui;background:#0b1c2c;color:#fff;display:flex;min-height:100vh;align-items:center;justify-content:center">
  <p>Redirecting to Microsoft sign-in… <a href="${safeUrl}" style="color:#e65125">Continue</a></p>
</body>
</html>`;

    const response = new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });

    const secure = isSecureAuthCookies();
    const callbackCookieName = secure
      ? "__Secure-authjs.callback-url"
      : "authjs.callback-url";
    const absoluteCallbackUrl = new URL(callbackUrl, req.nextUrl.origin).toString();
    response.cookies.set(callbackCookieName, absoluteCallbackUrl, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure,
      maxAge: 60 * 10,
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    authTrace("azure-start.error", { message, callbackUrl });
    console.error("[NextAuth] azure-start failed:", message, error);

    const signInUrl = new URL("/auth/signin", req.nextUrl.origin);
    signInUrl.searchParams.set("error", "OAuthSignin");
    signInUrl.searchParams.set("callbackUrl", callbackUrl);
    return NextResponse.redirect(signInUrl);
  }
}
