/** SmartDocs library row — SharePoint SmartDocs list shape. */

/** Who owns the SmartDoc in SmartCRM (file SoT may still be SharePoint). */
export type SmartDocOwnership = "company" | "opportunity" | "project";

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

/**
 * SharePoint Document Categories list (Doc_Category / Doc_Cat_Code).
 * SmartCRM must use this vocabulary — it is the document SoT.
 */
export type SmartDocCategory =
  | "Admin"
  | "Engineering"
  | "Finance"
  | "General"
  | "Project Management"
  | "Sales & Marketing"
  | "Aftermarket & Service"
  | "Legal"
  | "Quality"
  | "Operation";

export const SMARTDOC_CATEGORIES: SmartDocCategory[] = [
  "Admin",
  "Engineering",
  "Finance",
  "General",
  "Project Management",
  "Sales & Marketing",
  "Aftermarket & Service",
  "Legal",
  "Quality",
  "Operation",
];

/**
 * SharePoint Document Types list (Doc_Types / Doc_Type_Code).
 * Types are independent of category — pick both, as in SharePoint.
 */
export const SMARTDOC_TYPES = [
  "Datasheet",
  "Calculation",
  "Manual",
  "Report",
  "Drawing",
  "Register",
  "Minutes og Meeting",
  "Memo",
  "Presentation",
  "Risk Assessment",
  "Request for information",
  "Request for Quotation",
  "Quotation",
  "Template",
  "Invoice",
  "Shipping Doc",
  "Contract",
  "NDA",
  "Specification",
  "Certificate",
  "Procedure",
  "Projectplan",
  "Scope of Works",
  "Change Request",
  "Issue Log",
] as const;

export type SmartDocType = (typeof SMARTDOC_TYPES)[number];

/** Typical types per category — guidance only; every type remains selectable. */
export const SMARTDOC_TYPES_BY_CATEGORY: Record<SmartDocCategory, string[]> = {
  Admin: ["Memo", "Template", "Register", "Procedure", "Issue Log"],
  Engineering: [
    "Datasheet",
    "Calculation",
    "Drawing",
    "Specification",
    "Manual",
    "Report",
    "Scope of Works",
  ],
  Finance: ["Invoice", "Quotation", "Report"],
  General: ["Memo", "Presentation", "Template", "Register"],
  "Project Management": [
    "Minutes og Meeting",
    "Projectplan",
    "Scope of Works",
    "Change Request",
    "Issue Log",
    "Risk Assessment",
    "Report",
  ],
  "Sales & Marketing": [
    "Presentation",
    "Quotation",
    "Request for Quotation",
    "Request for information",
    "Memo",
    "Report",
  ],
  "Aftermarket & Service": [
    "Manual",
    "Procedure",
    "Shipping Doc",
    "Report",
    "Issue Log",
  ],
  Legal: ["Contract", "NDA", "Memo"],
  Quality: [
    "Certificate",
    "Procedure",
    "Risk Assessment",
    "Report",
    "Register",
  ],
  Operation: ["Procedure", "Manual", "Report", "Register", "Issue Log"],
};

/** Types that are typically produced outside Standard Bio. */
export const SMARTDOC_EXTERNAL_TYPES = new Set<string>([
  "Certificate",
  "Contract",
  "NDA",
  "Invoice",
  "Shipping Doc",
  "Request for information",
  "Request for Quotation",
]);

