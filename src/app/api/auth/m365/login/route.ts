import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import { buildM365AuthorizationUrl } from "@/lib/m365-client";

const STATE_COOKIE = "smartcrm_m365_oauth_state";

/**
 * Start Microsoft 365 Graph OAuth (delegated).
 * Requires an active SmartCRM SSO session so Graph tokens bind to the user.
 * Scopes: Mail + Calendar + SharePoint/Files (see m365OAuthScopes).
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    const origin = new URL(request.url).origin;
    const signIn = new URL("/auth/signin", origin);
    signIn.searchParams.set("callbackUrl", "/api/auth/m365/login");
    return NextResponse.redirect(signIn);
  }

  try {
    const state = randomBytes(24).toString("hex");
    const url = buildM365AuthorizationUrl(state);
    const response = NextResponse.redirect(url);
    const secure =
      process.env.NODE_ENV === "production" || process.env.VERCEL === "1";
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      path: "/",
      maxAge: 60 * 10,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "OAuth login failed";
    return NextResponse.json(
      {
        error: "M365 OAuth is not configured",
        detail: message,
        hint: "Set AZURE_AD_CLIENT_ID, AZURE_AD_CLIENT_SECRET, AZURE_AD_TENANT_ID, and NEXT_PUBLIC_APP_URL. Register redirect URI …/api/auth/m365/callback",
      },
      { status: 500 },
    );
  }
}
