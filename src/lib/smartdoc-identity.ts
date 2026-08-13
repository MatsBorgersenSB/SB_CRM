import type {
  SmartDocCategory,
  SmartDocIdentityPreview,
  SmartDocNameSuggestions,
} from "@/types/smartdoc-library";

/** Michelin taxonomy — category segment in document identity (e.g. S = Sales & Marketing). */
export const SMARTDOC_IDENTITY_CATEGORY_CODES: Record<
  SmartDocCategory,
  { code: string; label: string }
> = {
  Commercial: { code: "S", label: "Sales & Marketing" },
  Legal: { code: "L", label: "Legal" },
  Technical: { code: "T", label: "Technical" },
  Financial: { code: "F", label: "Financial" },
  Operational: { code: "O", label: "Operational" },
  General: { code: "G", label: "General" },
};

/** Type segment in document identity (3-letter codes). */
export const SMARTDOC_IDENTITY_TYPE_CODES: Record<string, string> = {
  "Formal Quotation": "QUO",
  "Budget Quotation": "QUO",
  "Price Indication": "QUO",
  "Sales Proposal": "PRO",
  "Supplier Quotation": "SUQ",
  "Customer Purchase Order": "CPO",
  "Order Confirmation": "ORC",
  "Terms Schedule": "TRM",
  "Payment Milestones": "PAY",
  "NDA Contract": "NDA",
  "Signed Contract": "SIG",
  "Vendor Agreement": "VAG",
  MSA: "MSA",
  "Technical Datasheet": "TDS",
  "Process Summary": "PSU",
  "Heat Balance": "HBL",
  Clarifications: "CLR",
  "Third-party Report": "TPR",
  Invoice: "INV",
  "Supplier Invoice": "SIV",
  "Budget Report": "BRP",
  "Payment Schedule": "PSC",
  "Business Report": "BRP",
  "Meeting Notes": "MNT",
  "Project Plan": "PPL",
  "Unclassified Document": "GEN",
  Attachment: "ATT",
  Correspondence: "COR",
};

/** PL-… (opportunity), CO-… (company), or PRJ-… (project) owner prefix + category + type + sequence. */
const IDENTITY_PATTERN = /^((?:PL|CO|PRJ)-[A-Z0-9]+)-([A-Z])-([A-Z]{3})-(\d{4})$/i;

const OWNER_CODE_PATTERN = /^(PL|CO|PRJ)-[A-Z0-9]+$/i;

export const SMARTDOC_IDENTITY_EXPLANATION =
  "SmartDoc IDs encode ownership context: PL for deal docs, CO for company-owned docs, or PRJ for project docs, plus document category (e.g. S = Sales & Marketing), document type (e.g. SUQ = Supplier Quotation), and a unique sequence. IDs are assigned automatically — never edited manually. SharePoint manages file version history.";

export type { SmartDocIdentityPreview, SmartDocNameSuggestions };

export function resolveTypeCode(docType: string): string {
  const mapped = SMARTDOC_IDENTITY_TYPE_CODES[docType];
  if (mapped) return mapped;

  const words = docType
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length >= 2) {
    return words
      .slice(0, 3)
      .map((word) => word[0]!)
      .join("")
      .toUpperCase()
      .padEnd(3, "X")
      .slice(0, 3);
  }

  return docType
    .replace(/[^a-zA-Z]/g, "")
    .toUpperCase()
    .padEnd(3, "X")
    .slice(0, 3);
}

export function resolveCategoryCode(category: SmartDocCategory): string {
  return SMARTDOC_IDENTITY_CATEGORY_CODES[category].code;
}

export function resolveCategoryLabel(category: SmartDocCategory): string {
  return SMARTDOC_IDENTITY_CATEGORY_CODES[category].label;
}

function normalizeTypeForSuggestedName(docType: string): string {
  if (
    docType === "Formal Quotation" ||
    docType === "Budget Quotation" ||
    docType === "Price Indication"
  ) {
    return "Quotation";
  }
  return docType;
}

export function normalizeSmartDocOwnerCode(ownerCode: string): string {
  const trimmed = ownerCode.trim().toUpperCase();
  if (!OWNER_CODE_PATTERN.test(trimmed)) {
    throw new Error(
      `SmartDoc owner code must be PL-…, CO-…, or PRJ-… (received: ${ownerCode})`,
    );
  }
  return trimmed;
}

export function suggestDocumentName(dealName: string, docType: string): string {
  const label = normalizeTypeForSuggestedName(docType);
  const trimmedDeal = dealName.trim();
  if (!trimmedDeal) return label;
  return `${trimmedDeal} ${label}`;
}

export function suggestDocumentNames(
  plNumber: string,
  dealName: string,
  clientName: string,
  docType: string,
): SmartDocNameSuggestions {
  const primary = suggestDocumentName(dealName, docType);
  const typeLabel = normalizeTypeForSuggestedName(docType);
  const trimmedDeal = dealName.trim();
  const trimmedClient = clientName.trim();

  const candidates = [
    primary,
    trimmedDeal ? `${trimmedDeal} — ${docType}` : null,
    `${plNumber} ${typeLabel}`,
    trimmedClient && trimmedClient !== plNumber ? `${trimmedClient} ${typeLabel}` : null,
    `${typeLabel} — ${trimmedDeal || plNumber}`,
  ].filter((value): value is string => Boolean(value?.trim()));

  const unique = [...new Set(candidates.map((value) => value.trim()))];

  return {
    primary: unique[0] ?? primary,
    alternatives: unique.slice(1, 4),
  };
}

