import { encode, decode, type JWT } from "next-auth/jwt";
import { resolveAuthSecret } from "@/lib/auth-env";

/** Salt must stay distinct from the Auth.js session cookie salt. */
export const OUTLOOK_BRIDGE_SALT = "smartcrm.outlook-dialog-bridge";

/** Auth.js session cookie name on HTTPS / Vercel. */
export function sessionCookieName(secure: boolean): string {
  return secure ? "__Secure-authjs.session-token" : "authjs.session-token";
}

export function useSecureAuthCookies(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.VERCEL === "1" ||
    Boolean(process.env.AUTH_URL?.startsWith("https://")) ||
    Boolean(process.env.NEXTAUTH_URL?.startsWith("https://"))
  );
}

/**
 * Cookie options for Outlook Web task panes (cross-site iframe).
 * SameSite=Lax cookies set in the Office Dialog are invisible to the
 * task-pane iframe on outlook.office.com — SameSite=None; Secure is required.
 *
 * Partitioned (CHIPS) is required when Chrome/Edge block third-party cookies:
 * without it, Set-Cookie from the claim route is dropped in the Outlook iframe
 * and the user bounces straight back to Sign In after a successful Microsoft SSO.
 */
export function authCookieOptions(secure: boolean) {
  return {
    httpOnly: true as const,
    sameSite: (secure ? "none" : "lax") as "none" | "lax",
    path: "/",
    secure,
    ...(secure ? { partitioned: true as const } : {}),
  };
}

const BRIDGE_MAX_AGE_SEC = 120;

export async function mintOutlookBridgeToken(session: JWT): Promise<string> {
  const secret = resolveAuthSecret();
  return encode({
    token: {
      ...session,
      purpose: "outlook-dialog-bridge",
    },
    secret,
    salt: OUTLOOK_BRIDGE_SALT,
    maxAge: BRIDGE_MAX_AGE_SEC,
  });
}

export async function readOutlookBridgeToken(token: string): Promise<JWT | null> {
  const secret = resolveAuthSecret();
  try {
    const payload = await decode({
      token,
      secret,
      salt: OUTLOOK_BRIDGE_SALT,
    });
    if (!payload || payload.purpose !== "outlook-dialog-bridge") return null;
    return payload;
  } catch {
    return null;
  }
}

/** Rebuild a normal Auth.js session JWT from a validated bridge payload. */
export async function mintSessionTokenFromBridge(bridge: JWT): Promise<string> {
  const secret = resolveAuthSecret();
  const secure = useSecureAuthCookies();
  const salt = sessionCookieName(secure);
  const {
    purpose: _purpose,
    iat: _iat,
    exp: _exp,
    jti: _jti,
    ...sessionClaims
  } = bridge;

  return encode({
    token: sessionClaims,
    secret,
    salt,
    maxAge: 60 * 60 * 8,
  });
}
