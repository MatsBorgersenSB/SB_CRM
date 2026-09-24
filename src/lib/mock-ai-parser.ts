import type { SmartDocCategory, SmartDocOrigin } from "@/types/smartdoc-library";
import { SMARTDOC_TYPES, suggestOriginForDocType } from "@/types/smartdoc-library";

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
      "permit application",
      "soknad om tillatelse",
      "søknad om tillatelse",
      "soknad om utslipp",
      "søknad om utslipp",
    ],
    DocCategory: "Quality",
    DocType: "Certificate",
    Origin: "external",
    reason: "Filename indicates a permit application to an authority",
  },
  {
    keywords: [
      "byggetillatelse",
      "rammetillatelse",
      "igangsettingstillatelse",
      "building permit",
    ],
    DocCategory: "Quality",
    DocType: "Certificate",
    Origin: "external",
    reason: "Filename indicates a municipal building permit",
  },
  {
    keywords: [
      "reguleringsplan",
      "planning permit",
      "zoning permit",
      "arealplan",
    ],
    DocCategory: "Quality",
    DocType: "Certificate",
    Origin: "external",
    reason: "Filename indicates a planning or zoning permit",
  },
  {
    keywords: [
      "operating licence",
      "operating license",
      "anleggskonsesjon",
      "konsesjon",
    ],
    DocCategory: "Quality",
    DocType: "Certificate",
    Origin: "external",
    reason: "Filename indicates an operating licence",
  },
  {
    keywords: [
      "tilsynsrapport",
      "tilsyn",
      "inspection report",
      "egenkontroll",
    ],
    DocCategory: "Quality",
    DocType: "Report",
    Origin: "external",
    reason: "Filename indicates an authority inspection or compliance report",
  },
  {
    keywords: [
      "environmental permit",
      "pollution permit",
      "discharge permit",
      "utslippstillatelse",
      "forurensningstillatelse",
      "forurensning",
      "forurensningsloven",
      "statsforvalteren",
      "miljodirektoratet",
      "miljødirektoratet",
      "tillatelse",
    ],
    DocCategory: "Quality",
    DocType: "Certificate",
    Origin: "external",
    reason: "Filename indicates an environmental or pollution permit",
  },
  {
    keywords: [
      "presentasjon",
      "presentation",
      "pitch deck",
      "slide deck",
    ],
    DocCategory: "Sales & Marketing",
    DocType: "Presentation",
    Origin: "standard_bio",
    reason: "Filename indicates a presentation",
  },
  {
    keywords: [
      "ordrebekreftelse",
      "order confirmation",
      "orderconfirmation",
      "order-confirm",
      "order_confirm",
    ],
    DocCategory: "Sales & Marketing",
    DocType: "Memo",
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
    DocCategory: "Sales & Marketing",
    DocType: "Shipping Doc",
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
    DocCategory: "Sales & Marketing",
    DocType: "Quotation",
    Origin: "external",
    reason: "Filename indicates a supplier quotation",
  },
  {
    keywords: ["rfq", "request for quotation", "request for quote"],
    DocCategory: "Sales & Marketing",
    DocType: "Request for Quotation",
    Origin: "external",
    reason: "Filename indicates a request for quotation",
  },
  {
    keywords: ["rfi", "request for information"],
    DocCategory: "Sales & Marketing",
    DocType: "Request for information",
    Origin: "external",
    reason: "Filename indicates a request for information",
  },
  {
    keywords: ["tilbud", "quote", "quotation"],
    DocCategory: "Sales & Marketing",
    DocType: "Quotation",
    Origin: "external",
    reason: "Imported quotation — treated as external unless you mark it Standard Bio",
  },
  {
    keywords: ["supplier invoice", "vendor invoice"],
    DocCategory: "Finance",
    DocType: "Invoice",
    Origin: "external",
    reason: "Filename indicates a supplier invoice",
  },
  {
    keywords: ["invoice", "receipt", "billing", "faktura"],
    DocCategory: "Finance",
    DocType: "Invoice",
    Origin: "external",
    reason: "Filename indicates an invoice or billing document",
  },
  {
    keywords: ["nda"],
    DocCategory: "Legal",
    DocType: "NDA",
    Origin: "external",
    reason: "Filename indicates a non-disclosure agreement",
  },
  {
    keywords: ["agreement", "contract", "kontrakt", "msa", "terms", "avtale"],
    DocCategory: "Legal",
    DocType: "Contract",
    Origin: "external",
    reason: "Filename indicates a contract or agreement",
  },
  {
    keywords: ["minutes", "mom", "møtereferat", "motereferat", "meeting notes"],
    DocCategory: "Project Management",
    DocType: "Minutes og Meeting",
    Origin: "standard_bio",
    reason: "Filename indicates meeting minutes",
  },
  {
    keywords: ["project plan", "projectplan", "fremdriftsplan"],
    DocCategory: "Project Management",
    DocType: "Projectplan",
    Origin: "standard_bio",
    reason: "Filename indicates a project plan",
  },
  {
    keywords: ["risk assessment", "ros-analyse", "risikoanalyse"],
    DocCategory: "Quality",
    DocType: "Risk Assessment",
    Origin: "standard_bio",
    reason: "Filename indicates a risk assessment",
  },
  {
    keywords: [
      "flow diagram",
      "flowdiagram",
      "flytdiagram",
      "prosessflyt",
      "process flow",
      "p&id",
      "drawing",
      "tegning",
    ],
    DocCategory: "Engineering",
    DocType: "Drawing",
    Origin: "external",
    reason: "Filename indicates a drawing or process diagram",
  },
  {
    keywords: ["datasheet", "data sheet"],
    DocCategory: "Engineering",
    DocType: "Datasheet",
    Origin: "standard_bio",
    reason: "Filename indicates a datasheet",
  },
  {
    keywords: ["specification", "spesifikasjon", "scope of work", "sow"],
    DocCategory: "Engineering",
    DocType: "Specification",
    Origin: "standard_bio",
    reason: "Filename indicates a specification",
  },
  {
    keywords: ["manual", "brukermanual", "procedure", "prosedyre"],
    DocCategory: "Engineering",
    DocType: "Manual",
    Origin: "standard_bio",
    reason: "Filename indicates a manual or procedure",
  },
  {
    keywords: ["calculation", "beregning", "heat balance"],
    DocCategory: "Engineering",
    DocType: "Calculation",
    Origin: "standard_bio",
    reason: "Filename indicates a calculation",
  },
  {
    keywords: ["report", "summary", "analysis", "rapport"],
    DocCategory: "Engineering",
    DocType: "Report",
    Origin: "unknown",
    reason: "Filename indicates a report — confirm origin",
  },
];