export function nextIdentitySequence(
  ownerCode: string,
  categoryCode: string,
  typeCode: string,
  existingIds: string[],
): number {
  const normalizedOwner = normalizeSmartDocOwnerCode(ownerCode);
  const prefix = `${normalizedOwner}-${categoryCode}-${typeCode}-`;
  let max = 0;

  for (const id of existingIds) {
    const match = id.match(IDENTITY_PATTERN);
    if (!match) continue;
    const [, owner, cat, type, seq] = match;
    if (
      owner!.toUpperCase() === normalizedOwner &&
      cat!.toUpperCase() === categoryCode.toUpperCase() &&
      type!.toUpperCase() === typeCode.toUpperCase()
    ) {
      max = Math.max(max, Number(seq));
    }
  }

  return max + 1;
}

export function buildDocumentIdentity(
  ownerCode: string,
  category: SmartDocCategory,
  docType: string,
  existingIds: string[],
): SmartDocIdentityPreview {
  const normalizedOwner = normalizeSmartDocOwnerCode(ownerCode);
  const categoryCode = resolveCategoryCode(category);
  const typeCode = resolveTypeCode(docType);
  const sequence = nextIdentitySequence(
    normalizedOwner,
    categoryCode,
    typeCode,
    existingIds,
  );

  return {
    documentId: `${normalizedOwner}-${categoryCode}-${typeCode}-${String(sequence).padStart(4, "0")}`,
    suggestedName: "",
    categoryCode,
    categoryLabel: resolveCategoryLabel(category),
    typeCode,
  };
}

/** Opportunity-owned identity (PL-####-…). */
export function buildSmartDocIdentityPreview(
  plNumber: string,
  dealName: string,
  category: SmartDocCategory,
  docType: string,
  existingIds: string[],
): SmartDocIdentityPreview {
  const identity = buildDocumentIdentity(plNumber, category, docType, existingIds);
  return {
    ...identity,
    suggestedName: suggestDocumentName(dealName, docType),
  };
}

/** Company-owned identity (CO-####-…), e.g. CO-1009-S-SUQ-0001. */
export function buildCompanySmartDocIdentityPreview(
  companyCode: string,
  companyName: string,
  category: SmartDocCategory,
  docType: string,
  existingIds: string[],
): SmartDocIdentityPreview {
  const identity = buildDocumentIdentity(companyCode, category, docType, existingIds);
  return {
    ...identity,
    suggestedName: suggestDocumentName(companyName, docType),
  };
}

/** Project-owned identity (PRJ-…-…), e.g. PRJ-BIO4METAL-L-VAG-0001. */
export function buildProjectSmartDocIdentityPreview(
  projectCode: string,
  projectName: string,
  category: SmartDocCategory,
  docType: string,
  existingIds: string[],
): SmartDocIdentityPreview {
  const identity = buildDocumentIdentity(projectCode, category, docType, existingIds);
  return {
    ...identity,
    suggestedName: suggestDocumentName(projectName, docType),
  };
}

export function isSmartDocIdentityId(value: string): boolean {
  return IDENTITY_PATTERN.test(value.trim());
}

export function isCompanySmartDocIdentityId(value: string): boolean {
  const match = value.trim().match(IDENTITY_PATTERN);
  return Boolean(match?.[1]?.toUpperCase().startsWith("CO-"));
}

export function isOpportunitySmartDocIdentityId(value: string): boolean {
  const match = value.trim().match(IDENTITY_PATTERN);
  return Boolean(match?.[1]?.toUpperCase().startsWith("PL-"));
}

export function isProjectSmartDocIdentityId(value: string): boolean {
  const match = value.trim().match(IDENTITY_PATTERN);
  return Boolean(match?.[1]?.toUpperCase().startsWith("PRJ-"));
}

export type SmartDocIdentityBreakdown = {
  documentId: string;
  /** @deprecated Prefer ownerCode — kept for existing call sites. */
  plNumber: string;
  ownerCode: string;
  ownership: "company" | "opportunity";
  categoryCode: string;
  categoryLabel: string;
  typeCode: string;
  sequence: string;
};

export function parseSmartDocIdentity(documentId: string): SmartDocIdentityBreakdown | null {
  const match = documentId.trim().match(IDENTITY_PATTERN);
  if (!match) return null;

  const [, ownerCode, categoryCode, typeCode, sequence] = match;
  const normalizedOwner = ownerCode!.toUpperCase();
  const categoryEntry = Object.entries(SMARTDOC_IDENTITY_CATEGORY_CODES).find(
    ([, value]) => value.code === categoryCode!.toUpperCase(),
  );

  return {
    documentId: `${normalizedOwner}-${categoryCode!.toUpperCase()}-${typeCode!.toUpperCase()}-${sequence}`,
    plNumber: normalizedOwner,
    ownerCode: normalizedOwner,
    ownership: normalizedOwner.startsWith("CO-") ? "company" : "opportunity",
    categoryCode: categoryCode!.toUpperCase(),
    categoryLabel: categoryEntry?.[1].label ?? categoryCode!.toUpperCase(),
    typeCode: typeCode!.toUpperCase(),
    sequence: sequence!,
  };
}

export function sharePointVersionLabel(revision: string): string {
  const numeric = Number(revision);
  if (Number.isFinite(numeric) && numeric > 0) {
    return `${numeric}.0`;
  }
  return "1.0";
}
