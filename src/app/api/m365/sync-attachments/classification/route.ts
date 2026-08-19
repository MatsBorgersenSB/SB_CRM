import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { getPrisma } from "@/lib/prisma";
import { getGraphAccessToken } from "@/lib/m365/get-graph-access-token";
import { applySmartDocFieldsToDriveItem } from "@/lib/m365/graph-client";
import { SMARTDOC_CATEGORIES, SMARTDOC_TYPES_BY_CATEGORY } from "@/types/smartdoc-library";

export async function PATCH(request: Request) {
  const role = getRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      updates?: Array<{
        documentId?: string;
        docCategory?: string;
        docType?: string;
      }>;
    };

    const updates = Array.isArray(body.updates) ? body.updates.slice(0, 80) : [];
    if (updates.length === 0) {
      return NextResponse.json({ error: "updates are required" }, { status: 400 });
    }

    const siteId = process.env.SHAREPOINT_SITE_ID?.trim();
    if (!siteId) {
      return NextResponse.json({ error: "SHAREPOINT_SITE_ID is not configured" }, { status: 500 });
    }

    const accessToken = await getGraphAccessToken();
    const prisma = getPrisma();
    const results: Array<{ documentId: string; ok: boolean; error?: string }> = [];

    for (const row of updates) {
      const documentId = row.documentId?.trim();
      const docCategory = row.docCategory?.trim();
      const docType = row.docType?.trim();
      if (!documentId || !docCategory || !docType) {
        continue;
      }
      if (!SMARTDOC_CATEGORIES.includes(docCategory as (typeof SMARTDOC_CATEGORIES)[number])) {
        results.push({ documentId, ok: false, error: "Invalid category" });
        continue;
      }
      if (!SMARTDOC_TYPES_BY_CATEGORY[docCategory as (typeof SMARTDOC_CATEGORIES)[number]].includes(docType)) {
        results.push({ documentId, ok: false, error: "Invalid type for category" });
        continue;
      }

      const record = await prisma.documentRecord.findUnique({
        where: { id: documentId },
        select: { id: true, sharepointItemId: true },
      });
      if (!record?.sharepointItemId) {
        results.push({ documentId, ok: false, error: "SharePoint item not found" });
        continue;
      }

      try {
        await applySmartDocFieldsToDriveItem({
          accessToken,
          siteId,
          itemId: record.sharepointItemId,
          fields: { DocCategory: docCategory, DocType: docType },
        });
        results.push({ documentId, ok: true });
      } catch (error) {
        results.push({
          documentId,
          ok: false,
          error: error instanceof Error ? error.message : "Update failed",
        });
      }
    }

    return NextResponse.json({
      ok: true,
      updated: results.filter((row) => row.ok).length,
      failed: results.filter((row) => !row.ok).length,
      results,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to update document classification",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

