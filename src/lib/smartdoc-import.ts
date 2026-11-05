import "server-only";

import { getPrisma } from "@/lib/prisma";
import { getGraphAccessToken } from "@/lib/m365/get-graph-access-token";
import {
  applySmartDocFieldsToDriveItem,
  createSharePointFolderUploadSession,
  ensureCompanyDocumentsSharePointFolder,
  ensureOpportunitySharePointFolder,
  ensureProjectSharePointFolder,
  uploadFileToSharePointFolder,
  type SharePointUploadSession,
} from "@/lib/m365/graph-client";
import { linkOpportunitySharePointFolder } from "@/lib/m365/provision-opportunity-folder";
import {
  createCompanySmartDocLibraryRecord,
  createProjectSmartDocLibraryRecord,
  createSmartDocLibraryRecord,
  resolveCompanyForSmartDocs,
  resolvePipelineForSmartDocs,
  updateSmartDocLibraryRecord,
} from "@/lib/pipeline-db";
import { readProjectById } from "@/lib/project-db";
import { isGraphTransport } from "@/services/sharepoint/config/environment";
import {
  extractTextFromDocumentBytes,
  looksLikeImage,
} from "@/lib/document-text-extract";
import {
  appendSourceFinding,
  createSourceFinding,
  extractDocumentMetadataClaims,
  extractSourceFindingPreview,
  type SourceFindingClaim,
} from "@/lib/source-findings";
import { patchSourceFindings } from "@/lib/opportunity-understanding-model";
import { mapPrismaOpportunityToPipelineRow } from "@/lib/prisma-mappers";
import { smartDocHref } from "@/types/smartdoc";
import type { Prisma } from "@/generated/prisma";
import type {
  CreateSmartDocInput,
  SmartDocLibraryRecord,
} from "@/types/smartdoc-library";

export type ImportedOpportunitySmartDoc = {
  libraryRecord: SmartDocLibraryRecord;
  documentRecordId: string | null;
  sharepointWebUrl: string | null;
};

export type ImportedCompanySmartDoc = {
  libraryRecord: SmartDocLibraryRecord;
  documentRecordId: string | null;
  sharepointWebUrl: string | null;
};

export type ImportedProjectSmartDoc = {
  libraryRecord: SmartDocLibraryRecord;
  documentRecordId: string | null;
  sharepointWebUrl: string | null;
};

/** File already stored in SharePoint — SmartCRM only stamps metadata. */
export type FiledSharePointSmartDoc = {
  itemId: string;
  webUrl: string;
  sizeBytes: number;
  mimeType: string | null;
  originalFileName: string;
};

export type SmartDocUploadScope =
  | { kind: "opportunity"; dealId: string }
  | { kind: "company"; companyId: string }
  | { kind: "project"; projectId: string };

export function filedSharePointFromJson(
  body: Record<string, unknown>,
): FiledSharePointSmartDoc | undefined {
  const itemId =
    typeof body.sharepointItemId === "string" ? body.sharepointItemId.trim() : "";
  const webUrl =
    typeof body.sharepointWebUrl === "string" ? body.sharepointWebUrl.trim() : "";
  if (!itemId || !webUrl) return undefined;
  const sizeRaw = body.sizeBytes;
  const sizeBytes =
    typeof sizeRaw === "number"
      ? sizeRaw
      : typeof sizeRaw === "string"
        ? Number(sizeRaw)
        : 0;
  return {
    itemId,
    webUrl,
    sizeBytes: Number.isFinite(sizeBytes) && sizeBytes >= 0 ? sizeBytes : 0,
    mimeType:
      typeof body.mimeType === "string" && body.mimeType.trim()
        ? body.mimeType
        : null,
    originalFileName:
      typeof body.originalFileName === "string" && body.originalFileName.trim()
        ? body.originalFileName.trim()
        : "document",
  };
}

type GraphUploadTarget = {
  accessToken: string;
  siteId: string;
  folderId: string;
  folderPath?: string;
};

