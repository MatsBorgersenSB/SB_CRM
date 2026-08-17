import { getGraphAccessToken } from "@/lib/m365/get-graph-access-token";
import {
  ensureCompanyDocumentsSharePointFolder,
  type CompanyDocumentsSharePointFolder,
} from "@/lib/m365/graph-client";
import { isGraphTransport } from "@/services/sharepoint/config/environment";

/**
 * Create or resolve `/Companies/{CompanyName}/Documents` in SharePoint.
 * Idempotent — Graph ensureFolderPath returns the existing folder when present.
 */
export async function provisionCompanyDocumentsSharePointFolder(
  companyName: string,
): Promise<CompanyDocumentsSharePointFolder> {
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
  return ensureCompanyDocumentsSharePointFolder(
    accessToken,
    siteId,
    companyName,
  );
}
