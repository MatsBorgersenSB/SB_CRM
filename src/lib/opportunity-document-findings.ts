import "server-only";

import { getPrisma } from "@/lib/prisma";
import { getGraphAccessToken } from "@/lib/m365/get-graph-access-token";
import { downloadSharePointDriveItemBytes } from "@/lib/m365/graph-client";
import { findPrismaOpportunityByRouteKey } from "@/lib/resolve-opportunity-route";
import { isGraphTransport } from "@/services/sharepoint/config/environment";
import { extractTextFromPdfBytes, looksLikePdf } from "@/lib/document-text-extract";
import {
  createSourceFinding,
  extractSourceFindingPreview,
  type SourceFinding,
} from "@/lib/source-findings";
import { smartDocHref } from "@/types/smartdoc";

const MAX_PDF_BYTES = 12_000_000;

export type DocumentFindingsResult = {
  findings: SourceFinding[];
  unread: Array<{ name: string; reason: string }>;
};

/**
 * Read opportunity documents (especially permits) and propose findings.
 * Filing a file is not knowledge until the content is confirmed.
 */
export async function buildOpportunityDocumentFindings(
  routeKey: string,
): Promise<DocumentFindingsResult> {
  const opportunity = await findPrismaOpportunityByRouteKey(routeKey);
  if (!opportunity) {
    throw Object.assign(new Error("Opportunity not found"), { status: 404 });
  }

  const prisma = getPrisma();
  const records = await prisma.documentRecord.findMany({
    where: { opportunityId: opportunity.id },
    orderBy: { updatedAt: "desc" },
    take: 12,
    select: {
      id: true,
      name: true,
      mimeType: true,
      contentBase64: true,
      sharepointItemId: true,
      sharepointWebUrl: true,
    },
  });

  const findings: SourceFinding[] = [];
  const unread: Array<{ name: string; reason: string }> = [];

  if (records.length === 0) {
    return {
      findings,
      unread: [
        {
          name: "Documents",
          reason:
            "No file bytes are linked on this opportunity yet. Open Documents and keep the permit filed, or paste the key facts in Add a finding.",
        },
      ],
    };
  }

  for (const record of records) {
    try {
      const bytes = await loadDocumentBytes(record);
      if (!bytes) {
        unread.push({
          name: record.name,
          reason:
            "The file is listed but SmartAssist could not open it. Confirm SharePoint access, or paste what the permit says.",
        });
        continue;
      }
      if (bytes.length > MAX_PDF_BYTES) {
        unread.push({
          name: record.name,
          reason: "The file is too large to read in this pass.",
        });
        continue;
      }

      let text = "";
      if (looksLikePdf(record)) {
        text = await extractTextFromPdfBytes(bytes);
      } else {
        text = bytes.toString("utf8").replace(/\0/g, " ").trim();
      }

      if (text.length < 40) {
        unread.push({
          name: record.name,
          reason: "The file opened but almost no text came out (likely a scan). Paste the key facts.",
        });
        continue;
      }

      const preview = extractSourceFindingPreview(
        text,
        record.sharepointWebUrl || smartDocHref(record.id),
        record.name,
      );
      findings.push(
        createSourceFinding({
          title: preview.title || record.name,
          url: record.sharepointWebUrl || smartDocHref(record.id),
          note: record.name,
          kind: "document",
          claims: preview.claims,
        }),
      );
    } catch (error) {
      unread.push({
        name: record.name,
        reason: error instanceof Error ? error.message : "Could not read this file",
      });
    }
  }

  return { findings, unread };
}

async function loadDocumentBytes(record: {
  contentBase64: string | null;
  sharepointItemId: string | null;
}): Promise<Buffer | null> {
  if (record.contentBase64?.trim()) {
    return Buffer.from(record.contentBase64, "base64");
  }
  if (!record.sharepointItemId?.trim() || !isGraphTransport()) return null;
  const siteId = process.env.SHAREPOINT_SITE_ID?.trim();
  if (!siteId) return null;
  try {
    const accessToken = await getGraphAccessToken();
    return await downloadSharePointDriveItemBytes({
      accessToken,
      siteId,
      itemId: record.sharepointItemId,
    });
  } catch (error) {
    console.warn(
      "[document-findings] SharePoint download skipped:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
