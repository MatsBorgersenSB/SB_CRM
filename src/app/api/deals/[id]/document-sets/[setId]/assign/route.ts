import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { assignDocumentToSet } from "@/lib/document-set-actions";
import { canUploadSmartDocs } from "@/lib/permissions";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; setId: string }> },
) {
  const { setId } = await params;
  const role = getRequestRole(request);

  if (!canUploadSmartDocs(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as { smartDocId?: string };
    if (!body.smartDocId?.trim()) {
      return NextResponse.json({ error: "smartDocId is required" }, { status: 400 });
    }

    const record = await assignDocumentToSet(body.smartDocId.trim(), setId);
    return NextResponse.json({ document: record });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
