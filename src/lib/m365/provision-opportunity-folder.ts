import { after } from "next/server";
import { getPrisma } from "@/lib/prisma";
import {
  ensureOpportunitySharePointFolder,
  type OpportunitySharePointFolder,
} from "@/lib/m365/graph-client";
import { getGraphAccessToken } from "@/lib/m365/get-graph-access-token";
import { isGraphTransport } from "@/services/sharepoint/config/environment";

/**
 * Fire-and-forget SharePoint folder provision after Prisma opportunity create.
 * Uses Next.js `after()` so work can finish on Vercel after the response is sent.
 * Failures are logged only — opportunity create remains successful.
 */
export function scheduleOpportunitySharePointFolderProvision(input: {
  opportunityId: string;
  companyName: string;
  opportunityTitle: string;
}): void {
  if (!isGraphTransport()) return;

  const siteId = process.env.SHAREPOINT_SITE_ID?.trim();
  if (!siteId) {
    console.warn(
      "[SharePoint Sync Skipped]: SHAREPOINT_SITE_ID is not configured",
    );
    return;
  }

  after(async () => {
    try {
      const accessToken = await getGraphAccessToken();
      const folder = await ensureOpportunitySharePointFolder(
        accessToken,
        siteId,
        input.companyName,
        input.opportunityTitle,
      );
      await linkOpportunitySharePointFolder(input.opportunityId, folder);
      console.log(`[SharePoint] Linked folder for deal: ${input.opportunityId}`);
    } catch (err) {
      console.warn(`[SharePoint Sync Skipped]: ${err}`);
    }
  });
}

export async function linkOpportunitySharePointFolder(
  opportunityId: string,
  folder: OpportunitySharePointFolder,
): Promise<void> {
  const prisma = getPrisma();
  await prisma.opportunity.update({
    where: { id: opportunityId },
    data: {
      sharepointFolderId: folder.folderId,
      sharepointFolderUrl: folder.webUrl,
      sharepointFolderPath: folder.path,
    },
  });
}
