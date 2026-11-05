import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { canUploadSmartDocs } from "@/lib/permissions";
import { buildProjectDocumentFindings } from "@/lib/opportunity-document-findings";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const role = await resolveRequestRole(request);
  if (!canUploadSmartDocs(role) && role !== "admin") {
    return NextResponse.json(
      { error: "You cannot turn documents into findings with this role" },
      { status: 403 },
    );
  }

  try {
    const result = await buildProjectDocumentFindings(projectId);
    return NextResponse.json(result);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status === 404) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    console.warn(
      "[project-findings] document/correspondence read failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "Could not read sources on this project" },
      { status: 500 },
    );
  }
}