const DEFAULT_RESULT: DocIntelligenceResult = {
  DocCategory: "General",
  DocType: "Memo",
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

function fileExtension(fileName: string): string {
  const idx = fileName.lastIndexOf(".");
  return idx >= 0 ? fileName.slice(idx).toLowerCase() : "";
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
  if ((SMARTDOC_TYPES as readonly string[]).includes(docType)) {
    return { DocCategory: category, DocType: docType };
  }
  return { DocCategory: category, DocType: "Memo" };
}

export function classifyByFileName(fileName: string): DocIntelligenceResult {
  const normalized = fileName.toLowerCase().replace(/[_\-\s]+/g, " ");
  const referenceNumber = extractReferenceNumber(fileName);
  const counterparty = extractCounterpartyHint(fileName);
  const ext = fileExtension(fileName);

  // Explicit image handling so extracted ZIP pictures do not fall back to
  // "Unclassified Document". SCADA/screenshots are usually technical context.
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif", ".bmp", ".tif", ".tiff"].includes(ext)) {
    return {
      DocCategory: "Engineering",
      DocType: "Drawing",
      Origin: "unknown",
      Counterparty: counterparty,
      referenceNumber,
      reason: "Image attachment classified as an engineering drawing",
    };
  }

  if ([".ppt", ".pptx", ".pps", ".ppsx", ".odp", ".key"].includes(ext)) {
    return {
      DocCategory: "Sales & Marketing",
      DocType: "Presentation",
      Origin: "standard_bio",
      Counterparty: counterparty,
      referenceNumber,
      reason: "PowerPoint classified as a presentation — confirm origin if this came from the customer",
    };
  }

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
