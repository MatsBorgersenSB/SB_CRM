import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { buildDealDocumentContext } from "@/lib/deal-document-context";
import { buildSmartDocIdentityPreview } from "@/lib/smartdoc-identity";
import { canUploadSmartDocs } from "@/lib/permissions";
import {
  readCommercialPackages,
  readCompanies,
  readSmartDocsLibrary,
  readSmartDocsForDeal,
  resolvePipelineForSmartDocs,
} from "@/lib/pipeline-db";
import { importOpportunitySmartDoc } from "@/lib/smartdoc-import";
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
    const DocumentSetID =
      String(form.get("DocumentSetID") ?? "").trim() || undefined;
    const Origin = normalizeSmartDocOrigin(String(form.get("Origin") ?? ""));
    const Counterparty = String(form.get("Counterparty") ?? "").trim() || undefined;
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
        DocumentSetID,
        Origin,
        Counterparty,
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
      DocumentSetID: body.DocumentSetID,
      Origin: normalizeSmartDocOrigin(body.Origin),
      Counterparty: body.Counterparty?.trim() || undefined,
    },
    file,
  };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const previewCategory = searchParams.get("category");
  const previewType = searchParams.get("type");

  try {
    const [pipeline, companies, packages, documents, library] = await Promise.all([
      resolvePipelineForSmartDocs(id),
      readCompanies(),
      readCommercialPackages(),
      readSmartDocsForDeal(id),
      readSmartDocsLibrary(),
    ]);

    if (!pipeline) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const context = buildDealDocumentContext(pipeline, companies, packages);

    let identityPreview = null;
    if (
      previewCategory &&
      previewType &&
      SMARTDOC_CATEGORIES.includes(previewCategory as SmartDocCategory)
    ) {
      identityPreview = buildSmartDocIdentityPreview(
        context.plNumber,
        context.dealName,
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
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const role = getRequestRole(request);

  if (!canUploadSmartDocs(role)) {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden("You cannot upload SmartDocs for this deal"),
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

    const imported = await importOpportunitySmartDoc({
      dealId: id,
      metadata: {
        DocCategory: metadata.DocCategory,
        DocType: metadata.DocType.trim(),
        DocumentName: metadata.DocumentName.trim(),
        originalFileName: metadata.originalFileName,
        DocumentSetID: metadata.DocumentSetID,
        Origin: metadata.Origin,
        Counterparty: metadata.Counterparty,
      },
      file,
    });

    const [pipeline, companies, packages, documents] = await Promise.all([
      resolvePipelineForSmartDocs(id),
      readCompanies(),
      readCommercialPackages(),
      readSmartDocsForDeal(id),
    ]);

    if (!pipeline) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const context = buildDealDocumentContext(pipeline, companies, packages);

    return NextResponse.json({
      context,
      document: imported.libraryRecord,
      documents,
      documentRecordId: imported.documentRecordId,
      sharepointWebUrl: imported.sharepointWebUrl,
      existingIdentityIds: (await readSmartDocsLibrary()).map((row) => row.SmartDocID),
    });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
