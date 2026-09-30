import { getGraphAccessToken } from "@/lib/m365/get-graph-access-token";
import {
  ensureProjectSharePointFolder,
  type ProjectSharePointFolder,
} from "@/lib/m365/graph-client";
import { isGraphTransport } from "@/services/sharepoint/config/environment";

/**
 * Create or resolve `/Projects/{Name}` or `/Projects/{Company}/{Name}`.
 * Idempotent — Graph ensureFolderPath returns the existing folder when present.
 */
export async function provisionProjectSharePointFolder(
  projectName: string,
  companyName?: string | null,
): Promise<ProjectSharePointFolder> {
  if (!isGraphTransport()) {
    throw new Error(
      "SharePoint Graph transport is off. Set SHAREPOINT_TRANSPORT=graph on the server.",
    );
  }

  const siteId = process.env.SHAREPOINT_SITE_ID?.trim();
  if (!siteId) {
    throw new Error("SHAREPOINT_SITE_ID is not configured");
  }

  const accessToken = await getGraphAccessToken();
  return ensureProjectSharePointFolder(
    accessToken,
    siteId,
    projectName,
    companyName,
  );
}
