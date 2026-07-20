import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import {
  assignDocumentToSet,
  createDocumentSet,
  listDocumentSetsForDeal,
} from "@/lib/document-set-actions";
import { canUploadSmartDocs } from "@/lib/permissions";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";
import type { CreateDocumentSetInput, QuotationDocumentSetKind } from "@/types/document-set";
import { QUOTATION_DOCUMENT_SET_KINDS } from "@/types/document-set";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const documentSets = await listDocumentSetsForDeal(id);
    return NextResponse.json({ documentSets });
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
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as CreateDocumentSetInput;

    if (!body.kind || !QUOTATION_DOCUMENT_SET_KINDS.includes(body.kind)) {
      return NextResponse.json(
        { error: "kind must be price_indication, budget_quotation, or formal_quotation" },
        { status: 400 },
      );
    }

    const pkg = await createDocumentSet(id, {
      kind: body.kind as QuotationDocumentSetKind,
      title: body.title,
      createdBy: body.createdBy,
    });

    const documentSets = await listDocumentSetsForDeal(id);
    const created = documentSets.find((set) => set.documentSetId === pkg.DocumentSetID);

    return NextResponse.json({ package: pkg, documentSet: created ?? null, documentSets });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
