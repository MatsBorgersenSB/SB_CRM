/**
 * FS-009 — Deterministic email sentiment + commitment extraction.
 * Advisory only (subject + bodyPreview). Reality First — no invented facts.
 * EN + NO commercial language. Pure / client-safe (no Prisma).
 */

export type EmailSentimentGrade =
  | "positive"
  | "neutral"
  | "cautious"
  | "negative";

export type EmailCommitmentKind =
  | "action_ask"
  | "promise"
  | "deadline"
  | "proposal";

export type EmailCommitmentSignal = {
  text: string;
  kind: EmailCommitmentKind;
  /** Whose side of the thread the cue came from. */
  side: "inbound" | "outbound";
};

type WeightedCue = { pattern: RegExp; weight: number };

const NEGATIVE_CUES: WeightedCue[] = [
  { pattern: /\b(reject(ed|ing)?|unacceptable|cancel(led|ing)?|terminate|breach)\b/i, weight: 4 },
  { pattern: /\b(deal[\s-]?breaker|walk away|no longer interested|not interested)\b/i, weight: 4 },
  { pattern: /\b(angry|frustrated|disappointed|unacceptable|complaint)\b/i, weight: 3 },
  { pattern: /\b(lawsuit|legal action|dispute|escalat(e|ion))\b/i, weight: 4 },
  // Norwegian
  { pattern: /\b(avviser|uakseptabelt|kansellerer|si opp|klage|skuffet|irritert)\b/i, weight: 3 },
  { pattern: /\b(ikke interessert|trekker oss|bryte avtalen)\b/i, weight: 4 },
];

const CAUTIOUS_CUES: WeightedCue[] = [
  { pattern: /\b(concern(ed|s)?|worried|hesitat(e|ion)|reluctant|uncertain)\b/i, weight: 2 },
  { pattern: /\b(delay(ed|ing)?|postpone(d|ment)?|on hold|push(ed)? back)\b/i, weight: 2 },
  { pattern: /\b(however|unfortunately|but we|subject to|depending on|if possible)\b/i, weight: 1 },
  { pattern: /\b(budget|funding|approval|permit|compliance).{0,40}\b(risk|issue|problem|block|unclear)\b/i, weight: 2 },
  { pattern: /\b(need more (time|info|details)|clarify|clarification|not sure)\b/i, weight: 2 },
  // Norwegian
  { pattern: /\b(bekymret|usikker|nølende|dessverre|utsett|forsink|på vent)\b/i, weight: 2 },
  { pattern: /\b(avhengig av|under forutsetning|trenger mer (tid|info)|avklar)\b/i, weight: 2 },
];

const POSITIVE_CUES: WeightedCue[] = [
  { pattern: /\b(excited|looking forward|great news|pleased|delighted|congratulations)\b/i, weight: 3 },
  { pattern: /\b(approve(d|al)?|green[\s-]?light|go ahead|confirmed|we agree|aligned)\b/i, weight: 3 },
  { pattern: /\b(progress|moving forward|next step|ready to (sign|proceed|order))\b/i, weight: 2 },
  { pattern: /\b(thank(s| you)|appreciate(d|s)?|excellent|perfect|sounds good)\b/i, weight: 1 },
  // Norwegian
  { pattern: /\b(ser frem til|glad for|enig|godkjent|klar til|fremgang|utmerket)\b/i, weight: 2 },
  { pattern: /\b(takk|setter pris på|super|perfekt|høres bra ut)\b/i, weight: 1 },
];

const ACTION_ASK_PATTERNS: RegExp[] = [
  /\b(please|kindly)\s+(send|provide|confirm|review|share|call|reply|advise|update|clarify)\b/i,
  /\b(can you|could you|would you|will you)\s+/i,
  /\b(we need|we require|requesting|looking for|waiting for|awaiting)\b/i,
  /\b(action required|next steps?|please advise|\basap\b)\b/i,
  /\b(kan du|kan dere|vennligst|trenger|ber om|send(e)?\s+(oss|meg)|følg\s+opp)\b/i,
  /\b(trenger\s+(dokumentasjon|tilbud|svar|bekreftelse)|send\s+dokumentasjon)\b/i,
];

