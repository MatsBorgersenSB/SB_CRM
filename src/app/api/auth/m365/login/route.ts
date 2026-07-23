import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { buildM365AuthorizationUrl } from "@/lib/m365-client";

const STATE_COOKIE = "smartcrm_m365_oauth_state";

/**
 * Start Microsoft 365 OAuth (delegated).
 * Scopes: Mail.Read, Mail.Send, Calendars.Read, offline_access (+ openid/profile/User.Read).
 */
export async function GET() {
  try {
    const state = randomBytes(24).toString("hex");
    const url = buildM365AuthorizationUrl(state);
    const response = NextResponse.redirect(url);
    response.cookies.set(STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
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
        hint: "Set AZURE_CLIENT_ID, AZURE_CLIENT_SECRET, AZURE_TENANT_ID, and NEXT_PUBLIC_APP_URL",
      },
      { status: 500 },
    );
  }
}