/** Types that are typically produced by Standard Bio. */
export const SMARTDOC_STANDARD_BIO_TYPES = new Set<string>([
  "Presentation",
  "Datasheet",
  "Quotation",
  "Manual",
  "Drawing",
  "Calculation",
  "Specification",
  "Procedure",
  "Template",
  "Projectplan",
  "Scope of Works",
  "Minutes og Meeting",
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

/** Project document context — project-owned SmartDocs. */
export type ProjectDocumentContext = {
  projectId: string;
  projectCode: string;
  projectName: string;
  companyId?: string;
  companyName?: string;
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

const LEGACY_CATEGORY_MAP: Record<string, SmartDocCategory> = {
  commercial: "Sales & Marketing",
  "sales & marketing": "Sales & Marketing",
  sales: "Sales & Marketing",
  legal: "Legal",
  leagal: "Legal",
  permits: "Quality",
  compliance: "Quality",
  quality: "Quality",
  technical: "Engineering",
  engineering: "Engineering",
  financial: "Finance",
  finance: "Finance",
  operational: "Operation",
  operation: "Operation",
  operations: "Operation",
  general: "General",
  admin: "Admin",
  "project management": "Project Management",
  "aftermarket & service": "Aftermarket & Service",
  aftermarket: "Aftermarket & Service",
};

const LEGACY_TYPE_MAP: Record<string, SmartDocType> = {
  "formal quotation": "Quotation",
  "budget quotation": "Quotation",
  "price indication": "Quotation",
  "supplier quotation": "Quotation",
  "sales proposal": "Presentation",
  "customer purchase order": "Shipping Doc",
  "order confirmation": "Memo",
  "terms schedule": "Contract",
  "payment milestones": "Invoice",
  "nda contract": "NDA",
  nda: "NDA",
  "signed contract": "Contract",
  "vendor agreement": "Contract",
  msa: "Contract",
  "environmental permit": "Certificate",
  "planning permit": "Certificate",
  "building permit": "Certificate",
  "operating licence": "Certificate",
  "operating license": "Certificate",
  "permit application": "Certificate",
  "inspection report": "Report",
  "technical datasheet": "Datasheet",
  datasheet: "Datasheet",
  "process summary": "Specification",
  "heat balance": "Calculation",
  clarifications: "Memo",
  "third-party report": "Report",
  invoice: "Invoice",
  "supplier invoice": "Invoice",
  "budget report": "Report",
  "payment schedule": "Invoice",
  "business report": "Report",
  "meeting notes": "Minutes og Meeting",
  "minutes of meeting": "Minutes og Meeting",
  "minutes og meeting": "Minutes og Meeting",
  "project plan": "Projectplan",
  projectplan: "Projectplan",
  "unclassified document": "Memo",
  attachment: "Memo",
  correspondence: "Memo",
  presentation: "Presentation",
  quaotation: "Quotation",
  quotation: "Quotation",
};

/** Map stored / legacy labels onto the SharePoint taxonomy. */
export function normalizeSmartDocCategory(
  value: string | null | undefined,
): SmartDocCategory {
  const cleaned = value?.trim();
  if (!cleaned) return "General";
  if (SMARTDOC_CATEGORIES.includes(cleaned as SmartDocCategory)) {
    return cleaned as SmartDocCategory;
  }
  const mapped = LEGACY_CATEGORY_MAP[cleaned.toLowerCase()];
  return mapped ?? "General";
}

export function isSmartDocType(value: string | null | undefined): value is SmartDocType {
  return Boolean(value && (SMARTDOC_TYPES as readonly string[]).includes(value));
}

export function normalizeSmartDocType(value: string | null | undefined): string {
  const cleaned = value?.trim();
  if (!cleaned) return "Memo";
  if (isSmartDocType(cleaned)) return cleaned;
  return LEGACY_TYPE_MAP[cleaned.toLowerCase()] ?? cleaned;
}

/** Authority permits and legacy Compliance / Permits rows. */
export function isPermitSmartDocCategory(
  category: string | null | undefined,
): boolean {
  const cleaned = category?.trim();
  return cleaned === "Permits" || cleaned === "Compliance";
}

export function looksLikePermitDocument(
  category: string | null | undefined,
  docType?: string | null,
): boolean {
  if (isPermitSmartDocCategory(category)) return true;
  const type = normalizeSmartDocType(docType).toLowerCase();
  return (
    type === "certificate" ||
    /permit|tillatelse|licence|license|konsesjon/.test(type)
  );
}

export function isSalesSmartDocCategory(
  category: string | null | undefined,
): boolean {
  const cleaned = category?.trim();
  if (cleaned === "Commercial") return true;
  return normalizeSmartDocCategory(cleaned) === "Sales & Marketing";
}

export function isEngineeringSmartDocCategory(
  category: string | null | undefined,
): boolean {
  const cleaned = category?.trim();
  if (cleaned === "Technical") return true;
  return normalizeSmartDocCategory(cleaned) === "Engineering";
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

/** SharePoint SoT path for project documents. */
export function projectDocumentsSharePointPath(
  projectName: string,
  companyName?: string | null,
): string {
  const safeProject = projectName.trim() || "Untitled Project";
  const safeCompany = companyName?.trim();
  if (safeCompany) {
    return `/Projects/${safeCompany}/${safeProject}`;
  }
  return `/Projects/${safeProject}`;
}

export function isCompanyOwnedSmartDoc(
  record: Pick<SmartDocLibraryRecord, "Ownership" | "DealId" | "OwnerCompanyId">,
): boolean {
  if (record.Ownership === "company") return true;
  if (record.Ownership === "opportunity" || record.Ownership === "project") {
    return false;
  }
  return Boolean(record.OwnerCompanyId && !record.DealId);
}

export function isProjectOwnedSmartDoc(
  record: Pick<
    SmartDocLibraryRecord,
    "Ownership" | "DealId" | "LinkedProjectId" | "PlNumber"
  >,
): boolean {
  if (record.Ownership === "project") return true;
  return Boolean(
    record.LinkedProjectId &&
      !record.DealId &&
      record.PlNumber?.toUpperCase().startsWith("PRJ-"),
  );
}
