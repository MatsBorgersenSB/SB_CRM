import { getActivitiesForDeal } from "@/lib/activity-utils";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type {
  CommercialPackage,
  QuotationKind,
} from "@/types/commercial-package";
import {
  COMMERCIAL_PACKAGE_KIND_LABELS,
  QUOTATION_KIND_LABELS,
  isQuotationKind,
} from "@/types/commercial-package";
import type { PipelineRow } from "@/types/pipeline";
import { getContactDisplayName } from "@/types/contact";
import { findCompanyForDeal } from "@/lib/opportunity-intelligence-engine";

export type CommercialQuestionBlock = {
  headline: string;
  answer: string;
  impact: string[];
  package: CommercialPackage | null;
  meetingNotes: string[];
};

export type DealCommercialBaselineView = {
  dealId: string;
  dealName: string;
  quotationHierarchy: {
    kind: QuotationKind;
    label: string;
    package: CommercialPackage | null;
  }[];
  whatWeSent: CommercialQuestionBlock;
  whatWasAccepted: CommercialQuestionBlock;
  whatToExecute: CommercialQuestionBlock;
  packages: CommercialPackage[];
  actions: {
    sendableQuotation: CommercialPackage | null;
    canAccept: boolean;
    defaultRecipient?: string;
  };
};

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

function formatSentDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function memberSummary(pkg: CommercialPackage | null): string {
  if (!pkg || pkg.members.length === 0) return "No frozen documents.";
  return pkg.members
    .map((member) => `${member.Revision ?? "—"} · ${member.fileName}`)
    .join("\n");
}

function meetingNotesFromActivities(activities: Activity[]): string[] {
  return activities
    .filter((activity) =>
      ["Meeting", "Teams Meeting", "Phone Call", "Technical Review"].includes(
        activity.ActivityType,
      ),
    )
    .slice(0, 4)
    .map((activity) => activity.Summary?.trim() || activity.Subject);
}

