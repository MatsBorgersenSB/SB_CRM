import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { canUploadSmartDocs } from "@/lib/permissions";
import {
  loadCompanyDocumentKnowledge,
  saveCompanyDocumentKnowledge,
} from "@/lib/company-document-knowledge-data";
import { parseSourceFindings } from "@/lib/source-findings";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const state = await loadCompanyDocumentKnowledge(companyId);
  return NextResponse.json({ findings: state.findings ?? [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const role = await resolveRequestRole(request);

  if (!canUploadSmartDocs(role) && role !== "admin") {
    return NextResponse.json(
      { error: "You cannot add findings for this company" },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    findings?: unknown;
  } | null;

  if (!Array.isArray(body?.findings)) {
    return NextResponse.json({ error: "findings array is required" }, { status: 400 });
  }

  try {
    const current = await loadCompanyDocumentKnowledge(companyId);
    const nextFindings = parseSourceFindings(body.findings);
    const state = await saveCompanyDocumentKnowledge(companyId, {
      ...current,
      findings: nextFindings,
    });
    return NextResponse.json({ findings: state.findings ?? nextFindings });
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 404) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    console.warn(
      "[findings] company save failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ error: "Could not save finding" }, { status: 500 });
  }
}
