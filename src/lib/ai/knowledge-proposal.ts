/**
 * FS-021 — KnowledgeProposal: the only thing an LLM extraction may produce.
 * Pure + dependency-free so it can be tested without a model.
 *
 * Reality First: a proposal without a verifiable source quote, a stated impact,
 * or a valid type is discarded. Empty output is valid.
 */

export const KNOWLEDGE_TYPES = [
  "fact",
  "decision",
  "risk",
  "commitment",
  "relationship",
  "unknown",
] as const;
export type KnowledgeType = (typeof KNOWLEDGE_TYPES)[number];

export const KNOWLEDGE_CONFIDENCE = ["high", "moderate", "low"] as const;
export type KnowledgeConfidence = (typeof KNOWLEDGE_CONFIDENCE)[number];

export type KnowledgeSourceRef = {
  kind: "meeting" | "email" | "document" | "teams" | "note";
  id: string | null;
  /** Plain-language label, e.g. "Teams meeting on 12 Oct". */
  label: string;
};

export type KnowledgeProposal = {
  type: KnowledgeType;
  /** One business-prose sentence. */
  statement: string;
  /** Why it matters — mandatory. */
  impact: string;
  /** Quote that exists verbatim (normalised) in the source. */
  evidence: string;
  confidence: KnowledgeConfidence;
  source: KnowledgeSourceRef;
  /** Only kept when the name appears in the source text. */
  ownerHint: string | null;
  /** Only kept when the phrase appears in the source text. */
  dueHint: string | null;
};

export type RejectedProposal = { reason: string; raw: unknown };

export type ProposalValidation = {
  proposals: KnowledgeProposal[];
  rejected: RejectedProposal[];
};

export const MAX_PROPOSALS = 20;

/** Lowercase, unify quotes/dashes, collapse whitespace. */
export function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u2018\u2019\u201B]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hintIfInSource(value: unknown, normalizedSource: string): string | null {
  const text = str(value);
  if (!text) return null;
  return normalizedSource.includes(normalizeForMatch(text)) ? text : null;
}

/**
 * Validate raw model output against the source text.
 * Never throws; invalid items are returned in `rejected` for logging/evals.
 */
export function validateProposals(
  raw: unknown,
  sourceText: string,
  source: KnowledgeSourceRef,
): ProposalValidation {
  const proposals: KnowledgeProposal[] = [];
  const rejected: RejectedProposal[] = [];

  if (!Array.isArray(raw)) return { proposals, rejected };

  const normalizedSource = normalizeForMatch(sourceText);
  const seen = new Set<string>();

  for (const item of raw) {
    if (proposals.length >= MAX_PROPOSALS) {
      rejected.push({ reason: "over_limit", raw: item });
      continue;
    }
    if (!item || typeof item !== "object") {
      rejected.push({ reason: "not_an_object", raw: item });
      continue;
    }
    const record = item as Record<string, unknown>;

    const type = str(record.type) as KnowledgeType;
    if (!KNOWLEDGE_TYPES.includes(type)) {
      rejected.push({ reason: "invalid_type", raw: item });
      continue;
    }

    const statement = str(record.statement);
    if (!statement) {
      rejected.push({ reason: "missing_statement", raw: item });
      continue;
    }

    const impact = str(record.impact);
    if (!impact) {
      rejected.push({ reason: "missing_impact", raw: item });
      continue;
    }

    const evidence = str(record.evidence);
    if (!evidence) {
      rejected.push({ reason: "missing_evidence", raw: item });
      continue;
    }
    if (!normalizedSource.includes(normalizeForMatch(evidence))) {
      rejected.push({ reason: "evidence_not_in_source", raw: item });
      continue;
    }

    const confidenceRaw = str(record.confidence) as KnowledgeConfidence;
    const confidence = KNOWLEDGE_CONFIDENCE.includes(confidenceRaw)
      ? confidenceRaw
      : "low";

    const key = `${type}:${normalizeForMatch(statement)}`;
    if (seen.has(key)) {
      rejected.push({ reason: "duplicate", raw: item });
      continue;
    }
    seen.add(key);

    proposals.push({
      type,
      statement,
      impact,
      evidence,
      confidence,
      source,
      ownerHint: hintIfInSource(record.ownerHint, normalizedSource),
      dueHint: hintIfInSource(record.dueHint, normalizedSource),
    });
  }

  return { proposals, rejected };
}
