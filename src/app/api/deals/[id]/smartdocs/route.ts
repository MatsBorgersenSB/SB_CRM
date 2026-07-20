import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { buildDealDocumentContext } from "@/lib/deal-document-context";
import { buildSmartDocIdentityPreview } from "@/lib/smartdoc-identity";
import { canUploadSmartDocs } from "@/lib/permissions";
import {
  createSmartDocLibraryRecord,
  readCommercialPackages,
  readCompanies,
  readPipelines,
  readSmartDocsLibrary,
  readSmartDocsForDeal,
} from "@/lib/pipeline-db";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";
import type { CreateSmartDocInput, SmartDocCategory } from "@/types/smartdoc-library";
import { SMARTDOC_CATEGORIES } from "@/types/smartdoc-library";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const previewCategory = searchParams.get("category");
  const previewType = searchParams.get("type");

  try {
    const [pipelines, companies, packages, documents, library] = await Promise.all([
      readPipelines(),
      readCompanies(),
      readCommercialPackages(),
      readSmartDocsForDeal(id),
      readSmartDocsLibrary(),
    ]);

    const pipeline = pipelines.find((row) => row.id === id);
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
    const body = (await request.json()) as CreateSmartDocInput;

    if (
      !body.DocCategory ||
      !SMARTDOC_CATEGORIES.includes(body.DocCategory as SmartDocCategory) ||
      !body.DocType?.trim() ||
      !body.DocumentName?.trim()
    ) {
      return NextResponse.json(
        { error: "DocCategory, DocType, and DocumentName are required" },
        { status: 400 },
      );
    }

    const record = await createSmartDocLibraryRecord(id, {
      DocCategory: body.DocCategory,
      DocType: body.DocType.trim(),
      DocumentName: body.DocumentName.trim(),
      originalFileName: body.originalFileName,
      DocumentSetID: body.DocumentSetID,
    });

    const [pipelines, companies, packages, documents] = await Promise.all([
      readPipelines(),
      readCompanies(),
      readCommercialPackages(),
      readSmartDocsForDeal(id),
    ]);

    const pipeline = pipelines.find((row) => row.id === id);
    if (!pipeline) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const context = buildDealDocumentContext(pipeline, companies, packages);

    return NextResponse.json({
      context,
      document: record,
      documents,
      existingIdentityIds: (await readSmartDocsLibrary()).map((row) => row.SmartDocID),
    });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
