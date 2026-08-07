import type { SmartDocCategory } from "@/types/smartdoc-library";
import { SMARTDOC_CATEGORIES, SMARTDOC_TYPES_BY_CATEGORY } from "@/types/smartdoc-library";

export type DocIntelligenceResult = {
  DocCategory: SmartDocCategory;
  DocType: string;
  /** Optional order / reference number parsed from the filename. */
  referenceNumber?: string;
  reason: string;
};

type KeywordRule = {
  keywords: string[];
  DocCategory: SmartDocCategory;
  DocType: string;
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
      "bekreftelse",
    ],
    DocCategory: "Commercial",
    DocType: "Order Confirmation",
    reason: "Filename indicates an order confirmation",
  },
  {
    keywords: ["invoice", "receipt", "purchase-order", "po_", "billing", "faktura"],
    DocCategory: "Financial",
    DocType: "Invoice",
    reason: "Filename indicates an invoice or billing document",
  },
  {
    keywords: ["agreement", "contract", "kontrakt", "nda", "msa", "terms", "avtale"],
    DocCategory: "Legal",
    DocType: "Signed Contract",
    reason: "Filename indicates a contract or agreement",
  },
  {
    keywords: ["specs", "specification", "datasheet", "manual", "technical", "teknisk"],
    DocCategory: "Technical",
    DocType: "Technical Datasheet",
    reason: "Filename indicates a technical document",
  },
  {
    keywords: ["report", "summary", "analysis", "rapport"],
    DocCategory: "Operational",
    DocType: "Business Report",
    reason: "Filename indicates a report",
  },
  {
    keywords: ["proposal", "quote", "quotation", "tilbud", "rfp"],
    DocCategory: "Commercial",
    DocType: "Sales Proposal",
    reason: "Filename indicates a proposal or quotation",
  },
];

const DEFAULT_RESULT: DocIntelligenceResult = {
  DocCategory: "General",
  DocType: "Unclassified Document",
  reason: "No strong filename signal — please confirm category and type",
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

  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword.replace(/[_\-\s]+/g, " ")))) {
      const resolved = ensureKnownType(rule.DocCategory, rule.DocType);
      return {
        ...resolved,
        referenceNumber,
        reason: rule.reason,
      };
    }
  }

  return {
    ...DEFAULT_RESULT,
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