async function requireGraphUploadTarget(): Promise<{
  accessToken: string;
  siteId: string;
}> {
  if (!isGraphTransport()) {
    throw new Error("GRAPH_UNAVAILABLE");
  }
  const siteId = process.env.SHAREPOINT_SITE_ID?.trim();
  if (!siteId) {
    throw new Error("GRAPH_UNAVAILABLE");
  }
  const accessToken = await getGraphAccessToken();
  return { accessToken, siteId };
}

async function resolveOpportunityGraphFolder(
  dealId: string,
): Promise<GraphUploadTarget> {
  const { accessToken, siteId } = await requireGraphUploadTarget();
  const pipeline = await resolvePipelineForSmartDocs(dealId);
  if (!pipeline) {
    throw new Error(`Pipeline not found: ${dealId}`);
  }

  const prisma = getPrisma();
  const opportunity = await prisma.opportunity.findUnique({
    where: { id: pipeline.id },
    select: {
      id: true,
      name: true,
      sharepointFolderId: true,
      company: { select: { name: true } },
    },
  });
  if (!opportunity) {
    throw new Error(`Pipeline not found: ${dealId}`);
  }

  let folderId = opportunity.sharepointFolderId;
  let folderPath: string | undefined;
  if (!folderId) {
    const folder = await ensureOpportunitySharePointFolder(
      accessToken,
      siteId,
      opportunity.company?.name || pipeline.ClientLookup || "General Clients",
      opportunity.name || pipeline.assetName,
    );
    await linkOpportunitySharePointFolder(opportunity.id, folder);
    folderId = folder.folderId;
    folderPath = folder.path;
  }

  return { accessToken, siteId, folderId, folderPath };
}

async function resolveCompanyGraphFolder(
  companyId: string,
): Promise<GraphUploadTarget> {
  const { accessToken, siteId } = await requireGraphUploadTarget();
  const company = await resolveCompanyForSmartDocs(companyId);
  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }
  const folder = await ensureCompanyDocumentsSharePointFolder(
    accessToken,
    siteId,
    company.Title,
  );
  return {
    accessToken,
    siteId,
    folderId: folder.folderId,
    folderPath: folder.path,
  };
}

