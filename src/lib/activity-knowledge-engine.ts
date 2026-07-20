import type { Activity, ActivityStakeholder } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { ActivityKnowledgeDraft } from "@/types/activity-knowledge";

export type KnowledgeCaptureContext = {
  activityType: Activity["ActivityType"];
  subject?: string;
  company?: Company;
  deal?: PipelineRow;
  contactName?: string;
  existingDescription?: string;
  existingSummary?: string;
};

function addDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function dealLabel(deal?: PipelineRow): string {
  return deal?.assetName ?? deal?.id ?? "the opportunity";
}

function companyLabel(company?: Company): string {
  return company?.Title ?? "the customer";
}

function buildAssessment(
  draft: Omit<ActivityKnowledgeDraft, "assessment">,
): ActivityKnowledgeDraft["assessment"] {
  const filled = [
    draft.whatHappened,
    draft.decisions.length > 0,
    draft.commitments.length > 0 || draft.whatHappensNext,
    draft.risks.length > 0,
    draft.summary,
  ].filter(Boolean).length;

  const completenessScore = Math.round((filled / 5) * 100);
  const gaps: string[] = [];
  if (!draft.decisions.length) gaps.push("No explicit customer decisions captured");
  if (!draft.commitments.length && !draft.whatHappensNext) {
    gaps.push("No commitments or next steps defined");
  }
  if (!draft.risks.length) gaps.push("No commercial or project risks identified");

  const recommendations: string[] = [];
  if (draft.whatHappensNext) {
    recommendations.push(`Schedule follow-up: ${draft.whatHappensNext}`);
  }
  if (draft.risks.length) {
    recommendations.push("Review risks in next commercial viability assessment");
  }
  if (!draft.linkedDocuments.length && draft.commitments.some((c) => c.text.toLowerCase().includes("proposal"))) {
    recommendations.push("Link budget proposal document when available");
  }

  return {
    generatedAt: new Date().toISOString(),
    confidence: completenessScore >= 80 ? "high" : completenessScore >= 50 ? "medium" : "low",
    summary: `Knowledge capture ${completenessScore}% complete — ${draft.decisions.length} decisions, ${draft.commitments.length} commitments, ${draft.risks.length} risks.`,
    completenessScore,
    gaps,
    recommendations,
  };
}

function meetingDraft(ctx: KnowledgeCaptureContext): Omit<ActivityKnowledgeDraft, "assessment"> {
  const customer = companyLabel(ctx.company);
  const opportunity = dealLabel(ctx.deal);
  const contact = ctx.contactName ?? "customer stakeholders";

  return {
    summary: `${customer} workshop aligned on next steps for ${opportunity}.`,
    whatHappened: [
      `${ctx.activityType} with ${contact} at ${customer}.`,
      `Discussed implementation scope, timeline, and commercial prerequisites for ${opportunity}.`,
      ctx.existingDescription?.trim() || "Customer confirmed progress and requested structured follow-up.",
    ].join(" "),
    whatWasAgreed: [
      "Technical scope boundaries confirmed for current phase",
      "Commercial proposal timeline agreed with customer",
    ],
    whatHappensNext: "Prepare budget proposal for board review",
    whatHappensNextDue: addDays(14),
    decisions: [
      `Selected preferred implementation approach for ${opportunity}`,
      "Confirmed internal steering group review before contract signature",
    ],
    commitments: [
      { text: "Budget proposal to be delivered before board review", dueDate: addDays(14), status: "Open" },
      { text: "Utility review workshop to be scheduled", dueDate: addDays(21), status: "Planned" },
    ],
    risks: [
      "Financing still unresolved",
      "Single stakeholder dependency on technical sign-off",
    ],
    linkedDocuments: [],
    linkedDeals: ctx.deal ? [{ Id: 0, Title: ctx.deal.id }] : [],
    linkedContacts: ctx.contactName ? [{ Id: 0, Title: ctx.contactName }] : [],
  };
}

