import type { SmartDocCategory, SmartDocOrigin } from "@/types/smartdoc-library";
import {
  SMARTDOC_CATEGORIES,
  SMARTDOC_TYPES_BY_CATEGORY,
  suggestOriginForDocType,
} from "@/types/smartdoc-library";

export type DocIntelligenceResult = {
  DocCategory: SmartDocCategory;
  DocType: string;
  Origin: SmartDocOrigin;
  /** Suggested external producer when Origin = external. */
  Counterparty?: string;
  /** Optional order / reference number parsed from the filename. */
  referenceNumber?: string;
  reason: string;
};

type KeywordRule = {
  keywords: string[];
  DocCategory: SmartDocCategory;
  DocType: string;
  Origin?: SmartDocOrigin;
  reason: string;
};

const KEYWORD_RULES: KeywordRule[] = [
  {
    keywords: [
      "ordrebekreftelse",
      "order confirmation",
      "orderconfirmation",
      "order-confirm",
      "order_confirm",
    ],
    DocCategory: "Commercial",
    DocType: "Order Confirmation",
    Origin: "external",
    reason: "Filename indicates an external order confirmation",
  },
  {
    keywords: [
      "purchase order",
      "purchase-order",
      "po_",
      "innkjopsordre",
      "innkjøpsordre",
      "bestilling",
    ],
    DocCategory: "Commercial",
    DocType: "Customer Purchase Order",
    Origin: "external",
    reason: "Filename indicates a customer purchase order",
  },
  {
    keywords: [
      "supplier quotation",
      "supplier quote",
      "vendor quote",
      "vendor quotation",
      "leverandor",
      "leverandør",
    ],
    DocCategory: "Commercial",
    DocType: "Supplier Quotation",
    Origin: "external",
    reason: "Filename indicates a supplier quotation",
  },
  {
    keywords: ["tilbud", "quote", "quotation"],
    DocCategory: "Commercial",
    DocType: "Supplier Quotation",
    Origin: "external",
    reason: "Imported quotation — treated as external unless you mark it Standard Bio",
  },
  {
    keywords: ["supplier invoice", "vendor invoice"],
    DocCategory: "Financial",
    DocType: "Supplier Invoice",
    Origin: "external",
    reason: "Filename indicates a supplier invoice",
  },
  {
    keywords: ["invoice", "receipt", "billing", "faktura"],
    DocCategory: "Financial",
    DocType: "Invoice",
    Origin: "external",
    reason: "Filename indicates an invoice or billing document",
  },
  {
    keywords: ["third party", "third-party", "lab report", "consultant report"],
    DocCategory: "Technical",
    DocType: "Third-party Report",
    Origin: "external",
    reason: "Filename indicates a third-party report",
  },
  {
    keywords: ["agreement", "contract", "kontrakt", "nda", "msa", "terms", "avtale"],
    DocCategory: "Legal",
    DocType: "Signed Contract",
    Origin: "external",
    reason: "Filename indicates a contract or agreement",
  },
  {
    keywords: ["formal quotation", "budget quotation", "price indication"],
    DocCategory: "Commercial",
    DocType: "Formal Quotation",
    Origin: "standard_bio",
    reason: "Filename indicates a Standard Bio quotation",
  },
  {
    keywords: ["proposal", "rfp"],
    DocCategory: "Commercial",
    DocType: "Sales Proposal",
    Origin: "standard_bio",
    reason: "Filename indicates a Standard Bio proposal",
  },
  {
    keywords: ["specs", "specification", "datasheet", "manual", "technical", "teknisk"],
    DocCategory: "Technical",
    DocType: "Technical Datasheet",
    Origin: "standard_bio",
    reason: "Filename indicates a technical document",
  },
  {
    keywords: ["report", "summary", "analysis", "rapport"],
    DocCategory: "Operational",
    DocType: "Business Report",
    Origin: "unknown",
    reason: "Filename indicates a report — confirm origin",
  },
];

