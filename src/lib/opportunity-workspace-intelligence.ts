import type { Activity } from "@/types/activity";
import type { AttentionItem } from "@/types/attention-item";
import type { CommercialViabilityAssessment } from "@/types/commercial-viability";
import type { Company } from "@/types/company";
import { getActivitiesForDeal } from "@/lib/activity-utils";
import { findCompanyForDeal } from "@/lib/opportunity-intelligence-engine";
import { buildOfferingIntelligence } from "@/lib/offering-intelligence";
import {
  buildConfirmedFromUnderstandingModel,
  buildGapsFromUnderstandingModel,
  resolveUnderstandingField,
} from "@/lib/opportunity-understanding-model";
import type { PipelineRow } from "@/types/pipeline";
import { formatDealValue } from "@/types/pipeline";
import { UNDERSTANDING_FIELD_BY_ID, isUnderstandingFieldId } from "@/types/opportunity-understanding";

export type ConfidenceLevel = "high" | "medium" | "low";

export type ClientObjective = {
  statement: string;
  confidence: ConfidenceLevel;
  confidenceReason: string;
};

export type UnderstandingItem = {
  id: string;
  /** @deprecated Use ConfirmedUnderstandingRow */
  statement: string;
};

export type LearningGap = {
  id: string;
  label: string;
  priority: "high" | "medium" | "low";
};

export type CriticalKnowledgeGap = {
  id: string;
  /** Understanding field to answer — enables Answer Now navigation */
  fieldId?: import("@/types/opportunity-understanding").UnderstandingFieldId;
  priority: "high" | "medium" | "low";
  missingInformation: string;
  whyItMatters: string;
  recommendedAction: string;
};

export type ConfirmedUnderstandingRow = {
  id: string;
  topic: string;
  answer: string;
  fieldId?: import("@/types/opportunity-understanding").UnderstandingFieldId;
};

export type OpportunityKnowledgeModel = {
  criticalGaps: CriticalKnowledgeGap[];
  confirmedUnderstanding: ConfirmedUnderstandingRow[];
};

export type AssistantAssessment = {
  wellUnderstood: string[];
  gapsInUnderstanding: string[];
  risksToValidate: string[];
  workingAssumptions: string[];
  pathsForward: string[];
};

export type NextBestAction = {
  action: string;
  why: string;
  expectedImpact: string;
};

export type RecommendedAttention = "HIGH" | "MEDIUM" | "LOW" | "HOLD";

/** SmartAssist Phase 1.1 — opportunity understanding snapshot for every deal. */
export type OpportunityDiscoveryQuestionItem = {
  id: string;
  question: string;
  /** When set, answer saves into the Understanding Capture model. */
  fieldId?: import("@/types/opportunity-understanding").UnderstandingFieldId;
};

export type OpportunityUnderstanding = {
  clientObjective: ClientObjective;
  knowledgeModel: OpportunityKnowledgeModel;
  /** @deprecated Use knowledgeModel.criticalGaps */
  currentUnderstanding: UnderstandingItem[];
  /** @deprecated Use knowledgeModel.criticalGaps */
  stillNeedToLearn: LearningGap[];
  suggestedQuestions: string[];
  /** Stable ids for answer capture on the Questions action tab. */
  discoveryQuestionItems: OpportunityDiscoveryQuestionItem[];
  suggestedValidations: string[];
  recommendedConversations: string[];
  assessment: AssistantAssessment;
  recommendedAttention: RecommendedAttention;
  attentionReason: string;
  nextBestAction: NextBestAction;
};

/** @deprecated Use OpportunityUnderstanding */
export type OpportunityWorkspaceIntelligence = OpportunityUnderstanding & {
  stillNeedToUnderstand: LearningGap[];
};

export const SMARTASSIST_UNDERSTANDING_QUESTIONS = [
  "What is the client trying to achieve?",
  "What do we know?",
  "What don't we know?",
  "What should we ask next?",
  "What should we validate next?",
  "What should happen next?",
] as const;

const OBJECTIVE_PATTERNS: Array<{ pattern: RegExp; objective: string }> = [
  { pattern: /biochar|pyrolysis|carbon/i, objective: "Produce biochar and generate carbon credits" },
  { pattern: /waste|residue|feedstock/i, objective: "Solve a waste or feedstock challenge" },
  { pattern: /energy|heat|power/i, objective: "Reduce energy cost or recover energy" },
  { pattern: /battery|graphite|anode/i, objective: "Produce battery-grade materials" },
  { pattern: /capacity|expand|scale/i, objective: "Increase production capacity" },
  { pattern: /compliance|regulat/i, objective: "Meet regulatory or compliance requirements" },
];

