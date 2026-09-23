import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { canUploadSmartDocs } from "@/lib/permissions";
import {
  applyDocumentKnowledgeDecision,
  type DocumentKnowledgeDecision,
} from "@/lib/company-document-knowledge";
import {
  loadCompanyDocumentKnowledge,
  saveCompanyDocumentKnowledge,
} from "@/lib/company-document-knowledge-data";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const state = await loadCompanyDocumentKnowledge(companyId);
  return NextResponse.json({ state });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const role = await resolveRequestRole(request);

  if (!canUploadSmartDocs(role)) {
    return NextResponse.json(
      { error: "You cannot confirm document knowledge for this company" },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    claimId?: unknown;
    decision?: unknown;
  } | null;

  const claimId = typeof body?.claimId === "string" ? body.claimId.trim() : "";
  const decision = body?.decision;
  if (
    !claimId ||
    (decision !== "confirmed" && decision !== "dismissed")
  ) {
    return NextResponse.json(
      { error: "claimId and decision (confirmed | dismissed) are required" },
      { status: 400 },
    );
  }

  try {
    const current = await loadCompanyDocumentKnowledge(companyId);
    const next = applyDocumentKnowledgeDecision(
      current,
      claimId,
      decision as DocumentKnowledgeDecision,
    );
    const state = await saveCompanyDocumentKnowledge(companyId, next);
    return NextResponse.json({ state });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 404) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    console.warn(
      "[document-knowledge] save failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ error: "Could not save decision" }, { status: 500 });
  }
}
