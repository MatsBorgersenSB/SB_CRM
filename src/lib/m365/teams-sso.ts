/**
 * Teams tab SSO — silent getAuthToken when possible.
 * Interactive Connect remains the emergency path.
 */

import { whenTeamsReady, type TeamsSdk } from "@/lib/teams-sdk";

export type TeamsAuthApi = {
  getAuthToken: (options?: {
    silent?: boolean;
    resources?: string[];
  }) => Promise<string>;
  authenticate?: (options: {
    url: string;
    width?: number;
    height?: number;
    successCallback?: (result: string) => void;
    failureCallback?: (reason: string) => void;
  }) => void;
};

function teamsAuth(sdk: TeamsSdk): TeamsAuthApi | null {
  const auth = (sdk as TeamsSdk & { authentication?: TeamsAuthApi }).authentication;
  if (!auth?.getAuthToken) return null;
  return auth;
}

/** Silent SSO token from Teams host. Null outside Teams or when consent is required. */
export async function getTeamsSilentAuthToken(): Promise<string | null> {
  const teams = await whenTeamsReady(6_000);
  if (!teams) return null;
  const auth = teamsAuth(teams);
  if (!auth) return null;
  try {
    const token = await auth.getAuthToken({ silent: true });
    return token?.trim() || null;
  } catch {
    return null;
  }
}

/** Interactive Teams token (may show consent). */
export async function getTeamsAuthTokenInteractive(): Promise<string | null> {
  const teams = await whenTeamsReady(8_000);
  if (!teams) return null;
  const auth = teamsAuth(teams);
  if (!auth) return null;
  try {
    const token = await auth.getAuthToken({ silent: false });
    return token?.trim() || null;
  } catch {
    return null;
  }
}

/** Exchange a Teams SSO token for a SmartCRM session cookie. */
export async function claimTeamsSsoSession(token: string): Promise<boolean> {
  const response = await fetch("/api/auth/teams-sso", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({ token }),
  });
  return response.ok;
}

/** Probe existing session, then silent Teams SSO, then optional interactive token. */
export async function ensureTeamsSmartCrmSession(options?: {
  allowInteractive?: boolean;
}): Promise<"authenticated" | "needs-sign-in"> {
  const probe = await fetch("/api/auth/session", {
    credentials: "include",
    cache: "no-store",
  });
  if (probe.ok) {
    const session = (await probe.json().catch(() => null)) as {
      user?: { email?: string | null } | null;
    } | null;
    if (session?.user?.email) return "authenticated";
  }

  const silent = await getTeamsSilentAuthToken();
  if (silent && (await claimTeamsSsoSession(silent))) return "authenticated";

  if (options?.allowInteractive) {
    const interactive = await getTeamsAuthTokenInteractive();
    if (interactive && (await claimTeamsSsoSession(interactive))) {
      return "authenticated";
    }
  }

  return "needs-sign-in";
}