function hasDecisionMakerOnDeal(pipeline: PipelineRow): boolean {
  return (pipeline.team ?? []).some((member) =>
    /decision maker/i.test(member.projectRole),
  );
}

function hasStakeholderMapOnDeal(pipeline: PipelineRow): boolean {
  return (pipeline.team ?? []).length > 0;
}

function endProductClarity(pipeline: PipelineRow): boolean {
  const corpus = [
    pipeline.assetName,
    pipeline.targetFeedstock,
    pipeline.currentMilestone,
    pipeline.companyRole,
  ]
    .join(" ")
    .toLowerCase();
  return /biochar|energy|graphite|char|heat|power|material|offtake|off-take|electricity|syngas/i.test(
    corpus,
  );
}

function inferClientObjective(
  pipeline: PipelineRow,
  company: Company | undefined,
): ClientObjective {
  const corpus = [
    pipeline.assetName,
    pipeline.targetFeedstock,
    pipeline.currentMilestone,
    pipeline.companyRole,
    company?.Industry ?? "",
  ]
    .join(" ")
    .toLowerCase();

  for (const entry of OBJECTIVE_PATTERNS) {
    if (entry.pattern.test(corpus)) {
      return {
        statement: entry.objective,
        confidence: pipeline.targetFeedstock.trim() ? "high" : "medium",
        confidenceReason: pipeline.targetFeedstock.trim()
          ? `Supported by feedstock context (${pipeline.targetFeedstock}) and project naming.`
          : "Inferred from project context — confirm intent directly with the customer.",
      };
    }
  }

  const roleObjectives: Record<string, string> = {
    "Technology Buyer": "Deploy pyrolysis technology to create commercial value",
    "Feedstock Supplier": "Monetize feedstock through a processing partnership",
    "Off-take Partner": "Secure reliable offtake for end products",
    "Infrastructure Partner": "Develop energy or infrastructure capacity",
  };

  return {
    statement: roleObjectives[pipeline.companyRole] ?? "Achieve a commercially viable processing outcome",
    confidence: "low",
    confidenceReason: "Limited explicit objective signals — discovery needed to confirm customer intent.",
  };
}

function findDecisionMakerOnDeal(
  pipeline: PipelineRow,
  company: Company | undefined,
): { name: string; role: string } | null {
  const member = (pipeline.team ?? []).find((entry) =>
    /decision maker/i.test(entry.projectRole),
  );
  if (!member) return null;
  const contact = company?.contacts.find((entry) => entry.ContactID === member.contactId);
  const name = contact
    ? contact.Title || `${contact.FirstName} ${contact.LastName}`.trim()
    : member.contactId;
  return { name, role: member.projectRole };
}

function describeAssignedStakeholders(
  pipeline: PipelineRow,
  company: Company | undefined,
): string | null {
  const team = pipeline.team ?? [];
  if (team.length === 0) return null;

  const labels = team.slice(0, 4).map((member) => {
    const contact = company?.contacts.find((entry) => entry.ContactID === member.contactId);
    const name = contact
      ? contact.Title || `${contact.FirstName} ${contact.LastName}`.trim()
      : member.contactId;
    return member.projectRole ? `${name} (${member.projectRole})` : name;
  });

  if (team.length === 1) {
    return `${labels[0]} is recorded on this opportunity.`;
  }

  return `Stakeholders recorded: ${labels.join(", ")}${team.length > 4 ? ", …" : ""}.`;
}

function inferEndProductInsight(pipeline: PipelineRow): string | null {
  const corpus = [
    pipeline.assetName,
    pipeline.targetFeedstock,
    pipeline.currentMilestone,
    pipeline.companyRole,
  ]
    .join(" ")
    .toLowerCase();

  if (/biochar|carbon credit/i.test(corpus)) {
    return "Biochar and carbon credit production appears to be the customer's stated product direction.";
  }
  if (/thermal recovery|recovery reactor/i.test(corpus)) {
    return "Thermal recovery of mixed plastics appears to be the intended product path based on project discussions.";
  }
  if (/energy|heat|power|syngas/i.test(corpus)) {
    return "Energy or heat recovery appears to be the primary value outcome the customer is pursuing.";
  }
  if (/graphite|battery|anode/i.test(corpus)) {
    return "Battery-grade material production appears to be the intended end product path.";
  }
  if (endProductClarity(pipeline)) {
    return "A high-level end product direction has been discussed with the customer, though specifics may still need validation.";
  }
  return null;
}

