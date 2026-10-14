import { auth } from "@/lib/auth";
import { getActiveM365AccessToken } from "@/lib/m365-client";

/**
 * Graph tokens are not stored on the NextAuth cookie (they exceed the cookie limit).
 * Prefer session.azureAccessToken or an Azure AD bearer, then the signed-in user's
 * encrypted M365 connection.
 */
export async function resolveUserGraphToken(request: Request): Promise<string | null> {
  const session = await auth().catch(() => null);
  const sessionToken = session?.azureAccessToken?.trim();
  if (sessionToken) return sessionToken;

  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (bearer && session?.user) return bearer;

  const oid = session?.azureOid?.trim();
  if (!session?.user || !oid) return null;

  const active = await getActiveM365AccessToken(oid).catch(() => null);
  return active?.accessToken?.trim() || null;
}
