import "server-only";

import { getPrisma } from "@/lib/prisma";
import { getGraphAccessToken } from "@/lib/m365/get-graph-access-token";
import {
  ensureCompanyDocumentsSharePointFolder,
  ensureOpportunitySharePointFolder,
  ensureProjectSharePointFolder,
  uploadFileToSharePointFolder,
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
}): Promise<ImportedOpportunitySmartDoc> {
  const pipeline = await resolvePipelineForSmartDocs(input.dealId);
  if (!pipeline) {
    throw new Error(`Pipeline not found: ${input.dealId}`);
  }

  const metadata: CreateSmartDocInput = {
    ...input.metadata,
    originalFileName:
      input.metadata.originalFileName ??
      input.file?.originalFileName ??
      undefined,
  };

  const libraryRecord = await createSmartDocLibraryRecord(pipeline.id, metadata);

  if (!input.file?.bytes?.length) {
    return {
      libraryRecord,
      documentRecordId: null,
      sharepointWebUrl: null,
    };
  }

  const fileName =
    libraryRecord.FileLeafRef?.trim() ||
    input.file.originalFileName ||
    libraryRecord.DocumentName;

  let sharepointItemId: string | null = null;
  let sharepointWebUrl: string | null = null;
  let contentBase64: string | null = input.file.bytes.toString("base64");

  if (isGraphTransport()) {
    const siteId = process.env.SHAREPOINT_SITE_ID?.trim();
    if (siteId) {
      try {
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

        if (opportunity) {
          const accessToken = await getGraphAccessToken();
          let folderId = opportunity.sharepointFolderId;

          if (!folderId) {
            const folder = await ensureOpportunitySharePointFolder(
              accessToken,
              siteId,
              opportunity.company?.name ||
                pipeline.ClientLookup ||
                "General Clients",
              opportunity.name || pipeline.assetName,
            );
            await linkOpportunitySharePointFolder(opportunity.id, folder);
            folderId = folder.folderId;
          }

          const uploaded = await uploadFileToSharePointFolder({
            accessToken,
            siteId,
            folderId,
            fileName,
            contentType: input.file.mimeType || "application/octet-stream",
            bytes: input.file.bytes,
          });

          sharepointItemId = uploaded.itemId;
          sharepointWebUrl = uploaded.webUrl;
          contentBase64 = null;
        }
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
        mimeType: input.file.mimeType,
        sizeBytes: input.file.bytes.length,
        source: "upload",
        contentBase64,
        sharepointItemId,
        sharepointWebUrl,
        opportunityId: pipeline.id,
      },
    });

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
}): Promise<ImportedCompanySmartDoc> {
  const company = await resolveCompanyForSmartDocs(input.companyId);
  if (!company) {
    throw new Error(`Company not found: ${input.companyId}`);
  }

  const metadata: CreateSmartDocInput = {
    ...input.metadata,
    originalFileName:
      input.metadata.originalFileName ??
      input.file?.originalFileName ??
      undefined,
  };

  let libraryRecord = await createCompanySmartDocLibraryRecord(
    company.CompanyID,
    metadata,
  );

  if (!input.file?.bytes?.length) {
    return {
      libraryRecord,
      documentRecordId: null,
      sharepointWebUrl: null,
    };
  }

  const fileName =
    libraryRecord.FileLeafRef?.trim() ||
    input.file.originalFileName ||
    libraryRecord.DocumentName;

  let sharepointItemId: string | null = null;
  let sharepointWebUrl: string | null = null;
  let contentBase64: string | null = input.file.bytes.toString("base64");

  if (isGraphTransport()) {
    const siteId = process.env.SHAREPOINT_SITE_ID?.trim();
    if (siteId) {
      try {
        const accessToken = await getGraphAccessToken();
        // TODO(FS-006 Phase 2): persist company.sharepointDocumentsFolderId on Company
        // when Graph provision is fully wired (mirrors opportunity.sharepointFolderId).
        const folder = await ensureCompanyDocumentsSharePointFolder(
          accessToken,
          siteId,
          company.Title,
        );
        const uploaded = await uploadFileToSharePointFolder({
          accessToken,
          siteId,
          folderId: folder.folderId,
          fileName,
          contentType: input.file.mimeType || "application/octet-stream",
          bytes: input.file.bytes,
        });
        sharepointItemId = uploaded.itemId;
        sharepointWebUrl = uploaded.webUrl;
        contentBase64 = null;

        libraryRecord = await updateSmartDocLibraryRecord(libraryRecord.SmartDocID, {
          SharePointFolderPath: folder.path,
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
        mimeType: input.file.mimeType,
        sizeBytes: input.file.bytes.length,
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
}): Promise<ImportedProjectSmartDoc> {
  const project = await readProjectById(input.projectId);
  if (!project) {
    throw new Error(`Project not found: ${input.projectId}`);
  }

  const metadata: CreateSmartDocInput = {
    ...input.metadata,
    originalFileName:
      input.metadata.originalFileName ??
      input.file?.originalFileName ??
      undefined,
    LinkedProjectId: project.id,
    LinkedDealId: input.metadata.LinkedDealId ?? project.linkedDealId,
  };

  let libraryRecord = await createProjectSmartDocLibraryRecord(
    project.id,
    metadata,
  );

  if (!input.file?.bytes?.length) {
    return {
      libraryRecord,
      documentRecordId: null,
      sharepointWebUrl: null,
    };
  }

  const fileName =
    libraryRecord.FileLeafRef?.trim() ||
    input.file.originalFileName ||
    libraryRecord.DocumentName;

  let sharepointItemId: string | null = null;
  let sharepointWebUrl: string | null = null;
  let contentBase64: string | null = input.file.bytes.toString("base64");

  if (isGraphTransport()) {
    const siteId = process.env.SHAREPOINT_SITE_ID?.trim();
    if (siteId) {
      try {
        const accessToken = await getGraphAccessToken();
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
        const uploaded = await uploadFileToSharePointFolder({
          accessToken,
          siteId,
          folderId: folder.folderId,
          fileName,
          contentType: input.file.mimeType || "application/octet-stream",
          bytes: input.file.bytes,
        });
        sharepointItemId = uploaded.itemId;
        sharepointWebUrl = uploaded.webUrl;
        contentBase64 = null;

        libraryRecord = await updateSmartDocLibraryRecord(libraryRecord.SmartDocID, {
          SharePointFolderPath: folder.path,
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
        mimeType: input.file.mimeType,
        sizeBytes: input.file.bytes.length,
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