function describeFeedstockInsight(feedstock: string): string {
  const trimmed = feedstock.trim();
  if (/mixed plastic/i.test(trimmed)) {
    return "Mixed plastics have been identified as the customer's primary feedstock.";
  }
  return `${trimmed} has been identified as the customer's primary feedstock.`;
}

function describeCommercialRoleInsight(role: string): string {
  const insights: Record<string, string> = {
    "Technology Buyer":
      "The customer is engaging as a technology buyer — they are procuring the solution rather than supplying feedstock or securing offtake.",
    "Feedstock Supplier":
      "The customer is positioned as a feedstock supplier, so the commercial path depends on feedstock availability and partnership terms.",
    "Off-take Partner":
      "The customer is engaging as an offtake partner — success hinges on credible end-product volume and quality commitments.",
    "Infrastructure Partner":
      "The customer is pursuing an infrastructure partnership, tying project success to site, energy, or utility integration.",
  };
  return (
    insights[role] ??
    `Commercial engagement appears oriented around the customer's role as ${role.toLowerCase()} in the value chain.`
  );
}

function describeEngagementInsight(context: string): string {
  const trimmed = context.trim();
  if (!trimmed) return "";
  if (/[.!?]$/.test(trimmed) && trimmed.length > 60) {
    return `Recent dialogue indicates: ${trimmed}`;
  }
  return `The most recent customer conversation focused on ${trimmed.charAt(0).toLowerCase()}${trimmed.slice(1)}.`;
}

function buildCriticalKnowledgeGaps(
  pipeline: PipelineRow,
  _company: Company | undefined,
  assessment: CommercialViabilityAssessment,
  dealActivities: Activity[],
): CriticalKnowledgeGap[] {
  // Primary source: Understanding Model — gaps = unanswered fields
  const modelGaps: CriticalKnowledgeGap[] = buildGapsFromUnderstandingModel(pipeline).map(
    (gap) => ({ ...gap }),
  );

  const offeringIntel = buildOfferingIntelligence(pipeline.offeringIds, pipeline.team);
  const extras: CriticalKnowledgeGap[] = [];

  if (offeringIntel.offeringsUnknown) {
    extras.push({
      id: "offerings",
      priority: "high",
      missingInformation: "Standard Bio offerings not selected",
      whyItMatters:
        "Without knowing what we are selling — systems, products, or services — qualification and recommendations stay generic.",
      recommendedAction:
        "Select the Standard Bio offerings in scope so SmartAssist can qualify and guide next steps",
    });
  }

  if (
    dealActivities.length === 0 &&
    !pipeline.understanding?.discoveryNotes?.engagement?.trim()
  ) {
    extras.push({
      id: "engagement",
      priority: "high",
      missingInformation: "No customer dialogue logged",
      whyItMatters: "Understanding cannot advance without direct conversations with the customer.",
      recommendedAction: "Schedule an introductory discovery conversation",
    });
  }

  if (
    assessment.fatalFlawAlerts.some((alert) => /permit/i.test(alert.label)) &&
    resolveUnderstandingField(pipeline, "permitting").source === "empty"
  ) {
    // Permitting already in model gaps when empty — no duplicate
  }

  const seen = new Set(modelGaps.map((gap) => gap.id));
  for (const extra of extras) {
    if (!seen.has(extra.id)) {
      modelGaps.push(extra);
      seen.add(extra.id);
    }
  }

  const priorityRank = { high: 0, medium: 1, low: 2 };
  return modelGaps
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
    .slice(0, 10);
}