function callDraft(ctx: KnowledgeCaptureContext): Omit<ActivityKnowledgeDraft, "assessment"> {
  const customer = companyLabel(ctx.company);
  const opportunity = dealLabel(ctx.deal);

  return {
    summary: `Customer confirmed feedstock availability for ${opportunity}.`,
    whatHappened: [
      `Phone call with ${ctx.contactName ?? customer} regarding ${opportunity}.`,
      ctx.existingDescription?.trim() || "Discussed operational readiness and supply chain constraints.",
    ].join(" "),
    whatWasAgreed: [
      "Provisional volume and quality parameters accepted",
      "Follow-up sample request agreed",
    ],
    whatHappensNext: "Request material sample and moisture certification",
    whatHappensNextDue: addDays(7),
    decisions: ["Proceed with proposed feedstock specification for trial batch"],
    commitments: [
      { text: "Supplier to send moisture certification", dueDate: addDays(5), status: "Open" },
      { text: "Commercial to draft updated supply schedule", dueDate: addDays(10), status: "Planned" },
    ],
    risks: ["Seasonal volume dip possible in Q4", "Single-source supplier dependency"],
    linkedDocuments: [],
    linkedDeals: ctx.deal ? [{ Id: 0, Title: ctx.deal.id }] : [],
    linkedContacts: ctx.contactName ? [{ Id: 0, Title: ctx.contactName }] : [],
  };
}

function emailDraft(ctx: KnowledgeCaptureContext): Omit<ActivityKnowledgeDraft, "assessment"> {
  const customer = companyLabel(ctx.company);
  const opportunity = dealLabel(ctx.deal);

  return {
    summary: `Email thread advanced ${opportunity} — customer requested budget proposal.`,
    whatHappened: [
      `Email exchange with ${customer} on ${opportunity}.`,
      ctx.existingDescription?.trim() || "Customer confirmed feedstock availability and requested formal budget proposal for board review.",
    ].join(" "),
    whatWasAgreed: [
      "Budget proposal to be delivered before 15 September",
      "Utility review to be scheduled after technical workshop",
    ],
    whatHappensNext: "Prepare budget proposal",
    whatHappensNextDue: addDays(10),
    decisions: ["Customer confirmed internal budget cycle for Q4 approval"],
    commitments: [
      { text: "Deliver budget proposal for board review", dueDate: addDays(10), status: "Open" },
      { text: "Arrange technical workshop", dueDate: addDays(21), status: "Planned" },
    ],
    risks: ["Board approval timing may delay contract signature", "Competing vendor still in evaluation"],
    linkedDocuments: [],
    linkedDeals: ctx.deal ? [{ Id: 0, Title: ctx.deal.id }] : [],
    linkedContacts: ctx.contactName ? [{ Id: 0, Title: ctx.contactName }] : [],
  };
}

function siteVisitDraft(ctx: KnowledgeCaptureContext): Omit<ActivityKnowledgeDraft, "assessment"> {
  const customer = companyLabel(ctx.company);
  const opportunity = dealLabel(ctx.deal);

  return {
    summary: `Site visit at ${customer} validated installation constraints.`,
    whatHappened: [
      `On-site visit at ${customer} for ${opportunity}.`,
      "Reviewed layout, utilities access, and operational constraints with plant team.",
      ctx.existingDescription?.trim() || "",
    ]
      .filter(Boolean)
      .join(" "),
    whatWasAgreed: [
      "Preferred equipment location confirmed",
      "Utility connection points identified for engineering review",
    ],
    whatHappensNext: "Complete site layout drawing for customer approval",
    whatHappensNextDue: addDays(14),
    decisions: ["Customer approved proposed equipment footprint"],
    commitments: [
      { text: "Engineering to produce layout drawing", dueDate: addDays(14), status: "Open" },
      { text: "Customer to confirm utility capacity data", dueDate: addDays(7), status: "Open" },
    ],
    risks: ["Space constraints may require design revision", "Permitting timeline not yet confirmed"],
    linkedDocuments: [],
    linkedDeals: ctx.deal ? [{ Id: 0, Title: ctx.deal.id }] : [],
    linkedContacts: ctx.contactName ? [{ Id: 0, Title: ctx.contactName }] : [],
  };
}

