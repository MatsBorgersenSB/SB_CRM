/**
 * Zero-Touch Signal & Decision Extractor
 * Parses unstructured meeting notes / emails into decisions, commitments, and risks.
 * Rule-based first (deterministic, Reality First) — no invented facts.
 */

export type DecisionCategory =
  | "Technical"
  | "Commercial"
  | "Legal"
  | "Strategic"
  | "Other";

export type ExtractedDecision = {
  decisionText: string;
  rationale?: string;
  category: DecisionCategory;
  stakeholderName?: string;
  confidenceScore: number;
};

export type ExtractedCommitment = {
  title: string;
  assignee?: string;
  dueDate?: string;
  confidenceScore: number;
};

export type ExtractedRisk = {
  severity: "low" | "medium" | "high";
  description: string;
  confidenceScore: number;
};

export type ExtractedSignals = {
  decisions: ExtractedDecision[];
  commitments: ExtractedCommitment[];
  risks: ExtractedRisk[];
  summary: string;
};

const DECISION_PATTERNS = [
  /(?:^|\n)\s*(?:decision|decided|agreed|approved|we will proceed|customer decided|they decided)[:\s\-–—]+(.+)/gi,
  /(?:^|\n)\s*[-*•]\s*(.+?\b(?:decided|approved|agreed to|will go with|selected)\b.+)/gi,
];

const COMMITMENT_PATTERNS = [
  /(?:^|\n)\s*(?:action|commitment|todo|follow[- ]?up|next step|we will|i will|they will)[:\s\-–—]+(.+)/gi,
  /(?:^|\n)\s*[-*•]\s*(.+?\b(?:will|shall|to be done|by\s+\d{1,2}[\/\-]\d{1,2}|by\s+(?:mon|tue|wed|thu|fri|monday|friday|next week))\b.+)/gi,
];

const RISK_PATTERNS = [
  /(?:^|\n)\s*(?:risk|objection|concern|blocker|issue|worried about)[:\s\-–—]+(.+)/gi,
  /(?:^|\n)\s*[-*•]\s*(.+?\b(?:risk|concern|objection|blocker|delay|uncertain)\b.+)/gi,
];

const CATEGORY_HINTS: Array<{ category: DecisionCategory; pattern: RegExp }> = [
  { category: "Technical", pattern: /\b(tech|technical|feedstock|reactor|spec|engineering|design|capacity)\b/i },
  { category: "Commercial", pattern: /\b(price|commercial|contract|budget|cost|margin|payment|offer)\b/i },
  { category: "Legal", pattern: /\b(legal|contract clause|nda|liability|compliance|permit|regulation)\b/i },
  { category: "Strategic", pattern: /\b(strateg|partner|market|expansion|priority|roadmap|vision)\b/i },
];

function cleanLine(value: string): string {
  return value.replace(/^[-*•\d.)\s]+/, "").replace(/\s+/g, " ").trim();
}

function uniqueByText<T extends { confidenceScore: number }>(
  items: T[],
  getText: (item: T) => string,
): T[] {
  const seen = new Map<string, T>();
  for (const item of items) {
    const key = getText(item).toLowerCase();
    if (!key || key.length < 8) continue;
    const existing = seen.get(key);
    if (!existing || item.confidenceScore > existing.confidenceScore) {
      seen.set(key, item);
    }
  }
  return [...seen.values()];
}

function inferCategory(text: string): DecisionCategory {
  for (const hint of CATEGORY_HINTS) {
    if (hint.pattern.test(text)) return hint.category;
  }
  return "Other";
}

function extractStakeholder(text: string): string | undefined {
  const match = text.match(
    /\b(?:from|by|with|per)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/,
  );
  return match?.[1];
}

function extractAssignee(text: string): string | undefined {
  const match =
    text.match(/\b(?:assign(?:ed)?(?:\s+to)?|owner|responsible)\s*[:\-]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i) ??
    text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(?:will|to)\b/);
  return match?.[1];
}

function extractDueDate(text: string): string | undefined {
  const iso = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];

  const slash = text.match(/\b(\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?)\b/);
  if (slash) return slash[1];

  const relative = text.match(
    /\bby\s+(next\s+week|friday|monday|end of (?:week|month)|eow|eom)\b/i,
  );
  if (relative) {
    const now = new Date();
    const label = relative[1]!.toLowerCase();
    if (label.includes("friday") || label === "eow" || label.includes("end of week")) {
      const day = now.getDay();
      const add = (5 - day + 7) % 7 || 7;
      now.setDate(now.getDate() + add);
    } else if (label.includes("monday")) {
      const day = now.getDay();
      const add = (1 - day + 7) % 7 || 7;
      now.setDate(now.getDate() + add);
    } else {
      now.setDate(now.getDate() + 7);
    }
    return now.toISOString().slice(0, 10);
  }

  return undefined;
}

