import { getActiveM365AccessToken } from "@/lib/m365-client";
import { getSessionAzureOid } from "@/lib/m365/session-graph-user";

/**
 * Resolve a Graph access token for SharePoint folder provisioning.
 * Prefers MICROSOFT_GRAPH_ACCESS_TOKEN (app/daemon), then the signed-in
 * user's M365 OAuth integration, then any active integration.
 */
export async function getGraphAccessToken(): Promise<string> {
  const envToken = process.env.MICROSOFT_GRAPH_ACCESS_TOKEN?.trim();
  if (envToken) return envToken;

  const oid = await getSessionAzureOid().catch(() => undefined);
  const active = await getActiveM365AccessToken(oid);
  if (active?.accessToken) return active.accessToken;

  throw new Error(
    "No Graph access token available (set MICROSOFT_GRAPH_ACCESS_TOKEN or connect M365 OAuth)",
  );
}