async function resolveProjectGraphFolder(
  projectId: string,
): Promise<GraphUploadTarget> {
  const { accessToken, siteId } = await requireGraphUploadTarget();
  const project = await readProjectById(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  let companyName: string | undefined;
  if (project.linkedCompanyId?.trim()) {
    const company = await resolveCompanyForSmartDocs(
      project.linkedCompanyId,
    ).catch(() => undefined);
    companyName = company?.Title;
  }

  const folder = await ensureProjectSharePointFolder(
    accessToken,
    siteId,
    project.name,
    companyName,
  );
  return {
    accessToken,
    siteId,
    folderId: folder.folderId,
    folderPath: folder.path,
  };
}

/**
 * Open a Graph upload session in the workspace SharePoint folder.
 * The browser (or a small chunk proxy) then sends the file to SharePoint directly.
 */
export async function beginSmartDocSharePointUpload(input: {
  scope: SmartDocUploadScope;
  fileName: string;
}): Promise<SharePointUploadSession & { folderPath?: string }> {
  const target =
    input.scope.kind === "opportunity"
      ? await resolveOpportunityGraphFolder(input.scope.dealId)
      : input.scope.kind === "company"
        ? await resolveCompanyGraphFolder(input.scope.companyId)
        : await resolveProjectGraphFolder(input.scope.projectId);

  const session = await createSharePointFolderUploadSession({
    accessToken: target.accessToken,
    siteId: target.siteId,
    folderId: target.folderId,
    fileName: input.fileName,
  });

  return { ...session, folderPath: target.folderPath };
}

async function stampSharePointSmartDocFields(input: {
  itemId: string;
  DocCategory: string;
  DocType: string;
}): Promise<void> {
  if (!isGraphTransport()) return;
  const siteId = process.env.SHAREPOINT_SITE_ID?.trim();
  if (!siteId || !input.itemId.trim() || !input.DocCategory.trim() || !input.DocType.trim()) {
    return;
  }
  try {
    const accessToken = await getGraphAccessToken();
    await applySmartDocFieldsToDriveItem({
      accessToken,
      siteId,
      itemId: input.itemId,
      fields: {
        DocCategory: input.DocCategory,
        DocType: input.DocType,
      },
    });
  } catch (error) {
    console.warn(
      "[SharePoint] File uploaded but Doc Category / Doc Type were not written:",
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * Create SmartDoc library metadata and, when a file is provided + Graph is on,
 * push the binary into the opportunity SharePoint folder (document SoT).
 */
export async function importOpportunitySmartDoc(input: {
  dealId: string;
  metadata: CreateSmartDocInput;
  file?: {
    bytes: Buffer;
    mimeType: string | null;
    originalFileName: string;
  };
  sharePoint?: FiledSharePointSmartDoc;
}): Promise<ImportedOpportunitySmartDoc> {
  const pipeline = await resolvePipelineForSmartDocs(input.dealId);
  if (!pipeline) {
    throw new Error(`Pipeline not found: ${input.dealId}`);
  }

  const metadata: CreateSmartDocInput = {
    ...input.metadata,
    originalFileName:
      input.metadata.originalFileName ??
      input.sharePoint?.originalFileName ??
      input.file?.originalFileName ??
      undefined,
  };

  const libraryRecord = await createSmartDocLibraryRecord(pipeline.id, metadata);
  const filed = input.sharePoint;

  if (!filed && !input.file?.bytes?.length) {
    return {
      libraryRecord,
      documentRecordId: null,
      sharepointWebUrl: null,
    };
  }

  const fileName =
    libraryRecord.FileLeafRef?.trim() ||
    filed?.originalFileName ||
    input.file?.originalFileName ||
    libraryRecord.DocumentName;

  let sharepointItemId: string | null = filed?.itemId ?? null;
  let sharepointWebUrl: string | null = filed?.webUrl ?? null;
  let contentBase64: string | null =
    filed || !input.file?.bytes?.length
      ? null
      : input.file.bytes.toString("base64");

  if (filed) {
    await stampSharePointSmartDocFields({
      itemId: filed.itemId,
      DocCategory: libraryRecord.DocCategory,
      DocType: libraryRecord.DocType,
    });
  } else if (input.file?.bytes?.length && isGraphTransport()) {
    const siteId = process.env.SHAREPOINT_SITE_ID?.trim();
    if (siteId) {
      try {
        const target = await resolveOpportunityGraphFolder(pipeline.id);
        const uploaded = await uploadFileToSharePointFolder({
          accessToken: target.accessToken,
          siteId: target.siteId,
          folderId: target.folderId,
          fileName,
          contentType: input.file.mimeType || "application/octet-stream",
          bytes: input.file.bytes,
          fields: {
            DocCategory: libraryRecord.DocCategory,
            DocType: libraryRecord.DocType,
          },
        });

        sharepointItemId = uploaded.itemId;
        sharepointWebUrl = uploaded.webUrl;
        contentBase64 = null;
      } catch (error) {
        console.warn(
          "[SmartDocs import] SharePoint upload failed — keeping library record:",
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  try {
    const prisma = getPrisma();
    const document = await prisma.documentRecord.create({
      data: {
        name: fileName,
        mimeType: filed?.mimeType ?? input.file?.mimeType ?? null,
        sizeBytes: filed?.sizeBytes ?? input.file?.bytes.length ?? 0,
        source: "upload",
        contentBase64,
        sharepointItemId,
        sharepointWebUrl,
        opportunityId: pipeline.id,
      },
    });

    // Flow imported document/picture into Opportunity understanding as a proposed finding
    try {
      const oppRow = await prisma.opportunity.findUnique({
        where: { id: pipeline.id },
        include: { company: { select: { id: true, name: true } } },
      });
      if (oppRow) {
        const mapped = mapPrismaOpportunityToPipelineRow(oppRow);
        const docUrl = document.sharepointWebUrl || smartDocHref(document.id);
        const cleanTitle =
          fileName
            .replace(/\.[^.]+$/, "")
            .replace(/^(?:PL|CO|PRJ)-\d+-[A-Z]-[A-Z]+-\d+\s*/i, "")
            .trim() || fileName;
        const metaClaims = extractDocumentMetadataClaims({
          name: fileName,
          mimeType: document.mimeType,
          docCategory: libraryRecord.DocCategory,
          docType: libraryRecord.DocType,
          origin: libraryRecord.Origin,
          counterparty: libraryRecord.Counterparty,
        });
        let contentClaims: SourceFindingClaim[] = [];
        if (input.file?.bytes?.length && input.file.bytes.length <= 15_000_000) {
          const extracted = await extractTextFromDocumentBytes({
            bytes: input.file.bytes,
            name: fileName,
            mimeType: document.mimeType,
          });
          if (extracted.text.length >= 20) {
            contentClaims = extractSourceFindingPreview(
              extracted.text,
              docUrl,
              cleanTitle,
            ).claims.filter((c) => c.id !== "attached");
          }
        }
        const mergedClaims = [...contentClaims, ...metaClaims].slice(0, 8);
        if (mergedClaims.length > 0) {
          const isImg = looksLikeImage({
            name: fileName,
            mimeType: document.mimeType,
            bytes: input.file?.bytes,
          });
          const nextFindings = appendSourceFinding(
            mapped.understanding?.findings,
            createSourceFinding({
              title: cleanTitle,
              url: docUrl,
              note: fileName,
              kind: isImg ? "image" : "document",
              claims: mergedClaims,
            }),
          );
          const nextUnderstanding = patchSourceFindings(
            mapped.understanding,
            nextFindings,
          );
          await prisma.opportunity.update({
            where: { id: oppRow.id },
            data: {
              understanding: nextUnderstanding as unknown as Prisma.InputJsonValue,
            },
          });
        }
      }
    } catch (findingErr) {
      console.warn(
        "[SmartDocs import] Opportunity finding sync skipped:",
        findingErr instanceof Error ? findingErr.message : findingErr,
      );
    }

    return {
      libraryRecord: sharepointWebUrl
        ? await updateSmartDocLibraryRecord(libraryRecord.SmartDocID, {
            SharePointWebUrl: sharepointWebUrl,
          }).catch(() => libraryRecord)
        : libraryRecord,
      documentRecordId: document.id,
      sharepointWebUrl: document.sharepointWebUrl,
    };
  } catch (error) {
    console.warn(
      "[SmartDocs import] DocumentRecord create failed:",
      error instanceof Error ? error.message : error,
    );
    return {
      libraryRecord,
      documentRecordId: null,
      sharepointWebUrl,
    };
  }
}

/**
 * Company-owned SmartDoc import (FS-006).
 * Never invents a deal. Files target `/Companies/{Name}/Documents/` when Graph is on.
 */
export async function importCompanySmartDoc(input: {
  companyId: string;
  metadata: CreateSmartDocInput;
  file?: {
    bytes: Buffer;
    mimeType: string | null;
    originalFileName: string;
  };
  sharePoint?: FiledSharePointSmartDoc;
}): Promise<ImportedCompanySmartDoc> {
  const company = await resolveCompanyForSmartDocs(input.companyId);
  if (!company) {
    throw new Error(`Company not found: ${input.companyId}`);
  }

  const metadata: CreateSmartDocInput = {
    ...input.metadata,
    originalFileName:
      input.metadata.originalFileName ??
      input.sharePoint?.originalFileName ??
      input.file?.originalFileName ??
      undefined,
  };

  let libraryRecord = await createCompanySmartDocLibraryRecord(
    company.CompanyID,
    metadata,
  );

  const filed = input.sharePoint;
  if (!filed && !input.file?.bytes?.length) {
    return {
      libraryRecord,
      documentRecordId: null,
      sharepointWebUrl: null,
    };
  }

  const fileName =
    libraryRecord.FileLeafRef?.trim() ||
    filed?.originalFileName ||
    input.file?.originalFileName ||
    libraryRecord.DocumentName;

  let sharepointItemId: string | null = filed?.itemId ?? null;
  let sharepointWebUrl: string | null = filed?.webUrl ?? null;
  let contentBase64: string | null =
    filed || !input.file?.bytes?.length
      ? null
      : input.file.bytes.toString("base64");

  if (filed) {
    await stampSharePointSmartDocFields({
      itemId: filed.itemId,
      DocCategory: libraryRecord.DocCategory,
      DocType: libraryRecord.DocType,
    });
    libraryRecord = await updateSmartDocLibraryRecord(libraryRecord.SmartDocID, {
      SharePointWebUrl: filed.webUrl,
    }).catch(() => libraryRecord);
  } else if (input.file?.bytes?.length && isGraphTransport()) {
    const siteId = process.env.SHAREPOINT_SITE_ID?.trim();
    if (siteId) {
      try {
        const target = await resolveCompanyGraphFolder(company.CompanyID);
        const uploaded = await uploadFileToSharePointFolder({
          accessToken: target.accessToken,
          siteId: target.siteId,
          folderId: target.folderId,
          fileName,
          contentType: input.file.mimeType || "application/octet-stream",
          bytes: input.file.bytes,
          fields: {
            DocCategory: libraryRecord.DocCategory,
            DocType: libraryRecord.DocType,
          },
        });
        sharepointItemId = uploaded.itemId;
        sharepointWebUrl = uploaded.webUrl;
        contentBase64 = null;

        libraryRecord = await updateSmartDocLibraryRecord(libraryRecord.SmartDocID, {
          SharePointFolderPath: target.folderPath,
          SharePointWebUrl: sharepointWebUrl,
        });
      } catch (error) {
        console.warn(
          "[Company SmartDocs import] SharePoint upload failed — keeping library record:",
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  try {
    const prisma = getPrisma();
    const { findPrismaCompanyByRouteKey } = await import(
      "@/lib/resolve-company-route"
    );
    const prismaCompany = await findPrismaCompanyByRouteKey(company.CompanyID);

    const document = await prisma.documentRecord.create({
      data: {
        name: fileName,
        mimeType: filed?.mimeType ?? input.file?.mimeType ?? null,
        sizeBytes: filed?.sizeBytes ?? input.file?.bytes.length ?? 0,
        source: "upload",
        contentBase64,
        sharepointItemId,
        sharepointWebUrl,
        opportunityId: null,
        ...(prismaCompany?.id ? { companyId: prismaCompany.id } : {}),
      },
    });

    return {
      libraryRecord,
      documentRecordId: document.id,
      sharepointWebUrl: document.sharepointWebUrl ?? sharepointWebUrl,
    };
  } catch (error) {
    console.warn(
      "[Company SmartDocs import] DocumentRecord create failed:",
      error instanceof Error ? error.message : error,
    );
    return {
      libraryRecord,
      documentRecordId: null,
      sharepointWebUrl,
    };
  }
}

/**
 * Project-owned SmartDoc import.
 * Never invents a deal. Files target /Projects/{Name} (or /Projects/{Company}/{Name}) when Graph is on.
 */
export async function importProjectSmartDoc(input: {
  projectId: string;
  metadata: CreateSmartDocInput;
  file?: {
    bytes: Buffer;
    mimeType: string | null;
    originalFileName: string;
  };
  sharePoint?: FiledSharePointSmartDoc;
}): Promise<ImportedProjectSmartDoc> {
  const project = await readProjectById(input.projectId);
  if (!project) {
    throw new Error(`Project not found: ${input.projectId}`);
  }

  const metadata: CreateSmartDocInput = {
    ...input.metadata,
    originalFileName:
      input.metadata.originalFileName ??
      input.sharePoint?.originalFileName ??
      input.file?.originalFileName ??
      undefined,
    LinkedProjectId: project.id,
    LinkedDealId: input.metadata.LinkedDealId?.trim() || undefined,
  };

  let libraryRecord = await createProjectSmartDocLibraryRecord(
    project.id,
    metadata,
  );

  const filed = input.sharePoint;
  if (!filed && !input.file?.bytes?.length) {
    return {
      libraryRecord,
      documentRecordId: null,
      sharepointWebUrl: null,
    };
  }

  const fileName =
    libraryRecord.FileLeafRef?.trim() ||
    filed?.originalFileName ||
    input.file?.originalFileName ||
    libraryRecord.DocumentName;

  let sharepointItemId: string | null = filed?.itemId ?? null;
  let sharepointWebUrl: string | null = filed?.webUrl ?? null;
  let contentBase64: string | null =
    filed || !input.file?.bytes?.length
      ? null
      : input.file.bytes.toString("base64");

  if (filed) {
    await stampSharePointSmartDocFields({
      itemId: filed.itemId,
      DocCategory: libraryRecord.DocCategory,
      DocType: libraryRecord.DocType,
    });
    libraryRecord = await updateSmartDocLibraryRecord(libraryRecord.SmartDocID, {
      SharePointWebUrl: filed.webUrl,
    }).catch(() => libraryRecord);
  } else if (input.file?.bytes?.length && isGraphTransport()) {
    const siteId = process.env.SHAREPOINT_SITE_ID?.trim();
    if (siteId) {
      try {
        const target = await resolveProjectGraphFolder(project.id);
        const uploaded = await uploadFileToSharePointFolder({
          accessToken: target.accessToken,
          siteId: target.siteId,
          folderId: target.folderId,
          fileName,
          contentType: input.file.mimeType || "application/octet-stream",
          bytes: input.file.bytes,
          fields: {
            DocCategory: libraryRecord.DocCategory,
            DocType: libraryRecord.DocType,
          },
        });
        sharepointItemId = uploaded.itemId;
        sharepointWebUrl = uploaded.webUrl;
        contentBase64 = null;

        libraryRecord = await updateSmartDocLibraryRecord(libraryRecord.SmartDocID, {
          SharePointFolderPath: target.folderPath,
          SharePointWebUrl: sharepointWebUrl,
        });
      } catch (error) {
        console.warn(
          "[Project SmartDocs import] SharePoint upload failed — keeping library record:",
          error instanceof Error ? error.message : error,
        );
      }
    }
  }

  try {
    const prisma = getPrisma();
    let companyId: string | undefined;
    if (project.linkedCompanyId?.trim()) {
      const { findPrismaCompanyByRouteKey } = await import(
        "@/lib/resolve-company-route"
      );
      const prismaCompany = await findPrismaCompanyByRouteKey(
        project.linkedCompanyId,
      );
      companyId = prismaCompany?.id;
    }

    const document = await prisma.documentRecord.create({
      data: {
        name: fileName,
        mimeType: filed?.mimeType ?? input.file?.mimeType ?? null,
        sizeBytes: filed?.sizeBytes ?? input.file?.bytes.length ?? 0,
        source: "upload",
        contentBase64,
        sharepointItemId,
        sharepointWebUrl,
        opportunityId: null,
        ...(companyId ? { companyId } : {}),
      },
    });

    return {
      libraryRecord,
      documentRecordId: document.id,
      sharepointWebUrl: document.sharepointWebUrl ?? sharepointWebUrl,
    };
  } catch (error) {
    console.warn(
      "[Project SmartDocs import] DocumentRecord create failed:",
      error instanceof Error ? error.message : error,
    );
    return {
      libraryRecord,
      documentRecordId: null,
      sharepointWebUrl,
    };
  }
}
