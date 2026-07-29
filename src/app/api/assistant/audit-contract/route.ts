import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  auditContractText,
  type ContractAuditResult,
} from "@/lib/assistant/contract-auditor";
import { findPrismaCompanyByRouteKey } from "@/lib/data/companies";
import { resolveOpportunityId } from "@/lib/meeting-intelligence-data";
import { withPrismaRetry } from "@/lib/prisma";

type AuditRequestBody = {
  documentId?: string | null;
  rawText?: string;
  documentType?: string | null;
  companyId?: string | null;
  opportunityId?: string | null;
  persist?: boolean;
};

/**
 * POST /api/assistant/audit-contract
 * Body: { documentId?, rawText, documentType?, companyId?, opportunityId?, persist? }
 */
export async function POST(request: Request) {
  let body: AuditRequestBody;
  try {
    body = (await request.json()) as AuditRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const rawText = body.rawText?.trim() ?? "";
  if (!rawText) {
    return NextResponse.json({ error: "rawText is required" }, { status: 400 });
  }

  try {
    const audit: ContractAuditResult = auditContractText(
      rawText,
      body.documentType?.trim() || undefined,
    );

    if (body.persist === false) {
      return NextResponse.json({ audit, persisted: false });
    }

    let prismaCompanyId: string | null = null;
    if (body.companyId?.trim()) {
      const company = await findPrismaCompanyByRouteKey(body.companyId.trim());
      prismaCompanyId = company?.id ?? null;
    }

    let prismaOpportunityId: string | null = null;
    if (body.opportunityId?.trim()) {
      prismaOpportunityId =
        (await resolveOpportunityId(body.opportunityId.trim())) ??
        body.opportunityId.trim();
    }

    let documentRecordId: string | null = null;
    const documentId = body.documentId?.trim() || null;
    if (documentId) {
      const record = await withPrismaRetry((prisma) =>
        prisma.documentRecord.findFirst({
          where: {
            OR: [{ id: documentId }, { name: documentId }],
          },
          select: { id: true, opportunityId: true },
        }),
      ).catch(() => null);
      if (record) {
        documentRecordId = record.id;
        if (!prismaOpportunityId && record.opportunityId) {
          prismaOpportunityId = record.opportunityId;
        }
      }
    }

    const saved = await withPrismaRetry((prisma) =>
      prisma.documentComplianceAudit.create({
        data: {
          smartDocId: documentRecordId ? null : documentId,
          documentRecordId,
          opportunityId: prismaOpportunityId,
          companyId: prismaCompanyId,
          documentType: body.documentType?.trim() || audit.documentType || null,
          overallRiskScore: audit.overallRiskScore,
          findings: audit as unknown as object,
          rawTextHash: audit.textHash,
          sourceSnippet: rawText.slice(0, 500),
        },
      }),
    );

    if (body.companyId) {
      revalidatePath(`/companies/${encodeURIComponent(body.companyId)}`);
    }
    if (body.opportunityId) {
      revalidatePath(`/deals/${encodeURIComponent(body.opportunityId)}`);
    }
    if (documentId) {
      revalidatePath(`/documents/${encodeURIComponent(documentId)}`);
    }

    return NextResponse.json({
      audit,
      persisted: true,
      auditId: saved.id,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Contract audit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/assistant/audit-contract?documentId=... | opportunityId=...
 * Returns the latest persisted audit for a document or opportunity.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const documentId = url.searchParams.get("documentId")?.trim();
  const opportunityId = url.searchParams.get("opportunityId")?.trim();

  if (!documentId && !opportunityId) {
    return NextResponse.json(
      { error: "documentId or opportunityId is required" },
      { status: 400 },
    );
  }

  try {
    let prismaOpportunityId: string | undefined;
    if (opportunityId) {
      prismaOpportunityId =
        (await resolveOpportunityId(opportunityId)) ?? opportunityId;
    }

    const row = await withPrismaRetry((prisma) =>
      prisma.documentComplianceAudit.findFirst({
        where: {
          OR: [
            ...(documentId
              ? [
                  { smartDocId: documentId },
                  { documentRecordId: documentId },
                ]
              : []),
            ...(prismaOpportunityId
              ? [{ opportunityId: prismaOpportunityId }]
              : []),
          ],
        },
        orderBy: { createdAt: "desc" },
      }),
    );

    if (!row) {
      return NextResponse.json({ audit: null });
    }

    return NextResponse.json({
      audit: row.findings as ContractAuditResult,
      auditId: row.id,
      overallRiskScore: row.overallRiskScore,
      createdAt: row.createdAt,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load audit";
    return NextResponse.json({ error: message, audit: null }, { status: 500 });
  }
}
