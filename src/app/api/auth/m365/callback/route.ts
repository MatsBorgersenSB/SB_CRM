import { NextResponse } from "next/server";
import {
  exchangeM365AuthCode,
  fetchGraphMe,
  upsertM365ExternalIntegration,
} from "@/lib/m365-client";

const STATE_COOKIE = "smartcrm_m365_oauth_state";

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

function postAuthRedirect(query: string): string {
  return `${appBaseUrl()}/deals?${query}`;
}

/**
 * Microsoft OAuth callback — exchange code, load /me, persist ExternalIntegration.
 * OAuth tokens are encrypted at rest (AES-256-GCM) inside upsertM365ExternalIntegration.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const oauthErrorDescription = url.searchParams.get("error_description");

  const clearState = (response: NextResponse) => {
    response.cookies.set(STATE_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
    return response;
  };

  if (oauthError) {
    const redirect = NextResponse.redirect(
      postAuthRedirect(
        `m365=error&reason=${encodeURIComponent(oauthErrorDescription || oauthError)}`,
      ),
    );
    return clearState(redirect);
  }

  if (!code || !state) {
    return clearState(
      NextResponse.json({ error: "Missing OAuth code or state" }, { status: 400 }),
    );
  }

  const cookieHeader = request.headers.get("cookie") ?? "";
  const expectedState = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${STATE_COOKIE}=`))
    ?.slice(STATE_COOKIE.length + 1);

  if (!expectedState || expectedState !== state) {
    return clearState(
      NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 }),
    );
  }

  try {
    // Plaintext tokens only live in-memory here; persistence encrypts via encryptToken.
    const tokens = await exchangeM365AuthCode(code);
    const me = await fetchGraphMe(tokens.accessToken);
    const integration = await upsertM365ExternalIntegration({
      tokens,
      userObjectId: me.id,
      tenantId: process.env.AZURE_TENANT_ID ?? null,
    });

    const redirect = NextResponse.redirect(
      postAuthRedirect(`m365=connected&integrationId=${encodeURIComponent(integration.id)}`),
    );
    return clearState(redirect);
  } catch (error) {
    console.error("[m365 callback]", error);
    const message = error instanceof Error ? error.message : "Token exchange failed";
    const redirect = NextResponse.redirect(
      postAuthRedirect(`m365=error&reason=${encodeURIComponent(message)}`),
    );
    return clearState(redirect);
  }
}
