import { getActivitiesForDeal } from "@/lib/activity-utils";
import {
  buildExecutionPackage,
  freezeBaselineFromTransmission,
  freezeTransmissionFromQuotation,
} from "@/lib/commercial-baseline-engine";
import {
  createCommercialPackage,
  readActivities,
  readCommercialPackagesForDeal,
  readCompanies,
  readPipelines,
  updateCommercialPackage,
  updatePipeline,
} from "@/lib/pipeline-db";
import { findCompanyForDeal } from "@/lib/opportunity-intelligence-engine";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { CommercialPackage, DocumentSetMember } from "@/types/commercial-package";
import { isQuotationKind } from "@/types/commercial-package";
import type { PipelineRow } from "@/types/pipeline";

function latestPackage(
  packages: CommercialPackage[],
  kind: CommercialPackage["kind"],
): CommercialPackage | null {
  return (
    [...packages]
      .filter((record) => record.kind === kind)
      .sort((a, b) => b.id - a.id)[0] ?? null
  );
}

function preferSendableQuotation(
  packages: CommercialPackage[],
): CommercialPackage | null {
  for (const kind of ["formal_quotation", "budget_quotation", "price_indication"] as const) {
    const record = latestPackage(packages, kind);
    if (record && record.status !== "superseded") return record;
  }
  return null;
}

function buildExecutionExtras(
  pipeline: PipelineRow,
  companies: Company[],
  activities: Activity[],
): DocumentSetMember[] {
  const dealId = pipeline.id;
  const extras: DocumentSetMember[] = [
    {
      role: "commercial",
      Title: `${dealId}_Legal-Signed Contract.01 Executed Agreement.pdf`,
      fileName: `${dealId}_Legal-Signed Contract.01 Executed Agreement.pdf`,
      DocCategory: "Legal",
      Revision: "01",
      DealId: dealId,
    },
  ];

  const company = findCompanyForDeal(dealId, companies);
  if (company && company.contacts.length > 0) {
    extras.push({
      role: "attachment",
      Title: `${dealId}_Commercial-Customer Contacts.01 Project Roster.pdf`,
      fileName: `${dealId}_Commercial-Customer Contacts.01 Project Roster.pdf`,
      DocCategory: "Commercial",
      Revision: "01",
      DealId: dealId,
    });
  }

  const clarifications = activities
    .filter((activity) =>
      ["Technical Review", "Meeting", "Teams Meeting"].includes(activity.ActivityType),
    )
    .slice(0, 1);

  if (clarifications.length > 0) {
    extras.push({
      role: "technical",
      Title: `${dealId}_Technical-Clarifications.01 Engineering Notes.pdf`,
      fileName: `${dealId}_Technical-Clarifications.01 Engineering Notes.pdf`,
      DocCategory: "Technical",
      Revision: "01",
      DealId: dealId,
    });
  }

  return extras;
}

export async function sendQuotationPackage(
  dealId: string,
  quotationPackageId: string,
  recipient: string,
): Promise<{ quotation: CommercialPackage; transmission: CommercialPackage }> {
  const packages = await readCommercialPackagesForDeal(dealId);
  const quotation = packages.find((record) => record.PackageID === quotationPackageId);

  if (!quotation || !isQuotationKind(quotation.kind)) {
    throw new Error("Quotation package not found for this deal");
  }

  if (latestPackage(packages, "transmission")) {
    throw new Error("A transmission package already exists for this deal");
  }

  const sentAt = new Date().toISOString();
  const transmission = await createCommercialPackage(
    freezeTransmissionFromQuotation(quotation, recipient.trim(), sentAt),
  );

  const quotationUpdated = await updateCommercialPackage(quotation.PackageID, {
    status: "sent",
  });

  return { quotation: quotationUpdated, transmission };
}

export async function acceptTransmissionPackage(
  dealId: string,
  transmissionPackageId?: string,
): Promise<{ baseline: CommercialPackage; transmission: CommercialPackage }> {
  const packages = await readCommercialPackagesForDeal(dealId);
  const transmission = transmissionPackageId
    ? packages.find((record) => record.PackageID === transmissionPackageId)
    : latestPackage(packages, "transmission");

  if (!transmission || transmission.kind !== "transmission") {
    throw new Error("Transmission package not found for this deal");
  }

  if (latestPackage(packages, "commercial_baseline")) {
    throw new Error("A commercial baseline already exists for this deal");
  }

  const acceptedAt = new Date().toISOString();
  const baseline = await createCommercialPackage(
    freezeBaselineFromTransmission(transmission, acceptedAt),
  );

  const parentQuotation = transmission.parentPackageId
    ? packages.find((record) => record.PackageID === transmission.parentPackageId)
    : preferSendableQuotation(packages);

  if (parentQuotation) {
    await updateCommercialPackage(parentQuotation.PackageID, { status: "accepted" });
  }

  return { baseline, transmission };
}

export async function ensureExecutionPackageForWonDeal(
  dealId: string,
): Promise<CommercialPackage | null> {
  const [pipelines, packages, activities, companies] = await Promise.all([
    readPipelines(),
    readCommercialPackagesForDeal(dealId),
    readActivities(),
    readCompanies(),
  ]);

  const pipeline = pipelines.find((row) => row.id === dealId);
  if (!pipeline) return null;

  if (latestPackage(packages, "execution")) return null;

  const baseline = latestPackage(packages, "commercial_baseline");
  if (!baseline) return null;

  const dealActivities = getActivitiesForDeal(activities, dealId);
  const extras = buildExecutionExtras(pipeline, companies, dealActivities);

  return createCommercialPackage(buildExecutionPackage(baseline, extras));
}

export async function updatePipelineWithCommercialHooks(
  id: string,
  patch: Partial<PipelineRow>,
): Promise<PipelineRow> {
  const pipelines = await readPipelines();
  const current = pipelines.find((row) => row.id === id);
  if (!current) {
    throw new Error(`Pipeline not found: ${id}`);
  }

  const updated = await updatePipeline(id, patch);

  if (patch.status === "Won" && current.status !== "Won") {
    await ensureExecutionPackageForWonDeal(id);
  }

  return updated;
}
