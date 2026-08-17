import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { buildProjectSmartDocIdentityPreview } from "@/lib/smartdoc-identity";
import { canUploadSmartDocs } from "@/lib/permissions";
import {
  readSmartDocsForProject,
  readSmartDocsLibrary,
} from "@/lib/pipeline-db";
import { readProjectById } from "@/lib/project-db";
import { buildProjectDocumentContext } from "@/lib/smartdoc-library-engine";
import { importProjectSmartDoc } from "@/lib/smartdoc-import";
import { resolveCompanyForSmartDocs } from "@/lib/pipeline-db";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";
import type { CreateSmartDocInput, SmartDocCategory } from "@/types/smartdoc-library";
import {
  SMARTDOC_CATEGORIES,
  normalizeSmartDocOrigin,
} from "@/types/smartdoc-library";

async function parseCreateSmartDocRequest(request: Request): Promise<{
  metadata: CreateSmartDocInput;
  file?: { bytes: Buffer; mimeType: string | null; originalFileName: string };
}> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const DocCategory = String(form.get("DocCategory") ?? "");
    const DocType = String(form.get("DocType") ?? "").trim();
    const DocumentName = String(form.get("DocumentName") ?? "").trim();
    const originalFileName =
      String(form.get("originalFileName") ?? "").trim() || undefined;
    const Origin = normalizeSmartDocOrigin(String(form.get("Origin") ?? ""));
    const Counterparty = String(form.get("Counterparty") ?? "").trim() || undefined;
    const LinkedDealId =
      String(form.get("LinkedDealId") ?? "").trim() || undefined;
    const upload = form.get("file");

    let file:
      | { bytes: Buffer; mimeType: string | null; originalFileName: string }
      | undefined;

    if (upload instanceof File && upload.size > 0) {
      const bytes = Buffer.from(await upload.arrayBuffer());
      file = {
        bytes,
        mimeType: upload.type || null,
        originalFileName: upload.name || originalFileName || DocumentName,
      };
    }

    return {
      metadata: {
        DocCategory: DocCategory as SmartDocCategory,
        DocType,
        DocumentName,
        originalFileName: originalFileName ?? file?.originalFileName,
        Origin,
        Counterparty,
        LinkedDealId,
      },
      file,
    };
  }

  const body = (await request.json()) as CreateSmartDocInput & {
    fileBase64?: string;
    mimeType?: string;
  };

  let file:
    | { bytes: Buffer; mimeType: string | null; originalFileName: string }
    | undefined;

  if (body.fileBase64?.trim()) {
    file = {
      bytes: Buffer.from(body.fileBase64, "base64"),
      mimeType: body.mimeType ?? null,
      originalFileName:
        body.originalFileName?.trim() ||
        `${body.DocumentName?.trim() || "document"}.pdf`,
    };
  }

  return {
    metadata: {
      DocCategory: body.DocCategory,
      DocType: body.DocType,
      DocumentName: body.DocumentName,
      originalFileName: body.originalFileName,
      Origin: normalizeSmartDocOrigin(body.Origin),
      Counterparty: body.Counterparty?.trim() || undefined,
      LinkedDealId: body.LinkedDealId?.trim() || undefined,
    },
    file,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const { searchParams } = new URL(request.url);
  const previewCategory = searchParams.get("category");
  const previewType = searchParams.get("type");

  try {
    const [project, documents, library] = await Promise.all([
      readProjectById(projectId),
      readSmartDocsForProject(projectId),
      readSmartDocsLibrary(),
    ]);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const company = project.linkedCompanyId
      ? await resolveCompanyForSmartDocs(project.linkedCompanyId)
      : undefined;
    const context = buildProjectDocumentContext(project, company);

    let identityPreview = null;
    if (
      previewCategory &&
      previewType &&
      SMARTDOC_CATEGORIES.includes(previewCategory as SmartDocCategory)
    ) {
      identityPreview = buildProjectSmartDocIdentityPreview(
        context.projectCode,
        context.projectName,
        previewCategory as SmartDocCategory,
        previewType,
        library.map((record) => record.SmartDocID),
      );
    }

    return NextResponse.json({
      context,
      documents,
      identityPreview,
      existingIdentityIds: library.map((record) => record.SmartDocID),
    });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const role = await resolveRequestRole(request);

  if (!canUploadSmartDocs(role)) {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden(
        "You cannot upload SmartDocs for this project",
      ),
    );
  }

  try {
    const { metadata, file } = await parseCreateSmartDocRequest(request);

    if (
      !metadata.DocCategory ||
      !SMARTDOC_CATEGORIES.includes(metadata.DocCategory as SmartDocCategory) ||
      !metadata.DocType?.trim() ||
      !metadata.DocumentName?.trim()
    ) {
      return NextResponse.json(
        { error: "DocCategory, DocType, and DocumentName are required" },
        { status: 400 },
      );
    }

    if ((metadata as CreateSmartDocInput & { DocumentSetID?: string }).DocumentSetID) {
      return NextResponse.json(
        {
          error:
            "Project-owned SmartDocs cannot join opportunity Document Sets (PI/BQ/FQ)",
        },
        { status: 400 },
      );
    }

    const imported = await importProjectSmartDoc({
      projectId,
      metadata: {
        DocCategory: metadata.DocCategory,
        DocType: metadata.DocType.trim(),
        DocumentName: metadata.DocumentName.trim(),
        originalFileName: metadata.originalFileName,
        Origin: metadata.Origin,
        Counterparty: metadata.Counterparty,
        LinkedDealId: metadata.LinkedDealId,
        LinkedProjectId: projectId,
      },
      file,
    });

    const [project, documents] = await Promise.all([
      readProjectById(projectId),
      readSmartDocsForProject(projectId),
    ]);

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const company = project.linkedCompanyId
      ? await resolveCompanyForSmartDocs(project.linkedCompanyId)
      : undefined;
    const context = buildProjectDocumentContext(project, company);

    return NextResponse.json({
      context,
      document: imported.libraryRecord,
      documents,
      documentRecordId: imported.documentRecordId,
      sharepointWebUrl: imported.sharepointWebUrl,
    }, { status: 201 });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