function buildConfirmedUnderstanding(
  pipeline: PipelineRow,
  company: Company | undefined,
  dealActivities: Activity[],
): ConfirmedUnderstandingRow[] {
  const fromModel: ConfirmedUnderstandingRow[] = buildConfirmedFromUnderstandingModel(
    pipeline,
  ).map((row) => ({
    id: row.id,
    topic: row.topic,
    answer: row.answer,
    fieldId: row.fieldId,
  }));

  const rows = [...fromModel];

  const offeringIntel = buildOfferingIntelligence(pipeline.offeringIds, pipeline.team);
  if (!offeringIntel.offeringsUnknown) {
    rows.unshift({
      id: "offerings",
      topic: "What we are selling",
      answer: offeringIntel.commercialIntent,
    });
  }

  if (pipeline.companyRole) {
    rows.push({
      id: "role",
      topic: "Commercial Intent",
      answer: describeCommercialRoleInsight(pipeline.companyRole),
    });
  }

  if (dealActivities.length > 0) {
    const latest = [...dealActivities].sort(
      (a, b) =>
        new Date(b.ActivityDate).getTime() - new Date(a.ActivityDate).getTime(),
    )[0];
    const latestContext = latest?.Summary?.trim() || latest?.Subject?.trim();
    if (latestContext) {
      rows.push({
        id: "engagement",
        topic: "Recent Dialogue",
        answer: describeEngagementInsight(latestContext),
      });
    }
  } else {
    const engagementNote = pipeline.understanding?.discoveryNotes?.engagement?.trim();
    if (engagementNote) {
      rows.push({
        id: "engagement",
        topic: "Recent Dialogue",
        answer: engagementNote,
      });
    }
  }

  for (const [id, answer] of Object.entries(
    pipeline.understanding?.discoveryNotes ?? {},
  )) {
    const trimmed = answer.trim();
    if (!trimmed || id === "engagement") continue;
    if (rows.some((row) => row.id === id)) continue;
    rows.push({
      id,
      topic: id.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      answer: trimmed,
    });
  }

  // Keep company unused warning quiet for signature compatibility
  void company;

  return rows.slice(0, 12);
}

function toLegacyLearningGaps(gaps: CriticalKnowledgeGap[]): LearningGap[] {
  return gaps.map((gap) => ({
    id: gap.id,
    label: gap.missingInformation,
    priority: gap.priority,
  }));
}

function toLegacyUnderstandingItems(rows: ConfirmedUnderstandingRow[]): UnderstandingItem[] {
  return rows.map((row) => ({
    id: row.id,
    statement: `${row.topic}: ${row.answer}`,
  }));
}

function buildDiscoveryQuestionItems(
  gaps: LearningGap[],
  pipeline: PipelineRow,
): OpportunityDiscoveryQuestionItem[] {
  const offeringIntel = buildOfferingIntelligence(pipeline.offeringIds, pipeline.team);
  const questionMap: Record<
    string,
    { question: string; fieldId?: OpportunityDiscoveryQuestionItem["fieldId"] }
  > = {
    decision_maker: {
      question: "Who owns the go / no-go decision?",
      fieldId: "decision_maker",
    },
    economic_buyer: {
      question: "Who holds budget authority for this project?",
      fieldId: "economic_buyer",
    },
    offtake_strategy: {
      question: "How will the end product be used or sold?",
      fieldId: "offtake_strategy",
    },
    feedstock_volume: {
      question: "What annual feedstock volume is realistically available?",
      fieldId: "feedstock_volume",
    },
    feedstock_quality: {
      question: "What quality and contamination limits apply to feedstock?",
      fieldId: "feedstock_quality",
    },
    utilities: {
      question: "What utility capacity is available at the proposed site?",
      fieldId: "utilities",
    },
    timeline: {
      question: "When must a decision or start-up happen?",
      fieldId: "timeline",
    },
    budget: {
      question: "What budget range has been allocated?",
      fieldId: "budget",
    },
    end_product: {
      question: "What end product is targeted — biochar, energy, or materials?",
      fieldId: "end_product",
    },
    permitting: {
      question: "Has permitting or environmental assessment been initiated?",
      fieldId: "permitting",
    },
    stakeholder_map: {
      question: "Who are the key technical, commercial, and executive sponsors?",
      fieldId: "stakeholder_map",
    },
    business_case_strength: {
      question: "Why will the customer invest in this project?",
      fieldId: "business_case_strength",
    },
    funding_source: {
      question: "How will the project be funded?",
      fieldId: "funding_source",
    },
    capacity: {
      question: "What capacity is required?",
      fieldId: "capacity",
    },
    technical_fit: {
      question: "Does Standard Bio technology fit this application?",
      fieldId: "technical_fit",
    },
    site_readiness: {
      question: "Is the site ready for installation?",
      fieldId: "site_readiness",
    },
    engagement: {
      question:
        "Who should we speak with first to advance discovery on this opportunity?",
    },
    offerings: {
      question:
        "Which Standard Bio systems, products, or services are in scope for this opportunity?",
    },
  };

  const items: OpportunityDiscoveryQuestionItem[] = [];
  const seen = new Set<string>();

  for (const gap of gaps) {
    const mapped = questionMap[gap.id];
    if (!mapped || seen.has(gap.id)) continue;
    items.push({ id: gap.id, question: mapped.question, fieldId: mapped.fieldId });
    seen.add(gap.id);
  }

  if (offeringIntel.offeringsUnknown && !seen.has("offerings")) {
    items.push({
      id: "offerings",
      question: questionMap.offerings!.question,
    });
    seen.add("offerings");
  } else {
    for (const question of offeringIntel.discoveryQuestions.slice(0, 3)) {
      const id = `offering-${question.slice(0, 24)}`;
      if (seen.has(id)) continue;
      items.push({ id, question });
      seen.add(id);
    }
  }

  const defaults: OpportunityDiscoveryQuestionItem[] = offeringIntel.offeringsUnknown
    ? [
        {
          id: "end_product",
          question: questionMap.end_product!.question,
          fieldId: "end_product",
        },
        {
          id: "budget",
          question: questionMap.budget!.question,
          fieldId: "budget",
        },
      ]
    : [
        {
          id: "end_product",
          question: questionMap.end_product!.question,
          fieldId: "end_product",
        },
        {
          id: "budget",
          question: questionMap.budget!.question,
          fieldId: "budget",
        },
        {
          id: "business_case_strength",
          question: "What would success look like in 12 months?",
          fieldId: "business_case_strength",
        },
        {
          id: "permitting",
          question: "What regulatory constraints apply to the proposed feedstock?",
          fieldId: "permitting",
        },
      ];

  for (const item of defaults) {
    if (seen.has(item.id)) continue;
    items.push(item);
    seen.add(item.id);
  }

  return items.slice(0, 8);
}

