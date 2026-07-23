/**
 * FS-012 — Email Copilot
 * Deterministic, context-aware draft generation (no invented facts).
 */

export type EmailDraftTone = "professional" | "warm" | "direct" | "formal";

export type GenerateEmailDraftInput = {
  /** Free-text business context already known to SmartCRM */
  context: string;
  contactName: string;
  dealStage?: string | null;
  tone?: EmailDraftTone;
  companyName?: string | null;
  objective?: string | null;
};

export type EmailDraftResult = {
  subject: string;
  body: string;
  /** 0–100 confidence that the draft matches available context */
  confidenceScore: number;
  tone: EmailDraftTone;
  rationale: string;
};

const TONE_OPENERS: Record<EmailDraftTone, string> = {
  professional: "I hope this note finds you well.",
  warm: "It was good to reconnect — thank you for the time.",
  direct: "Quick follow-up on our discussion.",
  formal: "I am writing to follow up on our recent conversation.",
};

const TONE_CLOSERS: Record<EmailDraftTone, string> = {
  professional: "Please let me know a convenient time to continue.",
  warm: "Happy to adapt to what works best on your side.",
  direct: "What is the best next step from your side?",
  formal: "I look forward to your guidance on the appropriate next step.",
};

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function firstName(contactName: string): string {
  const trimmed = contactName.trim();
  if (!trimmed) return "there";
  return trimmed.split(/\s+/)[0] ?? trimmed;
}

/**
 * Generate a structured email draft from known CRM context.
 * Does not invent stakeholders, commitments, or commercial terms.
 */
export function generateEmailDraft(input: GenerateEmailDraftInput): EmailDraftResult {
  const tone = input.tone ?? "professional";
  const name = input.contactName.trim() || "there";
  const greetingName = firstName(name);
  const context = input.context.trim();
  const stage = input.dealStage?.trim() || null;
  const company = input.companyName?.trim() || null;
  const objective = input.objective?.trim() || null;

  let confidence = 45;
  if (context.length > 40) confidence += 20;
  if (stage) confidence += 10;
  if (company) confidence += 8;
  if (objective) confidence += 12;
  if (input.contactName.trim().length > 1) confidence += 5;

  const stageClause = stage
    ? `As we progress through ${stage},`
    : "As we continue our discussion,";

  const companyClause = company ? ` with ${company}` : "";
  const contextParagraph = context
    ? context
    : "I wanted to follow up on our recent interaction and confirm alignment on next steps.";

  const objectiveParagraph = objective
    ? `\n\nOur focus remains: ${objective}`
    : "";

  const subjectParts = [
    stage ? `${stage}:` : null,
    objective
      ? objective.slice(0, 60)
      : context
        ? `Follow-up${companyClause}`
        : `Next steps${companyClause}`,
  ].filter(Boolean);

  const subject = subjectParts.join(" ").replace(/\s+/g, " ").trim();

  const body = [
    `Dear ${greetingName},`,
    "",
    TONE_OPENERS[tone],
    "",
    `${stageClause} ${contextParagraph}${objectiveParagraph}`,
    "",
    TONE_CLOSERS[tone],
    "",
    "Best regards",
  ].join("\n");

  const rationale = [
    context ? "Draft grounded in provided context." : "Limited context — generic follow-up used.",
    stage ? `Stage-aware (${stage}).` : null,
    objective ? "Objective reflected in subject/body." : null,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    subject,
    body,
    confidenceScore: clampConfidence(confidence),
    tone,
    rationale,
  };
}
