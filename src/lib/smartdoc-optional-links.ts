import { getPrisma } from "@/lib/prisma";
import { updateSmartDocLibraryRecord } from "@/lib/pipeline-db";
import { parseSmartDocIdentityFromFileName } from "@/lib/smartdoc-identity";
import { isCompanyOwnedSmartDoc, type SmartDocLibraryRecord } from "@/types/smartdoc-library";

export type SmartDocOptionalLinksPatch = {
  LinkedDealId?: string | null;
  LinkedProjectId?: string | null;
};

/**
 * FS-006 Phase 2 — link a company-owned SmartDoc to an opportunity/project
 * without changing ownership. Updates JSON library and Prisma when present.
 */
export async function patchSmartDocOptionalLinks(
  documentId: string,
  patch: SmartDocOptionalLinksPatch,
): Promise<SmartDocLibraryRecord> {
  const linkedDeal =
    patch.LinkedDealId === undefined
      ? undefined
      : patch.LinkedDealId?.trim() || null;
  const linkedProject =
    patch.LinkedProjectId === undefined
      ? undefined
      : patch.LinkedProjectId?.trim() || null;

  let libraryRecord: SmartDocLibraryRecord | null = null;
  try {
    libraryRecord = await updateSmartDocLibraryRecord(documentId, {
      ...(linkedDeal !== undefined ? { LinkedDealId: linkedDeal } : {}),
      ...(linkedProject !== undefined ? { LinkedProjectId: linkedProject } : {}),
    });
  } catch {
    libraryRecord = null;
  }

  if (libraryRecord && !isCompanyOwnedSmartDoc(libraryRecord)) {
    throw new Error(
      "Only company-owned SmartDocs can take optional opportunity/project links.",
    );
  }

  let prismaUpdated = false;
  try {
    const prisma = getPrisma();
    const byId = await prisma.documentRecord.findUnique({
      where: { id: documentId },
      select: {
        id: true,
        name: true,
        companyId: true,
        opportunityId: true,
      },
    });

    let match = byId;
    if (!match) {
      const candidates = await prisma.documentRecord.findMany({
        where: {
          OR: [
            { name: { startsWith: documentId } },
            { name: { contains: documentId } },
          ],
        },
        select: {
          id: true,
          name: true,
          companyId: true,
          opportunityId: true,
        },
        take: 20,
      });
      match =
        candidates.find((row) => {
          const identity = parseSmartDocIdentityFromFileName(row.name);
          return identity?.documentId === documentId;
        }) ?? null;
    }

    if (match) {
      if (match.opportunityId && !match.companyId) {
        throw new Error(
          "Only company-owned SmartDocs can take optional opportunity/project links.",
        );
      }
      await prisma.documentRecord.update({
        where: { id: match.id },
        data: {
          ...(linkedDeal !== undefined
            ? { linkedOpportunityId: linkedDeal }
            : {}),
          ...(linkedProject !== undefined
            ? { linkedProjectId: linkedProject }
            : {}),
        },
      });
      prismaUpdated = true;
    }
  } catch (error) {
    if (
      error instanceof Error &&
      /company-owned/i.test(error.message)
    ) {
      throw error;
    }
    // Prisma may be unavailable in local JSON-only mode — library update is enough.
  }

  if (!libraryRecord && !prismaUpdated) {
    throw new Error(`SmartDoc not found: ${documentId}`);
  }

  if (libraryRecord) return libraryRecord;

  return {
    id: 0,
    SmartDocID: documentId,
    DealId: null,
    Ownership: "company",
    PlNumber: "",
    ClientName: "",
    DealName: "",
    CommercialStage: "",
    CreatedAt: new Date().toISOString(),
    DocCategory: "General",
    DocType: "Memo",
    DocumentName: documentId,
    Revision: "01",
    FileLeafRef: documentId,
    LinkedDealId: linkedDeal ?? null,
    LinkedProjectId: linkedProject ?? null,
  };
}