function buildSuggestedValidations(
  gaps: LearningGap[],
  pipeline: PipelineRow,
  company: Company | undefined,
): string[] {
  const validationMap: Record<string, string> = {
    offtake_strategy:
      "Validate offtake commitments and end product economics with the customer",
    utilities: "Confirm site utility capacity and grid connection assumptions on site",
    budget: "Verify budget owner, funding source, and approval thresholds",
    decision_maker: "Confirm decision maker identity and internal approval process",
    economic_buyer: "Confirm budget authority and signing path with executive sponsor",
    permitting: "Confirm permitting status and environmental constraints for the site",
    stakeholder_map:
      "Validate stakeholder roles and influence across technical and commercial teams",
    feedstock_volume: "Confirm feedstock volume and long-term availability",
    feedstock_quality: "Confirm feedstock quality specs and contamination limits",
    timeline: "Confirm decision date and critical path milestones",
    end_product: "Confirm primary end product with the customer",
    capacity: "Confirm target throughput with technical stakeholders",
    technical_fit: "Validate technical fit assessment and open risks",
    business_case_strength: "Validate the customer’s investment rationale",
    funding_source: "Confirm funding source and financing constraints",
    site_readiness: "Confirm site readiness and civil works critical path",
    engagement: "Log the first structured customer conversation on this opportunity",
  };

  const fromGaps = gaps.map((gap) => validationMap[gap.id]).filter(Boolean) as string[];

  const defaults = [
    `Validate inferred client objective against ${company?.Title ?? "customer"} leadership`,
    "Confirm project priority relative to other capital initiatives",
    "Verify assumptions from prior meetings against current customer statements",
  ];

  if (pipeline.targetFeedstock.trim()) {
    defaults.unshift(`Validate ${pipeline.targetFeedstock} feedstock assumptions with technical contact`);
  }

  return [...new Set([...fromGaps, ...defaults])].slice(0, 5);
}

function buildRecommendedConversations(
  gaps: LearningGap[],
  company: Company | undefined,
  dealActivities: Activity[],
  pipeline: PipelineRow,
): string[] {
  const conversationMap: Record<string, string> = {
    offtaker: "Commercial conversation on offtake path and product economics",
    utilities: "Technical conversation on site utilities and capacity planning",
    budget: "Executive conversation on budget ownership and funding",
    "budget-validation": "Executive conversation to validate investment level",
    "decision-maker": "Discovery conversation with the economic buyer",
    "economic-buyer": "Executive alignment on budget authority and approval path",
    permitting: "Regulatory conversation on permitting and environmental pathway",
    stakeholders: "Stakeholder mapping conversation across technical and commercial sponsors",
    feedstock: "Technical conversation on feedstock volume, quality, and logistics",
    engagement: "Introductory discovery call to establish customer goals",
  };

  const fromGaps = gaps
    .filter((gap) => gap.priority === "high")
    .map((gap) => conversationMap[gap.id])
    .filter(Boolean) as string[];

  const conversations: string[] = [...fromGaps];

  if (dealActivities.length === 0) {
    conversations.unshift("Introductory discovery call to establish customer goals");
  } else if (!hasDecisionMakerOnDeal(pipeline)) {
    conversations.push("Executive alignment conversation to access the decision maker");
  }

  if (company?.Title) {
    conversations.push(`Account review with ${company.Title} on open understanding gaps`);
  }

  return [...new Set(conversations)].slice(0, 4);
}