const DEFAULT_RESULT: DocIntelligenceResult = {
  DocCategory: "General",
  DocType: "Unclassified Document",
  Origin: "unknown",
  reason: "No strong filename signal — please confirm category, type, and origin",
};

function extractReferenceNumber(fileName: string): string | undefined {
  const patterns = [
    /ordrebekreftelse[^\d]*(\d{3,})/i,
    /order[_\s-]?confirm(?:ation)?[^\d]*(\d{3,})/i,
    /__(\d{3,})_/,
    /_(\d{4,})_/,
    /\b(\d{4,})\b/,
  ];
  for (const pattern of patterns) {
    const match = fileName.match(pattern);
    if (match?.[1]) return match[1];
  }
  return undefined;
}

/** Parse `fra_MJØRUD_AS` / `from ACME` style counterparty hints from filenames. */
export function extractCounterpartyHint(fileName: string): string | undefined {
  const patterns = [
    /(?:fra|from|av|by)[_\s-]+([A-Za-z0-9ÆØÅæøå][A-Za-z0-9ÆØÅæøå_\s.-]{1,60})/i,
    /_([A-ZÆØÅ][A-Za-zÆØÅæøå0-9]+(?:[_\s-][A-ZÆØÅ][A-Za-zÆØÅæøå0-9]+)*)\.(?:pdf|docx?|xlsx?)$/i,
  ];

  for (const pattern of patterns) {
    const match = fileName.match(pattern);
    if (!match?.[1]) continue;
    const cleaned = match[1]
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/\.(pdf|docx?|xlsx?)$/i, "")
      .trim();
    if (cleaned.length >= 2 && cleaned.length <= 80) return cleaned;
  }
  return undefined;
}

function ensureKnownType(
  category: SmartDocCategory,
  docType: string,
): { DocCategory: SmartDocCategory; DocType: string } {
  const types = SMARTDOC_TYPES_BY_CATEGORY[category] ?? [];
  if (types.includes(docType)) return { DocCategory: category, DocType: docType };

  for (const candidate of SMARTDOC_CATEGORIES) {
    if (SMARTDOC_TYPES_BY_CATEGORY[candidate].includes(docType)) {
      return { DocCategory: candidate, DocType: docType };
    }
  }

  return {
    DocCategory: category,
    DocType: types[0] ?? "Unclassified Document",
  };
}

export function classifyByFileName(fileName: string): DocIntelligenceResult {
  const normalized = fileName.toLowerCase().replace(/[_\-\s]+/g, " ");
  const referenceNumber = extractReferenceNumber(fileName);
  const counterparty = extractCounterpartyHint(fileName);

  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword.replace(/[_\-\s]+/g, " ")))) {
      const resolved = ensureKnownType(rule.DocCategory, rule.DocType);
      const origin = rule.Origin ?? suggestOriginForDocType(resolved.DocType);
      return {
        ...resolved,
        Origin: origin,
        Counterparty: origin === "external" ? counterparty : undefined,
        referenceNumber,
        reason: rule.reason,
      };
    }
  }

  return {
    ...DEFAULT_RESULT,
    Counterparty: counterparty,
    referenceNumber,
  };
}

/** Prefer original supplier/source filename so documents stay searchable. */
export function suggestImportDocumentName(input: {
  dealName: string;
  docType: string;
  originalFileName: string;
  referenceNumber?: string;
}): string {
  const original = input.originalFileName.trim();
  if (original) return original;

  const deal = input.dealName.trim() || "Opportunity";
  const type = input.docType.trim() || "Document";
  if (input.referenceNumber) {
    return `${deal} ${type} ${input.referenceNumber}`;
  }
  return `${deal} ${type}`;
}

const SIMULATED_LATENCY_MS = 400;

export function simulateDocIntelligence(
  fileName: string,
): Promise<DocIntelligenceResult> {
  const result = classifyByFileName(fileName);

  return new Promise((resolve) => {
    setTimeout(() => resolve(result), SIMULATED_LATENCY_MS);
  });
}
