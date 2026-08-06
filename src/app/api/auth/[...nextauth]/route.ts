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

/**
 * Wrap Auth.js handlers with step tracing + JSON errors (not HTML 500).
 */
async function safeAuth(method: "GET" | "POST", req: NextRequest) {
  const summary = summarizeAuthRequest(req);
  authTrace(`route.${method}.start`, summary);

  try {
    const res = await handlers[method](req);
    const out = summarizeResponse(res);
    authTrace(`route.${method}.done`, { ...summary, response: out });

    // Surface OAuth error redirects clearly in logs
    if (out.location?.includes("error=")) {
      authTrace("route.redirect_with_error", {
        location: out.location,
        action: summary.action,
      });
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