function buildAssessment(
  pipeline: PipelineRow,
  company: Company | undefined,
  assessment: CommercialViabilityAssessment,
  dealActivities: Activity[],
): AssistantAssessment {
  const wellUnderstood: string[] = [];
  const gapsInUnderstanding: string[] = [];

  if (pipeline.targetFeedstock.trim()) {
    wellUnderstood.push(`Feedstock context: ${pipeline.targetFeedstock}`);
  } else {
    gapsInUnderstanding.push("Feedstock volume and quality not yet confirmed");
  }

  if (dealActivities.length >= 2) {
    wellUnderstood.push(`Customer dialogue is active (${dealActivities.length} interactions logged)`);
  } else if (dealActivities.length === 0) {
    gapsInUnderstanding.push("No customer interactions logged yet");
  }

  const offeringIntel = buildOfferingIntelligence(pipeline.offeringIds, pipeline.team);

  if (offeringIntel.offeringsUnknown) {
    gapsInUnderstanding.push("Standard Bio offerings: Unknown");
  } else {
    wellUnderstood.push(offeringIntel.commercialIntent);
  }

  if (hasDecisionMakerOnDeal(pipeline)) {
    const decisionMaker = findDecisionMakerOnDeal(pipeline, company);
    wellUnderstood.push(
      decisionMaker
        ? `Decision Maker recorded as ${decisionMaker.name}`
        : "Decision Maker recorded on this opportunity",
    );
  } else {
    gapsInUnderstanding.push("Decision Maker: Unknown");
  }

  if (assessment.fatalFlawAlerts.length === 0) {
    wellUnderstood.push("No critical commercial blockers flagged in current knowledge");
  }

  for (const risk of assessment.risks.slice(0, 2)) {
    if (/unclear|unknown|not confirmed|missing/i.test(risk.label)) {
      gapsInUnderstanding.push(risk.label);
    }
  }

  const unique = (items: string[]) => [...new Set(items)];

  return {
    wellUnderstood: unique(wellUnderstood).slice(0, 4),
    gapsInUnderstanding: unique(gapsInUnderstanding).slice(0, 4),
    risksToValidate: [
      ...assessment.fatalFlawAlerts.map((alert) => alert.label),
      ...assessment.risks.slice(0, 3).map((risk) => risk.label),
    ].slice(0, 5),
    workingAssumptions: [
      assessment.coreQuestions.shouldInvestResources,
      endProductClarity(pipeline)
        ? "End product direction is directionally understood from project context"
        : "End product path is still assumed — needs customer confirmation",
      ...offeringIntel.qualificationSignals.slice(0, 2).map(
        (signal) => `Qualification signal to confirm: ${signal}`,
      ),
    ].filter(Boolean),
    pathsForward: [
      assessment.revenuePath?.recommendedNextLabel
        ? `Commercial path: ${assessment.revenuePath.recommendedNextLabel}`
        : "",
      offeringIntel.nextBestActionHints[0] ?? "",
      company ? `Deepen understanding with ${company.Title} stakeholders` : "",
      dealActivities.length === 0 ? "Start with a structured discovery conversation" : "",
    ].filter(Boolean).slice(0, 3),
  };
}

