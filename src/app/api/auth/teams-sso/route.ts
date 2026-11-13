import { createRemoteJWKSet, jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";
import { getAzureAdClientId, getAzureAdTenantId } from "@/lib/auth-env";
import { authTrace } from "@/lib/auth-debug";
import { isInternalEmail } from "@/lib/domain-rules";
import {
  authCookieOptions,
  isSecureAuthCookies,
  mintSessionTokenFromUserClaims,
  sessionCookieName,
} from "@/lib/outlook-dialog-bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * FS-018 — exchange a Teams SSO token for a SmartCRM Auth.js session cookie.
 * Silent path: Teams getAuthToken → this route → Set-Cookie.
 */
export async function POST(req: NextRequest) {
  let token = "";
  try {
    const body = (await req.json()) as { token?: string };
    token = body.token?.trim() || "";
  } catch {
    token = "";
  }

  if (!token) {
    return NextResponse.json({ error: "Missing Teams SSO token" }, { status: 400 });
  }

  const clientId = getAzureAdClientId();
  const tenantId = getAzureAdTenantId();
  if (!clientId) {
    return NextResponse.json({ error: "Azure AD client is not configured" }, { status: 503 });
  }

  try {
    const issuerCandidates =
      tenantId && tenantId !== "organizations"
        ? [
            `https://login.microsoftonline.com/${tenantId}/v2.0`,
            `https://sts.windows.net/${tenantId}/`,
          ]
        : undefined;

    const jwks = createRemoteJWKSet(
      new URL(
        tenantId && tenantId !== "organizations"
          ? `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`
          : "https://login.microsoftonline.com/common/discovery/v2.0/keys",
      ),
    );

    const { payload } = await jwtVerify(token, jwks, {
      audience: [clientId, `api://${clientId}`],
      ...(issuerCandidates ? { issuer: issuerCandidates } : {}),
    });

    const email = String(
      payload.preferred_username ||
        payload.upn ||
        payload.email ||
        payload.unique_name ||
        "",
    )
      .trim()
      .toLowerCase();

    if (!email || !email.includes("@")) {
      authTrace("teams.sso.no-email", { keys: Object.keys(payload) });
      return NextResponse.json(
        { error: "Teams token did not include an email claim" },
        { status: 401 },
      );
    }

    const name =
      typeof payload.name === "string" && payload.name.trim()
        ? payload.name.trim()
        : email;
    const azureOid =
      typeof payload.oid === "string"
        ? payload.oid
        : typeof payload.sub === "string"
          ? payload.sub
          : null;
    const azureTenantId =
      typeof payload.tid === "string" ? payload.tid : tenantId === "organizations" ? null : tenantId;

    const sessionJwt = await mintSessionTokenFromUserClaims({
      email,
      name,
      accessRole: isInternalEmail(email) ? "superuser" : "commercial",
      azureOid,
      azureTenantId,
    });

    const secure = isSecureAuthCookies();
    const cookieName = sessionCookieName(secure);
    const maxAge = 60 * 60 * 8;

    const response = NextResponse.json(
      {
        ok: true,
        user: { email, name },
      },
      { headers: { "Cache-Control": "no-store" } },
    );

    response.cookies.set(cookieName, sessionJwt, {
      ...authCookieOptions(secure),
      maxAge,
    });

    authTrace("teams.sso.ok", { email, cookieName });
    return response;
  } catch (error) {
    authTrace("teams.sso.invalid", {
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Invalid or expired Teams SSO token" },
      { status: 401 },
    );
  }
}