function genericDraft(ctx: KnowledgeCaptureContext): Omit<ActivityKnowledgeDraft, "assessment"> {
  const customer = companyLabel(ctx.company);
  const opportunity = dealLabel(ctx.deal);

  return {
    summary: ctx.existingSummary?.trim() || `${ctx.activityType} logged for ${customer}.`,
    whatHappened:
      ctx.existingDescription?.trim() ||
      `${ctx.activityType} with ${customer} regarding ${opportunity}.`,
    whatWasAgreed: [],
    whatHappensNext: "Schedule follow-up with customer",
    whatHappensNextDue: addDays(7),
    decisions: [],
    commitments: [],
    risks: [],
    linkedDocuments: [],
    linkedDeals: ctx.deal ? [{ Id: 0, Title: ctx.deal.id }] : [],
    linkedContacts: ctx.contactName ? [{ Id: 0, Title: ctx.contactName }] : [],
  };
}

/**
 * Rule-based SmartAssist knowledge capture — drafts structured knowledge
 * from interaction type and CRM context. Replace with LLM extraction when available.
 */
export function generateActivityKnowledgeDraft(
  ctx: KnowledgeCaptureContext,
): ActivityKnowledgeDraft {
  const type = ctx.activityType;
  let base: Omit<ActivityKnowledgeDraft, "assessment">;

  if (
    type === "Teams Meeting" ||
    type === "Meeting" ||
    type === "Commercial Review" ||
    type === "Technical Review"
  ) {
    base = meetingDraft(ctx);
  } else if (type === "Phone Call") {
    base = callDraft(ctx);
  } else if (type === "Email" || type === "Email Follow-Up" || type === "Proposal Sent") {
    base = emailDraft(ctx);
  } else if (type === "Site Visit") {
    base = siteVisitDraft(ctx);
  } else {
    base = genericDraft(ctx);
  }

  if (ctx.subject?.trim()) {
    base.summary = `${ctx.subject.trim()} — ${base.summary}`;
  }

  return {
    ...base,
    assessment: buildAssessment(base),
  };
}

export function draftToCreateActivityPatch(
  draft: ActivityKnowledgeDraft,
): Pick<
  Activity,
  | "Summary"
  | "ActivityDescription"
  | "KeyDecisions"
  | "AgreedActions"
  | "Risks"
  | "NextAction"
  | "NextActionDate"
  | "ActionRequired"
  | "LinkedDocuments"
  | "LinkedDeals"
  | "LinkedContacts"
  | "SmartAssistAssessment"
> {
  return {
    Summary: draft.summary,
    ActivityDescription: draft.whatHappened,
    KeyDecisions: draft.decisions,
    AgreedActions: draft.commitments,
    Risks: draft.risks,
    NextAction: draft.whatHappensNext,
    NextActionDate: draft.whatHappensNextDue ?? "",
    ActionRequired: Boolean(draft.whatHappensNext),
    LinkedDocuments: draft.linkedDocuments,
    LinkedDeals: draft.linkedDeals,
    LinkedContacts: draft.linkedContacts,
    SmartAssistAssessment: draft.assessment,
  };
}

export function buildStakeholdersFromActivity(activity: Activity): ActivityStakeholder[] {
  const stakeholders: ActivityStakeholder[] = [];
  const seen = new Set<string>();

  const add = (stakeholder: ActivityStakeholder) => {
    const key = stakeholder.name.toLowerCase();
    if (!stakeholder.name || seen.has(key)) return;
    seen.add(key);
    stakeholders.push(stakeholder);
  };

  if (activity.Contact?.Title) {
    add({
      name: activity.Contact.Title,
      role: "Primary contact",
      influence: "decision_maker",
    });
  }

  if (activity.ActivityOwner?.Title) {
    add({
      name: activity.ActivityOwner.Title,
      role: "Activity owner",
      influence: "operational",
    });
  }

  for (const contact of activity.LinkedContacts ?? []) {
    add({ name: contact.Title, role: "Stakeholder", influence: "influencer" });
  }

  for (const extra of activity.Stakeholders ?? []) {
    add(extra);
  }

  return stakeholders;
}

export function knowledgeCompletenessScore(activity: Activity): number {
  let score = 0;
  if (activity.Summary?.trim()) score += 15;
  if (activity.ActivityDescription?.trim()) score += 20;
  if (activity.KeyDecisions?.length) score += 15;
  if (activity.AgreedActions?.length) score += 15;
  if (activity.Risks?.length) score += 10;
  if (activity.ActionRequired && activity.NextAction?.trim()) score += 15;
  if (
    activity.LinkedDocuments?.length ||
    activity.LinkedDeals?.length ||
    activity.LinkedContacts?.length
  ) {
    score += 10;
  }
  return Math.min(100, score);
}
