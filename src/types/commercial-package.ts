import type { LinkedDocument } from "@/types/activity";

/** Quotation tiers — each is a Document Set. */
export type QuotationKind =
  | "price_indication"
  | "budget_quotation"
  | "formal_quotation";

export type CommercialPackageKind =
  | QuotationKind
  | "transmission"
  | "commercial_baseline"
  | "execution";

export type CommercialPackageStatus =
  | "draft"
  | "sent"
  | "accepted"
  | "frozen"
  | "superseded";

export type DocumentSetMemberRole =
  | "quotation"
  | "attachment"
  | "technical"
  | "commercial";

export type DocumentSetMember = LinkedDocument & {
  role: DocumentSetMemberRole;
  fileName: string;
};

export type CommercialPackage = {
  id: number;
  PackageID: string;
  /** First-class Document Set ID (e.g. FQ-001). */
  DocumentSetID: string;
  DealId: string;
  ClientName?: string;
  kind: CommercialPackageKind;
  status: CommercialPackageStatus;
  title: string;
  parentPackageId?: string;
  recipient?: string;
  sentAt?: string;
  acceptedAt?: string;
  CreatedAt?: string;
  CreatedBy?: string;
  members: DocumentSetMember[];
  summary?: string;
};

export const QUOTATION_KIND_LABELS: Record<QuotationKind, string> = {
  price_indication: "Price Indication",
  budget_quotation: "Budget Quotation",
  formal_quotation: "Formal Quotation",
};

export const COMMERCIAL_PACKAGE_KIND_LABELS: Record<CommercialPackageKind, string> = {
  ...QUOTATION_KIND_LABELS,
  transmission: "Transmission Package",
  commercial_baseline: "Commercial Baseline",
  execution: "Execution Package",
};

export function isQuotationKind(kind: CommercialPackageKind): kind is QuotationKind {
  return (
    kind === "price_indication" ||
    kind === "budget_quotation" ||
    kind === "formal_quotation"
  );
}
