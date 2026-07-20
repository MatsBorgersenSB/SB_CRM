import type { CommercialPackage, CommercialPackageKind } from "@/types/commercial-package";
import { COMMERCIAL_PACKAGE_KIND_LABELS, isQuotationKind } from "@/types/commercial-package";
import type { DocumentSetMember } from "@/types/commercial-package";

/** User-facing document set lifecycle status. */
export type DocumentSetStatus =
  | "Draft"
  | "Complete"
  | "Released"
  | "Transmitted"
  | "Accepted"
  | "Superseded";

/** Quotation document set types — PI, BQ, FQ. */
export type QuotationDocumentSetKind = Extract<
  CommercialPackageKind,
  "price_indication" | "budget_quotation" | "formal_quotation"
>;

export const QUOTATION_DOCUMENT_SET_KINDS: QuotationDocumentSetKind[] = [
  "price_indication",
  "budget_quotation",
  "formal_quotation",
];

/** First-class Document Set — controlled package of related documents. */
export type DocumentSet = {
  id: number;
  documentSetId: string;
  packageId: string;
  dealId: string;
  clientName: string;
  dealName: string;
  type: CommercialPackageKind;
  typeLabel: string;
  /** Business lifecycle status shown in UI. */
  documentSetStatus: DocumentSetStatus;
  title: string;
  createdAt: string;
  createdBy: string;
  members: DocumentSetMember[];
  summary?: string;
  parentDocumentSetId?: string;
};

export const DOCUMENT_SET_KIND_PREFIX: Record<CommercialPackageKind, string> = {
  price_indication: "PI",
  budget_quotation: "BQ",
  formal_quotation: "FQ",
  transmission: "TX",
  commercial_baseline: "CB",
  execution: "EX",
};

export const DOCUMENT_SET_STATUS_STYLES: Record<DocumentSetStatus, string> = {
  Draft: "border-carbon-blue/20 bg-carbon-blue/[0.06] text-carbon-blue/70",
  Complete: "border-emerald-500/25 bg-emerald-500/10 text-emerald-700",
  Released: "border-sky-500/25 bg-sky-500/10 text-sky-700",
  Transmitted: "border-violet-500/25 bg-violet-500/10 text-violet-700",
  Accepted: "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange",
  Superseded: "border-carbon-blue/15 bg-carbon-blue/[0.04] text-carbon-blue/45",
};

export function documentSetTypeLabel(kind: CommercialPackageKind): string {
  return COMMERCIAL_PACKAGE_KIND_LABELS[kind];
}

export function isQuotationDocumentSetKind(
  kind: CommercialPackageKind,
): kind is QuotationDocumentSetKind {
  return isQuotationKind(kind);
}

export function resolveDocumentSetStatus(
  pkg: CommercialPackage,
  completenessScore?: number,
): DocumentSetStatus {
  if (pkg.status === "superseded") return "Superseded";
  if (pkg.kind === "transmission" || pkg.sentAt) return "Transmitted";
  if (pkg.status === "accepted" || pkg.acceptedAt) return "Accepted";
  if (pkg.kind === "execution" && pkg.status === "frozen") return "Complete";
  if (completenessScore === 100 && pkg.status === "frozen") return "Complete";
  if (pkg.status === "frozen") return "Released";
  if (pkg.status === "draft") return "Draft";
  if (pkg.status === "sent") return "Transmitted";
  return "Draft";
}

export type DocumentSet360Tab = "overview" | "documents";

export function documentSet360Href(setId: string, tab?: DocumentSet360Tab): string {
  const base = `/document-sets/${encodeURIComponent(setId)}`;
  return tab ? `${base}?tab=${tab}` : base;
}

export type CreateDocumentSetInput = {
  kind: QuotationDocumentSetKind;
  title?: string;
  createdBy?: string;
};
