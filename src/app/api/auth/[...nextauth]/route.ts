import { NextResponse, type NextRequest } from "next/server";
import { handlers } from "@/lib/auth";
import { authTrace } from "@/lib/auth-debug";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function summarizeAuthRequest(req: NextRequest) {
  const url = req.nextUrl;
  const path = url.pathname;
  const action = path.replace(/^\/api\/auth\/?/, "") || "(root)";
  return {
    method: req.method,
    action,
    path,
    host: req.headers.get("host"),
    xForwardedHost: req.headers.get("x-forwarded-host"),
    xForwardedProto: req.headers.get("x-forwarded-proto"),
    hasCode: url.searchParams.has("code"),
    hasState: url.searchParams.has("state"),
    hasError: url.searchParams.has("error"),
    oauthError: url.searchParams.get("error"),
    oauthErrorDescription: url.searchParams.get("error_description"),
    secFetchMode: req.headers.get("sec-fetch-mode"),
    secFetchDest: req.headers.get("sec-fetch-dest"),
    cookieNames: req.cookies
      .getAll()
      .map((c) => c.name)
      .filter((n) => /auth|csrf|session|pkce|state/i.test(n)),
  };
}

function summarizeResponse(res: Response) {
  const location = res.headers.get("location");
  const setCookie = res.headers.getSetCookie?.() ?? [];
  return {
    status: res.status,
    location,
    setCookieNames: setCookie.map((c) => c.split("=")[0] ?? c).slice(0, 12),
    contentType: res.headers.get("content-type"),
  };
}

/** Browser document navigation (click / address bar) — keep HTTP redirects. */
function isDocumentNavigation(req: NextRequest): boolean {
  const dest = req.headers.get("sec-fetch-dest");
  const mode = req.headers.get("sec-fetch-mode");
  const accept = req.headers.get("accept") ?? "";
  if (dest === "document") return true;
  if (mode === "navigate") return true;
  if (accept.includes("text/html") && mode !== "cors") return true;
  return false;
}

/**
 * Wrap Auth.js handlers:
 * - Trace steps for Vercel logs
 * - Never let fetch/XHR follow a 302 to login.microsoftonline.com (CORS failure)
 * - Convert those redirects to JSON { url } so clients can window.location.assign
 */
async function safeAuth(method: "GET" | "POST", req: NextRequest) {
  const summary = summarizeAuthRequest(req);
  authTrace(`route.${method}.start`, summary);

  const path = req.nextUrl.pathname.replace(/\/$/, "");
  const documentNav = isDocumentNavigation(req);

  // Keep users on our branded page, not /api/auth/signin
  if (
    documentNav &&
    method === "GET" &&
    (path === "/api/auth/signin" || path === "/api/auth/error")
  ) {
    const dest = new URL("/auth/signin", req.nextUrl.origin);
    const callbackUrl = req.nextUrl.searchParams.get("callbackUrl");
    const error = req.nextUrl.searchParams.get("error");
    if (callbackUrl) dest.searchParams.set("callbackUrl", callbackUrl);
    if (error) dest.searchParams.set("error", error);
    authTrace("route.force_branded_signin", { from: path, to: dest.toString() });
    return NextResponse.redirect(dest);
  }

  try {
    // Ask Auth.js for JSON redirect payloads on non-document requests.
    const headers = new Headers(req.headers);
    if (!documentNav) {
      headers.set("X-Auth-Return-Redirect", "1");
    }

    const forwarded = new NextRequest(req.url, {
      method: req.method,
      headers,
      body: method === "POST" ? await req.blob() : undefined,
    });

    const res = await handlers[method](forwarded);
    const out = summarizeResponse(res);
    authTrace(`route.${method}.done`, { ...summary, response: out, documentNav });

    if (out.location?.includes("error=")) {
      authTrace("route.redirect_with_error", {
        location: out.location,
        action: summary.action,
      });
    }

    // fetch() following a 302 to Microsoft → CORS. Return JSON instead.
    if (
      !documentNav &&
      out.location &&
      res.status >= 300 &&
      res.status < 400
    ) {
      authTrace("route.json_redirect", {
        action: summary.action,
        locationHost: (() => {
          try {
            return new URL(out.location).host;
          } catch {
            return out.location.slice(0, 80);
          }
        })(),
      });
      const jsonRes = NextResponse.json({ url: out.location }, { status: 200 });
      for (const cookie of res.headers.getSetCookie?.() ?? []) {
        jsonRes.headers.append("Set-Cookie", cookie);
      }
      return jsonRes;
    }

    return res;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    authTrace(`route.${method}.crash`, { ...summary, message, stack });
    console.error(`[NextAuth] ${method} crash:`, message, error);
    return NextResponse.json(
      {
        error: "Authentication service error",
        detail: message,
        trace: summary,
      },
      { status: 500 },
    );
  }
}

export async function GET(req: NextRequest) {
  return safeAuth("GET", req);
}

export async function POST(req: NextRequest) {
  return safeAuth("POST", req);
}
