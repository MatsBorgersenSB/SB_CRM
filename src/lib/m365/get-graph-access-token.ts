import { getActiveM365AccessToken } from "@/lib/m365-client";

/**
 * Resolve a Graph access token for SharePoint folder provisioning.
 * Prefers MICROSOFT_GRAPH_ACCESS_TOKEN (app/daemon), then active M365 OAuth integration.
 */
export async function getGraphAccessToken(): Promise<string> {
  const envToken = process.env.MICROSOFT_GRAPH_ACCESS_TOKEN?.trim();
  if (envToken) return envToken;

  const active = await getActiveM365AccessToken();
  if (active?.accessToken) return active.accessToken;

  throw new Error(
    "No Graph access token available (set MICROSOFT_GRAPH_ACCESS_TOKEN or connect M365 OAuth)",
  );
}