function buildNextBestAction(
  gaps: LearningGap[],
  pipeline: PipelineRow,
  dealActivities: Activity[],
  recommendedConversations: string[],
): NextBestAction {
  const offeringIntel = buildOfferingIntelligence(pipeline.offeringIds, pipeline.team);

  if (offeringIntel.offeringsUnknown) {
    return {
      action: "Select the Standard Bio offerings in scope",
      why: "SmartAssist cannot qualify or recommend next steps until it knows what we are selling.",
      expectedImpact: "Turns a generic opportunity into a commercial path with clear requirements.",
    };
  }

  const validationMap: Record<string, { action: string; why: string }> = {
    offtake_strategy: {
      action: "Clarify end product path and offtake commitments",
      why: "Without offtake clarity, the business case and project economics remain unproven.",
    },
    utilities: {
      action: "Validate utility capacity at the proposed site",
      why: "Site constraints can invalidate capacity assumptions and feasibility.",
    },
    budget: {
      action: "Confirm budget range, funding source, and approval thresholds",
      why: "Unvalidated budget means deal size and investment appetite are still assumptions.",
    },
    decision_maker: {
      action: "Record who owns the decision and how approval flows",
      why: "Without a decision maker, proposals stall and alignment cannot be tested.",
    },
    economic_buyer: {
      action: "Confirm who holds budget authority and signs off on CAPEX",
      why: "Commercial proposals need a budget owner — otherwise investment authority stays unclear.",
    },
    permitting: {
      action: "Review permitting status and environmental constraints",
      why: "Permitting delays are a common source of project failure and timeline slip.",
    },
    stakeholder_map: {
      action: offeringIntel.missingStakeholderRoles[0]
        ? `Add ${offeringIntel.missingStakeholderRoles[0]} for ${offeringIntel.labels[0] ?? "selected offerings"}`
        : "Map technical, commercial, and executive sponsors",
      why: "Hidden influencers can block progress even when technical fit looks strong.",
    },
    feedstock_volume: {
      action: "Confirm annual volume with the customer or supplier",
      why: "Technical and commercial design depend on realistic feedstock availability.",
    },
    feedstock_quality: {
      action: "Confirm quality specs and variance with technical stakeholders",
      why: "Quality variance can invalidate process design and offtake specs.",
    },
    engagement: {
      action: "Schedule an introductory discovery conversation",
      why: "Understanding cannot advance without direct conversations with the customer.",
    },
    offerings: {
      action: "Select the Standard Bio offerings in scope",
      why: "Without knowing what we are selling, qualification and recommendations stay generic.",
    },
  };

  const topGap = gaps.find((gap) => gap.priority === "high") ?? gaps[0];
  if (topGap) {
    const mapped = validationMap[topGap.id];
    const field = isUnderstandingFieldId(topGap.id)
      ? UNDERSTANDING_FIELD_BY_ID[topGap.id]
      : undefined;
    const offeringHint = offeringIntel.nextBestActionHints[0];
    return {
      action:
        mapped?.action ??
        field?.recommendedAction ??
        `Close the gap on ${topGap.label.toLowerCase()}`,
      why:
        mapped?.why ??
        field?.whyItMatters ??
        `${topGap.label} is the highest-priority unknown — understanding this unlocks better decisions.`,
      expectedImpact: offeringHint
        ? offeringHint
        : "Reduces uncertainty so you can invest time and resources with confidence.",
    };
  }

  if (offeringIntel.nextBestActionHints[0]) {
    return {
      action: offeringIntel.nextBestActionHints[0],
      why: `Guided by selected offerings: ${offeringIntel.labels.join(", ")}.`,
      expectedImpact: "Advances the commercial path for what Standard Bio is selling.",
    };
  }

  if (dealActivities.length === 0) {
    return {
      action: "Schedule a discovery conversation with the economic buyer",
      why: "No customer interactions are logged yet — understanding must start with direct dialogue.",
      expectedImpact: "Creates the foundation for every business development decision on this opportunity.",
    };
  }

  const nextConversation = recommendedConversations[0];
  if (nextConversation) {
    return {
      action: nextConversation,
      why: "Major gaps are addressed — the next conversation should advance commercial understanding.",
      expectedImpact: "Maintains momentum while deepening opportunity clarity.",
    };
  }

  return {
    action: "Prepare for the next customer conversation with updated discovery questions",
    why: `Understanding is solid on ${pipeline.assetName ?? pipeline.id} — stay engaged.`,
    expectedImpact: "Keeps the relationship warm while you decide on next investment.",
  };
}

function resolveAttention(
  gaps: LearningGap[],
  assessment: CommercialViabilityAssessment,
  attentionItems: AttentionItem[],
  dealActivities: Activity[],
): { level: RecommendedAttention; reason: string } {
  const highPriorityGaps = gaps.filter((gap) => gap.priority === "high").length;

  if (
    assessment.fatalFlawAlerts.length > 0 ||
    attentionItems.some((item) => item.severity === "urgent")
  ) {
    return {
      level: "HIGH",
      reason: "Critical unknowns or risks need validation before advancing.",
    };
  }

  if (highPriorityGaps >= 2 || (highPriorityGaps >= 1 && dealActivities.length === 0)) {
    return {
      level: "HIGH",
      reason: "Major learning gaps remain — prioritize structured customer conversations.",
    };
  }

  if (assessment.recommendation === "deprioritize" || assessment.recommendation === "walk_away") {
    return {
      level: "HOLD",
      reason: "Fundamentals are weak — hold effort until customer signals improve.",
    };
  }

  if (gaps.length >= 2) {
    return {
      level: "MEDIUM",
      reason: "Promising thread with open questions — maintain momentum through discovery.",
    };
  }

  if (gaps.length === 0 && dealActivities.length >= 2) {
    return {
      level: "MEDIUM",
      reason: "Understanding is solid — stay engaged and advance the commercial conversation.",
    };
  }

  if (gaps.length <= 1) {
    return {
      level: "LOW",
      reason: "Foundation is in place — invest proportionally without over-rotating on this deal.",
    };
  }

  return {
    level: "MEDIUM",
    reason: "Standard attention — focus on the next validation or discovery conversation.",
  };
}

