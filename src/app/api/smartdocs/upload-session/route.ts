import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { canUploadSmartDocs } from "@/lib/permissions";
import {
  beginSmartDocSharePointUpload,
  type SmartDocUploadScope,
} from "@/lib/smartdoc-import";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";

export const maxDuration = 60;

/**
 * Open a Graph upload session in the workspace SharePoint folder.
 * The file bytes never enter this function — the client (or /upload-chunk)
 * sends them to SharePoint.
 */
export async function POST(request: Request) {
  const role = await resolveRequestRole(request);
  if (!canUploadSmartDocs(role)) {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden("You cannot upload SmartDocs"),
    );
  }

  try {
    const body = (await request.json()) as {
      scope?: string;
      dealId?: string;
      companyId?: string;
      projectId?: string;
      fileName?: string;
    };

    const fileName = body.fileName?.trim();
    if (!fileName) {
      return NextResponse.json({ error: "fileName is required" }, { status: 400 });
    }

    const scope = parseUploadScope(body);
    if (!scope) {
      return NextResponse.json(
        { error: "Choose an opportunity, company, or project to file into." },
        { status: 400 },
      );
    }

    const session = await beginSmartDocSharePointUpload({ scope, fileName });
    return NextResponse.json({
      uploadUrl: session.uploadUrl,
      expirationDateTime: session.expirationDateTime,
      fileName: session.fileName,
      folderPath: session.folderPath ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "GRAPH_UNAVAILABLE") {
      return NextResponse.json(
        {
          error: "SharePoint is not connected on this server.",
          code: "GRAPH_UNAVAILABLE",
        },
        { status: 409 },
      );
    }
    if (/not found/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return sharePointErrorResponse(error);
  }
}

function parseUploadScope(body: {
  scope?: string;
  dealId?: string;
  companyId?: string;
  projectId?: string;
}): SmartDocUploadScope | null {
  const dealId = body.dealId?.trim();
  const companyId = body.companyId?.trim();
  const projectId = body.projectId?.trim();
  const kind = body.scope?.trim();

  if (kind === "project" && projectId) return { kind: "project", projectId };
  if (kind === "company" && companyId) return { kind: "company", companyId };
  if (kind === "opportunity" && dealId) return { kind: "opportunity", dealId };
  if (projectId) return { kind: "project", projectId };
  if (companyId) return { kind: "company", companyId };
  if (dealId) return { kind: "opportunity", dealId };
  return null;
}