function customerContactsFromCompanies(
  companies: Company[],
  pipeline: PipelineRow,
): string[] {
  const company = companies.find((record) => record.pipelineIds.includes(pipeline.id));
  if (!company) return [];

  return company.contacts.slice(0, 5).map((contact) => {
    const name = getContactDisplayName(contact);
    const role = contact.JobTitle || contact.Role;
    return role ? `${name} · ${role}` : name;
  });
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

function resolveCommercialActions(
  packages: CommercialPackage[],
  pipeline: PipelineRow,
  companies: Company[],
): DealCommercialBaselineView["actions"] {
  const transmission = latestPackage(packages, "transmission");
  const baseline = latestPackage(packages, "commercial_baseline");
  const sendableQuotation = transmission ? null : preferSendableQuotation(packages);
  const company = findCompanyForDeal(pipeline.id, companies);
  const contact = company?.contacts[0];
  const defaultRecipient = contact
    ? contact.Email
      ? `${getContactDisplayName(contact)} <${contact.Email}>`
      : getContactDisplayName(contact)
    : undefined;

  return {
    sendableQuotation,
    canAccept: Boolean(transmission) && !baseline,
    defaultRecipient,
  };
}

export function buildDealCommercialBaselineView(
  pipeline: PipelineRow,
  packages: CommercialPackage[],
  activities: Activity[],
  companies: Company[],
): DealCommercialBaselineView {
  const dealPackages = packages.filter((record) => record.DealId === pipeline.id);
  const transmission = latestPackage(dealPackages, "transmission");
  const baseline = latestPackage(dealPackages, "commercial_baseline");
  const execution = latestPackage(dealPackages, "execution");
  const dealActivities = getActivitiesForDeal(activities, pipeline.id);
  const meetingNotes = meetingNotesFromActivities(dealActivities);
  const contacts = customerContactsFromCompanies(companies, pipeline);

  const quotationHierarchy = (
    ["price_indication", "budget_quotation", "formal_quotation"] as QuotationKind[]
  ).map((kind) => ({
    kind,
    label: QUOTATION_KIND_LABELS[kind],
    package: latestPackage(dealPackages, kind),
  }));

  const showExecution =
    Boolean(execution) &&
    (pipeline.status === "Won" ||
      pipeline.status === "Reactor Manufacturing" ||
      pipeline.status === "Site Installation" ||
      pipeline.status === "Commissioning Phase" ||
      pipeline.status === "Live Production");

  return {
    dealId: pipeline.id,
    dealName: pipeline.assetName,
    quotationHierarchy,
    packages: dealPackages,
    whatWeSent: {
      headline: "What did we send?",
      answer: transmission
        ? `${COMMERCIAL_PACKAGE_KIND_LABELS.transmission} to ${transmission.recipient ?? "customer"} on ${formatSentDate(transmission.sentAt)}.`
        : "No transmission package recorded for this deal.",
      impact: transmission
        ? [
            `${transmission.members.length} files frozen at send time.`,
            memberSummary(transmission),
          ]
        : ["Send a formal quotation to create a transmission package."],
      package: transmission,
      meetingNotes: [],
    },
    whatWasAccepted: {
      headline: "What was accepted?",
      answer: baseline
        ? `Commercial baseline frozen on ${formatSentDate(baseline.acceptedAt)}.`
        : "No commercial baseline recorded yet.",
      impact: baseline
        ? [
            "Accepted quotation, attachments, specifications, and terms are frozen.",
            memberSummary(baseline),
            baseline.summary ?? "",
          ].filter(Boolean)
        : ["Accept a transmitted quotation to establish the commercial baseline."],
      package: baseline,
      meetingNotes: [],
    },
    whatToExecute: {
      headline: "What should the project execute?",
      answer: showExecution && execution
        ? `${COMMERCIAL_PACKAGE_KIND_LABELS.execution} is ready for delivery handover.`
        : pipeline.status === "Won" && !execution
          ? "Deal is Won — generate the execution package from the commercial baseline."
          : "Execution package appears when the deal is Won and baseline exists.",
      impact: showExecution && execution
        ? [
            "Includes commercial baseline, signed contract, customer contacts, and clarifications.",
            `${execution.members.length} controlled documents in the execution set.`,
          ]
        : ["Win the deal to unlock the execution package for project teams."],
      package: showExecution ? execution : null,
      meetingNotes:
        showExecution && execution
          ? [...meetingNotes, ...contacts.map((line) => `Contact · ${line}`)]
          : meetingNotes,
    },
    actions: resolveCommercialActions(dealPackages, pipeline, companies),
  };
}

export function freezeTransmissionFromQuotation(
  quotation: CommercialPackage,
  recipient: string,
  sentAt: string,
): Omit<CommercialPackage, "id" | "PackageID" | "DocumentSetID"> {
  return {
    DealId: quotation.DealId,
    kind: "transmission",
    status: "frozen",
    title: `Transmission — ${quotation.title}`,
    parentPackageId: quotation.PackageID,
    recipient,
    sentAt,
    members: quotation.members.map((member) => ({ ...member })),
    summary: "Frozen send package — exact files and revisions transmitted to customer.",
  };
}

export function freezeBaselineFromTransmission(
  transmission: CommercialPackage,
  acceptedAt: string,
): Omit<CommercialPackage, "id" | "PackageID" | "DocumentSetID"> {
  return {
    DealId: transmission.DealId,
    kind: "commercial_baseline",
    status: "frozen",
    title: `Commercial Baseline — ${transmission.DealId}`,
    parentPackageId: transmission.PackageID,
    acceptedAt,
    members: transmission.members.map((member) => ({ ...member })),
    summary: "Accepted quotation, attachments, specifications, and commercial terms.",
  };
}

export function buildExecutionPackage(
  baseline: CommercialPackage,
  extras: CommercialPackage["members"],
): Omit<CommercialPackage, "id" | "PackageID" | "DocumentSetID"> {
  const baselineMembers = baseline.members.map((member) => ({ ...member }));
  const merged = [...baselineMembers];

  for (const extra of extras) {
    if (!merged.some((member) => member.fileName === extra.fileName)) {
      merged.push({ ...extra });
    }
  }

  return {
    DealId: baseline.DealId,
    kind: "execution",
    status: "frozen",
    title: `Execution Package — ${baseline.DealId}`,
    parentPackageId: baseline.PackageID,
    members: merged,
    summary:
      "Baseline + signed contract + customer contacts + meeting clarifications for project execution.",
  };
}

export function isQuotationPackage(pkg: CommercialPackage): boolean {
  return isQuotationKind(pkg.kind);
}