function inferRiskSeverity(text: string): ExtractedRisk["severity"] {
  if (/\b(critical|blocker|showstopper|high)\b/i.test(text)) return "high";
  if (/\b(medium|moderate|concern)\b/i.test(text)) return "medium";
  return "low";
}

function collectMatches(text: string, patterns: RegExp[]): string[] {
  const hits: string[] = [];
  for (const pattern of patterns) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      const cleaned = cleanLine(match[1] ?? "");
      if (cleaned) hits.push(cleaned);
    }
  }
  return hits;
}

function sectionBlocks(rawText: string): {
  decisions: string[];
  commitments: string[];
  risks: string[];
} {
  const decisions: string[] = [];
  const commitments: string[] = [];
  const risks: string[] = [];

  const sections = rawText.split(/(?=^(?:decisions?|commitments?|actions?|risks?|objections?)\b[:\s]*)/gim);
  for (const section of sections) {
    const header = section.match(/^(decisions?|commitments?|actions?|risks?|objections?)\b/i)?.[1]?.toLowerCase() ?? "";
    const lines = section
      .split(/\n/)
      .slice(1)
      .map(cleanLine)
      .filter((line) => line.length >= 8);

    if (/decision/.test(header)) decisions.push(...lines);
    else if (/commitment|action/.test(header)) commitments.push(...lines);
    else if (/risk|objection/.test(header)) risks.push(...lines);
  }

  return { decisions, commitments, risks };
}

/**
 * Parse unstructured text into structured organizational signals.
 * Async for future LLM enrichment without changing call sites.
 */
export async function extractSignalsFromText(rawText: string): Promise<ExtractedSignals> {
  const text = rawText.replace(/\r\n/g, "\n").trim();
  if (!text) {
    return { decisions: [], commitments: [], risks: [], summary: "No text provided." };
  }

  const fromSections = sectionBlocks(text);

  const decisionHits = uniqueByText(
    [
      ...fromSections.decisions.map((decisionText) => ({
        decisionText,
        rationale: undefined as string | undefined,
        category: inferCategory(decisionText),
        stakeholderName: extractStakeholder(decisionText),
        confidenceScore: 0.72,
      })),
      ...collectMatches(text, DECISION_PATTERNS).map((decisionText) => ({
        decisionText,
        rationale: undefined as string | undefined,
        category: inferCategory(decisionText),
        stakeholderName: extractStakeholder(decisionText),
        confidenceScore: 0.65,
      })),
    ],
    (item) => item.decisionText,
  ).slice(0, 12);

  const commitmentHits = uniqueByText(
    [
      ...fromSections.commitments.map((title) => ({
        title,
        assignee: extractAssignee(title),
        dueDate: extractDueDate(title),
        confidenceScore: 0.7,
      })),
      ...collectMatches(text, COMMITMENT_PATTERNS).map((title) => ({
        title,
        assignee: extractAssignee(title),
        dueDate: extractDueDate(title),
        confidenceScore: 0.62,
      })),
    ],
    (item) => item.title,
  ).slice(0, 12);

  const riskHits = uniqueByText(
    [
      ...fromSections.risks.map((description) => ({
        severity: inferRiskSeverity(description),
        description,
        confidenceScore: 0.7,
      })),
      ...collectMatches(text, RISK_PATTERNS).map((description) => ({
        severity: inferRiskSeverity(description),
        description,
        confidenceScore: 0.6,
      })),
    ],
    (item) => item.description,
  ).slice(0, 12);

  const parts = [
    decisionHits.length ? `${decisionHits.length} decision(s)` : null,
    commitmentHits.length ? `${commitmentHits.length} commitment(s)` : null,
    riskHits.length ? `${riskHits.length} risk(s)` : null,
  ].filter(Boolean);

  return {
    decisions: decisionHits,
    commitments: commitmentHits,
    risks: riskHits,
    summary: parts.length
      ? `Extracted ${parts.join(", ")} from pasted text.`
      : "No clear decisions, commitments, or risks detected. Try labeled sections (Decision / Action / Risk).",
  };
}
