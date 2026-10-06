import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { canUploadSmartDocs } from "@/lib/permissions";
import { buildOpportunityDocumentFindings } from "@/lib/opportunity-document-findings";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const role = await resolveRequestRole(request);
  if (!canUploadSmartDocs(role) && role !== "admin") {
    return NextResponse.json(
      { error: "You cannot turn documents into findings with this role" },
      { status: 403 },
    );
  }

  try {
    const result = await buildOpportunityDocumentFindings(id);
    return NextResponse.json(result);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 404) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }
    console.warn(
      "[findings] document read failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "Could not read documents on this opportunity" },
      { status: 500 },
    );
  }
}
