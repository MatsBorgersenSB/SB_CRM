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

const IDENTITY_PATTERN = /^(PL-\d{4})-([A-Z])-([A-Z]{3})-(\d{4})$/;

export const SMARTDOC_IDENTITY_EXPLANATION =
  "SmartDoc IDs encode deal context: PL number, document category (e.g. S = Sales & Marketing), document type (e.g. QUO = Quotation), and a unique sequence. IDs are assigned automatically — never edited manually. SharePoint manages file version history.";

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
  plNumber: string,
  categoryCode: string,
  typeCode: string,
  existingIds: string[],
): number {
  const prefix = `${plNumber}-${categoryCode}-${typeCode}-`;
  let max = 0;

  for (const id of existingIds) {
    const match = id.match(IDENTITY_PATTERN);
    if (!match) continue;
    const [, pl, cat, type, seq] = match;
    if (pl === plNumber && cat === categoryCode && type === typeCode) {
      max = Math.max(max, Number(seq));
    }
  }

  return max + 1;
}

export function buildDocumentIdentity(
  plNumber: string,
  category: SmartDocCategory,
  docType: string,
  existingIds: string[],
): SmartDocIdentityPreview {
  const categoryCode = resolveCategoryCode(category);
  const typeCode = resolveTypeCode(docType);
  const sequence = nextIdentitySequence(plNumber, categoryCode, typeCode, existingIds);

  return {
    documentId: `${plNumber}-${categoryCode}-${typeCode}-${String(sequence).padStart(4, "0")}`,
    suggestedName: "",
    categoryCode,
    categoryLabel: resolveCategoryLabel(category),
    typeCode,
  };
}

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

export function isSmartDocIdentityId(value: string): boolean {
  return IDENTITY_PATTERN.test(value);
}

export type SmartDocIdentityBreakdown = {
  documentId: string;
  plNumber: string;
  categoryCode: string;
  categoryLabel: string;
  typeCode: string;
  sequence: string;
};

export function parseSmartDocIdentity(documentId: string): SmartDocIdentityBreakdown | null {
  const match = documentId.match(IDENTITY_PATTERN);
  if (!match) return null;

  const [, plNumber, categoryCode, typeCode, sequence] = match;
  const categoryEntry = Object.entries(SMARTDOC_IDENTITY_CATEGORY_CODES).find(
    ([, value]) => value.code === categoryCode,
  );

  return {
    documentId,
    plNumber: plNumber!,
    categoryCode: categoryCode!,
    categoryLabel: categoryEntry?.[1].label ?? categoryCode!,
    typeCode: typeCode!,
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
