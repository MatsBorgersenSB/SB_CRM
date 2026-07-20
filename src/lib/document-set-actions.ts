import { findCompanyForDeal } from "@/lib/opportunity-intelligence-engine";
import {
  createCommercialPackage,
  readCommercialPackagesForDeal,
  readCompanies,
  readPipelines,
  updateCommercialPackage,
  updateSmartDocLibraryRecord,
} from "@/lib/pipeline-db";
import { buildDocumentSets } from "@/lib/document-set-engine";
import type { CommercialPackage } from "@/types/commercial-package";
import type { CreateDocumentSetInput, DocumentSet } from "@/types/document-set";
import { documentSetTypeLabel } from "@/types/document-set";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";
import type { DocumentSetMemberRole } from "@/types/commercial-package";

function inferMemberRole(record: SmartDocLibraryRecord): DocumentSetMemberRole {
  if (record.DocCategory === "Commercial") return "quotation";
  if (record.DocCategory === "Technical") return "technical";
  return "attachment";
}

export async function createDocumentSet(
  dealId: string,
  input: CreateDocumentSetInput,
): Promise<CommercialPackage> {
  const [pipelines, companies] = await Promise.all([readPipelines(), readCompanies()]);
  const pipeline = pipelines.find((row) => row.id === dealId);
  if (!pipeline) {
    throw new Error(`Deal not found: ${dealId}`);
  }

  const company = findCompanyForDeal(dealId, companies);
  const title =
    input.title?.trim() ||
    `${documentSetTypeLabel(input.kind)} — ${pipeline.assetName ?? dealId}`;

  return createCommercialPackage({
    DealId: dealId,
    ClientName: company?.Title,
    kind: input.kind,
    status: "draft",
    title,
    members: [],
    CreatedBy: input.createdBy ?? "SmartCRM",
  });
}

export async function listDocumentSetsForDeal(dealId: string): Promise<DocumentSet[]> {
  const [packages, companies, pipelines] = await Promise.all([
    readCommercialPackagesForDeal(dealId),
    readCompanies(),
    readPipelines(),
  ]);

  return buildDocumentSets(packages, companies, pipelines);
}

export async function assignDocumentToSet(
  smartDocId: string,
  documentSetId: string,
): Promise<SmartDocLibraryRecord> {
  const record = await updateSmartDocLibraryRecord(smartDocId, {
    DocumentSetID: documentSetId,
  });

  const packages = await readCommercialPackagesForDeal(record.DealId ?? "");
  const pkg = packages.find((item) => item.DocumentSetID === documentSetId);
  if (!pkg) {
    throw new Error(`Document set not found: ${documentSetId}`);
  }

  const alreadyMember = pkg.members.some(
    (member) => member.fileName === record.FileLeafRef,
  );
  if (!alreadyMember) {
    await updateCommercialPackage(pkg.PackageID, {
      members: [
        ...pkg.members,
        {
          role: inferMemberRole(record),
          Title: record.FileLeafRef,
          fileName: record.FileLeafRef,
          DocCategory: record.DocCategory,
          Revision: record.Revision,
          DealId: record.DealId,
        },
      ],
    });
  }

  return record;
}