const PROMISE_PATTERNS: RegExp[] = [
  /\b(i will|we'll|we will|i'll)\s+(send|provide|share|call|follow up|get back|prepare)\b/i,
  /\b(jeg (skal|sender)|vi (skal|sender)|kommer tilbake|følger opp)\b/i,
];

const DEADLINE_PATTERNS: RegExp[] = [
  /\b(by|before|deadline|due)\s+(monday|tuesday|wednesday|thursday|friday|eod|cob|\d{1,2}[./-]\d{1,2})\b/i,
  /\b(within|in)\s+\d+\s+(days?|business days|uker?|dager?)\b/i,
  /\b(innen|frist|senest)\s+\d+/i,
];

const PROPOSAL_PATTERNS: RegExp[] = [
  /\b(proposal|quotation|quote|tilbud|forslag|RFP|tilbudsforespørsel)\b/i,
];

function scoreCues(text: string, cues: WeightedCue[]): number {
  let score = 0;
  for (const cue of cues) {
    if (cue.pattern.test(text)) score += cue.weight;
  }
  return score;
}

function firstMatchExcerpt(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const index = Math.max(0, (match.index ?? 0) - 20);
    return text.slice(index, index + 140).replace(/\s+/g, " ").trim();
  }
  return null;
}

/**
 * Grade commercial tone from subject + preview only.
 * Negative / cautious outrank weak positive politeness (thanks).
 */
export function gradeEmailSentiment(
  subject: string,
  bodyPreview?: string | null,
): EmailSentimentGrade {
  const text = `${subject ?? ""}\n${bodyPreview ?? ""}`.trim();
  if (!text) return "neutral";

  const negative = scoreCues(text, NEGATIVE_CUES);
  const cautious = scoreCues(text, CAUTIOUS_CUES);
  const positive = scoreCues(text, POSITIVE_CUES);

  if (negative >= 3) return "negative";
  if (negative >= 1 && negative >= positive) return "negative";
  if (cautious >= 2 && cautious >= positive) return "cautious";
  if (cautious >= 1 && positive <= 1) return "cautious";
  if (positive >= 3) return "positive";
  if (positive >= 2 && negative === 0) return "positive";
  return "neutral";
}

/**
 * Extract commitment-like cues from a message. Advisory — user decides persistence.
 */
export function extractEmailCommitments(
  subject: string,
  bodyPreview: string | null | undefined,
  isOutbound: boolean,
): EmailCommitmentSignal[] {
  const text = `${subject ?? ""}\n${bodyPreview ?? ""}`.trim();
  if (!text) return [];

  const side: EmailCommitmentSignal["side"] = isOutbound ? "outbound" : "inbound";
  const signals: EmailCommitmentSignal[] = [];

  const ask = firstMatchExcerpt(text, ACTION_ASK_PATTERNS);
  if (ask && !isOutbound) {
    signals.push({ text: ask, kind: "action_ask", side });
  }

  const promise = firstMatchExcerpt(text, PROMISE_PATTERNS);
  if (promise) {
    signals.push({ text: promise, kind: "promise", side });
  }

  const deadline = firstMatchExcerpt(text, DEADLINE_PATTERNS);
  if (deadline) {
    signals.push({ text: deadline, kind: "deadline", side });
  }

  if (PROPOSAL_PATTERNS.some((pattern) => pattern.test(text))) {
    const proposal = firstMatchExcerpt(text, PROPOSAL_PATTERNS) ?? subject;
    signals.push({ text: proposal.slice(0, 140), kind: "proposal", side });
  }

  // Dedupe by kind
  const seen = new Set<string>();
  return signals.filter((signal) => {
    const key = `${signal.kind}:${signal.text.slice(0, 40).toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Map to Prisma SentimentGrade string union. */
export function toPrismaSentimentGrade(
  grade: EmailSentimentGrade,
): "positive" | "neutral" | "cautious" | "negative" {
  return grade;
}
