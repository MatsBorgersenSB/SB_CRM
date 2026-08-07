/** SmartDocs library row — SharePoint SmartDocs list shape. */
export type SmartDocLibraryRecord = {
  id: number;
  SmartDocID: string;
  DealId: string;
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
  /** Assigned Document Set (e.g. FQ-001). */
  DocumentSetID?: string;
  /**
   * Who produced the document.
   * Missing/legacy rows are treated as unknown in UI.
   */
  Origin?: SmartDocOrigin;
  /** External producer name (supplier / customer / partner) when Origin = external. */
  Counterparty?: string;
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