export function buildOpportunityUnderstanding(
  pipeline: PipelineRow,
  companies: Company[],
  assessment: CommercialViabilityAssessment,
  activities: Activity[],
  attentionItems: AttentionItem[],
): OpportunityUnderstanding {
  const company = findCompanyForDeal(pipeline.id, companies);
  const dealActivities = getActivitiesForDeal(activities, pipeline.id);
  const clientObjective = inferClientObjective(pipeline, company);
  const criticalGaps = buildCriticalKnowledgeGaps(
    pipeline,
    company,
    assessment,
    dealActivities,
  );
  const confirmedUnderstanding = buildConfirmedUnderstanding(
    pipeline,
    company,
    dealActivities,
  );
  const knowledgeModel: OpportunityKnowledgeModel = {
    criticalGaps,
    confirmedUnderstanding,
  };
  const stillNeedToLearn = toLegacyLearningGaps(criticalGaps);
  const currentUnderstanding = toLegacyUnderstandingItems(confirmedUnderstanding);
  const discoveryQuestionItems = buildDiscoveryQuestionItems(
    stillNeedToLearn,
    pipeline,
  );
  const suggestedQuestions = discoveryQuestionItems.map((item) => item.question);
  const suggestedValidations = buildSuggestedValidations(stillNeedToLearn, pipeline, company);
  const recommendedConversations = buildRecommendedConversations(
    stillNeedToLearn,
    company,
    dealActivities,
    pipeline,
  );
  const assistantAssessment = buildAssessment(pipeline, company, assessment, dealActivities);
  const nextBestAction = buildNextBestAction(
    stillNeedToLearn,
    pipeline,
    dealActivities,
    recommendedConversations,
  );
  const { level, reason } = resolveAttention(
    stillNeedToLearn,
    assessment,
    attentionItems,
    dealActivities,
  );

  return {
    clientObjective,
    knowledgeModel,
    currentUnderstanding,
    stillNeedToLearn,
    suggestedQuestions,
    discoveryQuestionItems,
    suggestedValidations,
    recommendedConversations,
    assessment: assistantAssessment,
    recommendedAttention: level,
    attentionReason: reason,
    nextBestAction,
  };
}

/** Backward-compatible alias used by the opportunity workspace. */
export function buildOpportunityWorkspaceIntelligence(
  pipeline: PipelineRow,
  companies: Company[],
  assessment: CommercialViabilityAssessment,
  _qualification: unknown,
  activities: Activity[],
  attentionItems: AttentionItem[],
): OpportunityWorkspaceIntelligence {
  const understanding = buildOpportunityUnderstanding(
    pipeline,
    companies,
    assessment,
    activities,
    attentionItems,
  );
  return {
    ...understanding,
    stillNeedToUnderstand: understanding.stillNeedToLearn,
  };
}

export function regenerateDiscoveryQuestions(
  intelligence: OpportunityUnderstanding,
  pipeline: PipelineRow,
): string[] {
  const extra = [
    `What regulatory constraints apply to ${pipeline.targetFeedstock || "the proposed feedstock"}?`,
    "Who must approve CAPEX before engineering can proceed?",
    "Is there an existing EPC or technology partner in the mix?",
    "What prior studies or pilots have been completed?",
    "How does this project rank against other capital priorities?",
    "What would cause the customer to pause or accelerate this initiative?",
  ];
  return [...new Set([...intelligence.suggestedQuestions, ...extra])].slice(0, 8);
}

export function regenerateValidations(
  intelligence: OpportunityUnderstanding,
  pipeline: PipelineRow,
): string[] {
  const extra = [
    "Validate success criteria the customer would use at 12 months",
    "Confirm whether internal champions exist outside the current contact set",
    `Cross-check project naming (${pipeline.assetName ?? pipeline.id}) against stated customer goals`,
    "Validate competitive alternatives the customer is considering",
  ];
  return [...new Set([...intelligence.suggestedValidations, ...extra])].slice(0, 6);
}
