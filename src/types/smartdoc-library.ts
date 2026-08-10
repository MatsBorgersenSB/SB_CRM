/** SmartDocs library row — SharePoint SmartDocs list shape. */

/** Who owns the SmartDoc in SmartCRM (file SoT may still be SharePoint). */
export type SmartDocOwnership = "company" | "opportunity";

export type SmartDocLibraryRecord = {
  id: number;
  SmartDocID: string;
  /**
   * Opportunity owner / link.
   * Required for opportunity-owned docs; null/omit for company-owned (FS-006).
   */
  DealId: string | null;
  /**
   * Company that owns the SmartDoc (required for company-owned; preferred on all rows).
   * Public company code when available (e.g. CO-1009).
   */
  OwnerCompanyId?: string;
  /** Ownership kind — company-owned docs must set `company`. */
  Ownership?: SmartDocOwnership;
  /**
   * Identity owner code embedded in SmartDocID prefix.
   * PL-#### for opportunity-owned; CO-#### for company-owned.
   */
  PlNumber: string;
  ClientName: string;
  DealName: string;
  CommercialStage: string;
  CreatedAt: string;
  DocCategory: SmartDocCategory;
  DocType: string;
  DocumentName: string;
  Revision: string;
  FileLeafRef: string;
  /** Assigned Document Set (e.g. FQ-001). Deal commercial sets only. */
  DocumentSetID?: string;
  /**
   * Who produced the document.
   * Missing/legacy rows are treated as unknown in UI.
   */
  Origin?: SmartDocOrigin;
  /** External producer name (supplier / customer / partner) when Origin = external. */
  Counterparty?: string;
  /** Expected SharePoint folder path under company Documents (FS-006). */
  SharePointFolderPath?: string;
  /** Browser URL when filed in SharePoint Online. */
  SharePointWebUrl?: string;
  /** Phase 2 — optional opportunity link without changing ownership. */
  LinkedDealId?: string | null;
  /** Phase 2 — optional project link without changing ownership. */
  LinkedProjectId?: string | null;
};

/** Document authorship — independent of category/type. */
export type SmartDocOrigin = "standard_bio" | "external" | "unknown";

export const SMARTDOC_ORIGINS: SmartDocOrigin[] = [
  "standard_bio",
  "external",
  "unknown",
];

export const SMARTDOC_ORIGIN_LABELS: Record<SmartDocOrigin, string> = {
  standard_bio: "Standard Bio",
  external: "External",
  unknown: "Unknown",
};

export type SmartDocCategory =
  | "Commercial"
  | "Legal"
  | "Technical"
  | "Financial"
  | "Operational"
  | "General";

export const SMARTDOC_CATEGORIES: SmartDocCategory[] = [
  "Commercial",
  "Legal",
  "Technical",
  "Financial",
  "Operational",
  "General",
];

export const SMARTDOC_TYPES_BY_CATEGORY: Record<SmartDocCategory, string[]> = {
  Commercial: [
    "Formal Quotation",
    "Budget Quotation",
    "Price Indication",
    "Sales Proposal",
    "Supplier Quotation",
    "Customer Purchase Order",
    "Order Confirmation",
    "Terms Schedule",
    "Payment Milestones",
  ],
  Legal: ["NDA Contract", "Signed Contract", "Vendor Agreement", "MSA"],
  Technical: [
    "Technical Datasheet",
    "Process Summary",
    "Heat Balance",
    "Clarifications",
    "Third-party Report",
  ],
  Financial: ["Invoice", "Supplier Invoice", "Budget Report", "Payment Schedule"],
  Operational: ["Business Report", "Meeting Notes", "Project Plan"],
  General: ["Unclassified Document", "Attachment", "Correspondence"],
};

/** Types that are typically produced outside Standard Bio. */
export const SMARTDOC_EXTERNAL_TYPES = new Set<string>([
  "Supplier Quotation",
  "Customer Purchase Order",
  "Order Confirmation",
  "Supplier Invoice",
  "Third-party Report",
  "Vendor Agreement",
]);

/** Types that are typically produced by Standard Bio. */
export const SMARTDOC_STANDARD_BIO_TYPES = new Set<string>([
  "Formal Quotation",
  "Budget Quotation",
  "Price Indication",
  "Sales Proposal",
  "Terms Schedule",
  "Payment Milestones",
  "Technical Datasheet",
  "Process Summary",
  "Heat Balance",
  "Clarifications",
  "Meeting Notes",
  "Project Plan",
]);

export type DealDocumentContext = {
  plNumber: string;
  clientName: string;
  dealId: string;
  dealName: string;
  commercialStage: string;
  createdAt: string;
};

/** Company document context for company-owned SmartDocs (FS-006). */
export type CompanyDocumentContext = {
  companyId: string;
  companyCode: string;
  companyName: string;
  sharePointFolderPath: string;
  createdAt: string;
};

export type SmartDocNameSuggestions = {
  primary: string;
  alternatives: string[];
};

export type SmartDocIdentityPreview = {
  documentId: string;
  suggestedName: string;
  categoryCode: string;
  categoryLabel: string;
  typeCode: string;
};

export type CreateSmartDocInput = {
  DocCategory: SmartDocCategory;
  DocType: string;
  DocumentName: string;
  originalFileName?: string;
  DocumentSetID?: string;
  Origin?: SmartDocOrigin;
  Counterparty?: string;
  /** Optional opportunity link on company-owned create (Phase 2 stub). */
  LinkedDealId?: string;
  LinkedProjectId?: string;
};

export function normalizeSmartDocOrigin(
  value: string | null | undefined,
): SmartDocOrigin {
  const cleaned = value?.trim().toLowerCase();
  if (cleaned === "standard_bio" || cleaned === "external" || cleaned === "unknown") {
    return cleaned;
  }
  return "unknown";
}

export function suggestOriginForDocType(docType: string): SmartDocOrigin {
  if (SMARTDOC_EXTERNAL_TYPES.has(docType)) return "external";
  if (SMARTDOC_STANDARD_BIO_TYPES.has(docType)) return "standard_bio";
  return "unknown";
}

/** SharePoint SoT path for company documents (FS-006). */
export function companyDocumentsSharePointPath(companyName: string): string {
  const safe = companyName.trim() || "Unknown Company";
  return `/Companies/${safe}/Documents`;
}

export function isCompanyOwnedSmartDoc(
  record: Pick<SmartDocLibraryRecord, "Ownership" | "DealId" | "OwnerCompanyId">,
): boolean {
  if (record.Ownership === "company") return true;
  if (record.Ownership === "opportunity") return false;
  return Boolean(record.OwnerCompanyId && !record.DealId);
}
