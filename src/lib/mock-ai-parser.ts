export type DocIntelligenceResult = {
  DocCategory: string;
  DocType: string;
};

type KeywordRule = {
  keywords: string[];
  DocCategory: string;
  DocType: string;
};

const KEYWORD_RULES: KeywordRule[] = [
  {
    keywords: ["invoice", "receipt", "purchase-order", "po_", "billing"],
    DocCategory: "Financial",
    DocType: "Invoice",
  },
  {
    keywords: ["agreement", "contract", "nda", "msa", "terms"],
    DocCategory: "Legal",
    DocType: "NDA Contract",
  },
  {
    keywords: ["specs", "specification", "datasheet", "manual", "technical"],
    DocCategory: "Technical",
    DocType: "Technical Datasheet",
  },
  {
    keywords: ["report", "summary", "analysis"],
    DocCategory: "Operational",
    DocType: "Business Report",
  },
  {
    keywords: ["proposal", "quote", "rfp"],
    DocCategory: "Commercial",
    DocType: "Sales Proposal",
  },
];

const DEFAULT_RESULT: DocIntelligenceResult = {
  DocCategory: "General",
  DocType: "Unclassified Document",
};

export function classifyByFileName(fileName: string): DocIntelligenceResult {
  const normalized = fileName.toLowerCase().replace(/[_\-\s]+/g, " ");

  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((keyword) => normalized.includes(keyword))) {
      return {
        DocCategory: rule.DocCategory,
        DocType: rule.DocType,
      };
    }
  }

  return DEFAULT_RESULT;
}

const SIMULATED_LATENCY_MS = 1500;

export function simulateDocIntelligence(
  fileName: string,
): Promise<DocIntelligenceResult> {
  const result = classifyByFileName(fileName);

  return new Promise((resolve) => {
    setTimeout(() => resolve(result), SIMULATED_LATENCY_MS);
  });
}
