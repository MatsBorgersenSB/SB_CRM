/**
 * FS-012 — Meeting Intelligence extractor
 * Heuristic extraction from raw notes — never invents people or commitments.
 */

export type MeetingActionItem = {
  action: string;
  ownerHint: string | null;
  dueHint: string | null;
  priority: "High" | "Medium" | "Low";
};

export type MeetingInsights = {
  keyCommitments: string[];
  /** -1 (negative) to +1 (positive) */
  sentimentScore: number;
  sentimentLabel: "Negative" | "Neutral" | "Positive";
  actionItems: MeetingActionItem[];
  summary: string;
  confidenceScore: number;
};

const COMMITMENT_PATTERNS = [
  /\b(?:we|they|i|he|she)\s+(?:will|shall|agree(?:d)?\s+to|commit(?:ted)?\s+to)\s+([^.!?\n]{8,120})/gi,
  /\b(?:action|follow[- ]?up|next step)[:\s—-]+([^.!?\n]{8,120})/gi,
  /\b(?:promised|confirmed|decided)\s+(?:to\s+)?([^.!?\n]{8,120})/gi,
];

const ACTION_LINE =
  /^(?:[-*•]|\d+[.)])\s*(.+)$/gm;

const OWNER_HINT =
  /\b(?:owner|assigned to|@)\s*[:\s]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i;

const DUE_HINT =
  /\b(?:by|due|before)\s+((?:\d{1,2}[/-]\d{1,2}(?:[/-]\d{2,4})?)|(?:next\s+\w+)|(?:end of (?:week|month))|(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday))/i;

const POSITIVE_WORDS = [
  "progress",
  "aligned",
  "excited",
  "positive",
  "agree",
  "approved",
  "support",
  "confident",
  "opportunity",
  "strong",
];

const NEGATIVE_WORDS = [
  "concern",
  "delay",
  "risk",
  "blocked",
  "issue",
  "disagree",
  "budget",
  "uncertain",
  "pushback",
  "cancel",
  "stalled",
];

function uniqueTrimmed(items: string[], limit: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const value = raw.replace(/\s+/g, " ").trim().replace(/[.;,]+$/, "");
    if (value.length < 8) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= limit) break;
  }
  return out;
}

function scoreSentiment(text: string): { score: number; label: MeetingInsights["sentimentLabel"] } {
  const lower = text.toLowerCase();
  let pos = 0;
  let neg = 0;
  for (const word of POSITIVE_WORDS) {
    if (lower.includes(word)) pos += 1;
  }
  for (const word of NEGATIVE_WORDS) {
    if (lower.includes(word)) neg += 1;
  }
  const total = pos + neg;
  if (total === 0) return { score: 0, label: "Neutral" };
  const score = Math.max(-1, Math.min(1, (pos - neg) / Math.max(3, total)));
  if (score > 0.2) return { score, label: "Positive" };
  if (score < -0.2) return { score, label: "Negative" };
  return { score, label: "Neutral" };
}

function inferPriority(text: string): MeetingActionItem["priority"] {
  const lower = text.toLowerCase();
  if (/\b(urgent|asap|critical|blocker|immediately)\b/.test(lower)) return "High";
  if (/\b(when possible|later|nice to have|optional)\b/.test(lower)) return "Low";
  return "Medium";
}

/**
 * Extract commitments, sentiment, and action items from meeting notes.
 */
export function extractMeetingInsights(rawNotes: string): MeetingInsights {
  const notes = rawNotes?.trim() ?? "";
  if (!notes) {
    return {
      keyCommitments: [],
      sentimentScore: 0,
      sentimentLabel: "Neutral",
      actionItems: [],
      summary: "No meeting notes provided.",
      confidenceScore: 0,
    };
  }

  const commitments: string[] = [];
  for (const pattern of COMMITMENT_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(notes)) !== null) {
      if (match[1]) commitments.push(match[1]);
    }
  }

  const actionItems: MeetingActionItem[] = [];
  ACTION_LINE.lastIndex = 0;
  let lineMatch: RegExpExecArray | null;
  while ((lineMatch = ACTION_LINE.exec(notes)) !== null) {
    const action = lineMatch[1]?.trim();
    if (!action || action.length < 6) continue;
    const owner = action.match(OWNER_HINT)?.[1] ?? null;
    const due = action.match(DUE_HINT)?.[1] ?? null;
    actionItems.push({
      action,
      ownerHint: owner,
      dueHint: due,
      priority: inferPriority(action),
    });
  }

  // Promote commitment phrases that look like actions when bullets are sparse
  if (actionItems.length === 0) {
    for (const commitment of uniqueTrimmed(commitments, 5)) {
      actionItems.push({
        action: commitment,
        ownerHint: commitment.match(OWNER_HINT)?.[1] ?? null,
        dueHint: commitment.match(DUE_HINT)?.[1] ?? null,
        priority: inferPriority(commitment),
      });
    }
  }

  const keyCommitments = uniqueTrimmed(commitments, 6);
  const { score, label } = scoreSentiment(notes);

  let confidence = 30;
  if (notes.length > 80) confidence += 15;
  if (notes.length > 240) confidence += 10;
  confidence += Math.min(25, keyCommitments.length * 8);
  confidence += Math.min(20, actionItems.length * 5);

  const summaryParts = [
    keyCommitments.length > 0
      ? `${keyCommitments.length} commitment${keyCommitments.length === 1 ? "" : "s"} identified`
      : "No explicit commitments detected",
    `${actionItems.length} action item${actionItems.length === 1 ? "" : "s"}`,
    `sentiment ${label.toLowerCase()}`,
  ];

  return {
    keyCommitments,
    sentimentScore: Math.round(score * 100) / 100,
    sentimentLabel: label,
    actionItems: actionItems.slice(0, 8),
    summary: summaryParts.join(" · "),
    confidenceScore: Math.max(0, Math.min(100, confidence)),
  };
}
