import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { putSharePointUploadSessionChunk } from "@/lib/m365/graph-client";
import { canUploadSmartDocs } from "@/lib/permissions";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";

export const maxDuration = 60;

/**
 * Proxy one Graph upload-session fragment (under Vercel's body limit).
 * Bytes go to SharePoint; SmartCRM never stores the binary.
 */
export async function POST(request: Request) {
  const role = await resolveRequestRole(request);
  if (!canUploadSmartDocs(role)) {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden("You cannot upload SmartDocs"),
    );
  }

  try {
    const form = await request.formData();
    const uploadUrl = String(form.get("uploadUrl") ?? "").trim();
    const contentRange = String(form.get("contentRange") ?? "").trim();
    const chunk = form.get("chunk");

    if (!uploadUrl || !contentRange) {
      return NextResponse.json(
        { error: "uploadUrl and contentRange are required" },
        { status: 400 },
      );
    }
    if (!(chunk instanceof Blob) || chunk.size === 0) {
      return NextResponse.json({ error: "chunk is required" }, { status: 400 });
    }

    const bytes = Buffer.from(await chunk.arrayBuffer());
    const result = await putSharePointUploadSessionChunk({
      uploadUrl,
      contentRange,
      bytes,
    });

    return NextResponse.json({
      complete: result.complete,
      item: result.item ?? null,
      nextExpectedRanges: result.nextExpectedRanges ?? [],
    });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
