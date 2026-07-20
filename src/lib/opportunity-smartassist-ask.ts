import type { SmartAssistQueryResponse, SmartAssistInsight } from "@/types/smartassist-intelligence";
import type { Activity } from "@/types/activity";
import type { AttentionItem } from "@/types/attention-item";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { formatDealValue } from "@/types/pipeline";
import { getActivitiesForDeal } from "@/lib/activity-utils";
import { findCompanyForDeal } from "@/lib/opportunity-intelligence-engine";
import type { OpportunityUnderstanding } from "@/lib/opportunity-workspace-intelligence";
import type { SmartDocsIntelligenceItem } from "@/lib/smartdocs-intelligence-data";
import {
  buildUnknownResponse,
  buildOpportunityInsightCatalog,
  confidenceToCategory,
  gapToCategory,
  lowestConfidence,
  primaryCategoryFromInsights,
} from "@/lib/smartassist-intelligence-layer";
import { buildOfferingIntelligence } from "@/lib/offering-intelligence";
import {
  type SmartAssistUnderstandingQuestion,
} from "@/lib/opportunity-smartassist-navigation";
import { SMARTASSIST_UNDERSTANDING_QUESTIONS } from "@/lib/opportunity-workspace-intelligence";

export type OpportunityAskContext = {
  pipeline: PipelineRow;
  companies: Company[];
  understanding: OpportunityUnderstanding;
  activities: Activity[];
  attentionItems: AttentionItem[];
  dealDocuments: SmartDocsIntelligenceItem[];
};

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\?+$/, "").replace(/'/g, "'");
}

function matchesAny(text: string, patterns: string[]): boolean {
  return patterns.some((pattern) => text.includes(pattern));
}

function matchUnderstandingQuestion(
  query: string,
): SmartAssistUnderstandingQuestion | null {
  const q = normalize(query);
  for (const question of SMARTASSIST_UNDERSTANDING_QUESTIONS) {
    const normalizedQuestion = normalize(question);
    if (q === normalizedQuestion || q.includes(normalizedQuestion.replace("?", ""))) {
      return question;
    }
  }
  if (matchesAny(q, ["client trying to achieve", "client objective", "trying to achieve"])) {
    return "What is the client trying to achieve?";
  }
  if (matchesAny(q, ["what do we know", "what we know", "confirmed understanding"])) {
    return "What do we know?";
  }
  if (matchesAny(q, ["what don't we know", "what dont we know", "knowledge gaps", "critical gaps"])) {
    return "What don't we know?";
  }
  if (matchesAny(q, ["ask next", "discovery questions", "what should i ask"])) {
    return "What should we ask next?";
  }
  if (matchesAny(q, ["validate next", "what to validate", "should we validate"])) {
    return "What should we validate next?";
  }
  if (matchesAny(q, ["happen next", "next step", "next best action", "what should happen"])) {
    return "What should happen next?";
  }
  return null;
}

function buildContextSources(ctx: OpportunityAskContext): string[] {
  const company = findCompanyForDeal(ctx.pipeline.id, ctx.companies);
  const dealActivities = getActivitiesForDeal(ctx.activities, ctx.pipeline.id);
  const sources = [
    `Opportunity: ${ctx.pipeline.assetName} (${ctx.pipeline.id})`,
    company ? `Account: ${company.Title}` : "Account context",
    `${dealActivities.length} activit${dealActivities.length === 1 ? "y" : "ies"}`,
    `${ctx.understanding.knowledgeModel.criticalGaps.length} critical gap${ctx.understanding.knowledgeModel.criticalGaps.length === 1 ? "" : "s"}`,
    `${ctx.understanding.knowledgeModel.confirmedUnderstanding.length} confirmed insight${ctx.understanding.knowledgeModel.confirmedUnderstanding.length === 1 ? "" : "s"}`,
  ];
  if (company && company.contacts.length > 0) {
    sources.push(`${company.contacts.length} contact${company.contacts.length === 1 ? "" : "s"}`);
  }
  if (ctx.dealDocuments.length > 0) {
    sources.push(`${ctx.dealDocuments.length} linked document${ctx.dealDocuments.length === 1 ? "" : "s"}`);
  }
  if (ctx.attentionItems.length > 0) {
    sources.push(`${ctx.attentionItems.length} attention signal${ctx.attentionItems.length === 1 ? "" : "s"}`);
  }
  return sources;
}

function buildQueryResponse(
  headline: string,
  insights: SmartAssistInsight[],
  ctx: OpportunityAskContext,
  options?: {
    unknown?: SmartAssistQueryResponse["unknown"];
    suggestedQuestions?: string[];
  },
): SmartAssistQueryResponse {
  return {
    headline,
    primaryCategory: primaryCategoryFromInsights(insights),
    confidence: lowestConfidence(insights),
    insights,
    unknown: options?.unknown,
    sources: buildContextSources(ctx),
    suggestedQuestions: options?.suggestedQuestions ?? ctx.understanding.suggestedQuestions.slice(0, 3),
  };
}

function answerFromUnderstandingQuestion(
  question: SmartAssistUnderstandingQuestion,
  ctx: OpportunityAskContext,
): SmartAssistQueryResponse {
  const { understanding } = ctx;
  const catalog = buildOpportunityInsightCatalog(understanding);

  switch (question) {
    case "What is the client trying to achieve?": {
      const objective = catalog.all.find((item) => item.id === "client-objective")!;
      const category = confidenceToCategory(understanding.clientObjective.confidence);
      const headline =
        category === "known"
          ? understanding.clientObjective.statement
          : `Working view (assumed): ${understanding.clientObjective.statement}`;

      return buildQueryResponse(headline, [objective], ctx, {
        suggestedQuestions: understanding.suggestedQuestions.slice(0, 3),
      });
    }
    case "What do we know?": {
      if (catalog.known.length === 0 && catalog.assumed.length === 0) {
        return buildQueryResponse(
          "No confirmed insights yet.",
          [],
          ctx,
          {
            unknown: buildUnknownResponse(
              "Discovery conversations and logged activities have not yet produced confirmed understanding.",
              ["Customer objectives", "Technical scope", "Stakeholder map"],
              understanding.suggestedQuestions.slice(0, 3),
            ),
            suggestedQuestions: understanding.suggestedQuestions.slice(0, 4),
          },
        );
      }
      return buildQueryResponse(
        `${catalog.known.length} known and ${catalog.assumed.length} assumed insight${catalog.assumed.length === 1 ? "" : "s"} from opportunity data.`,
        [...catalog.known, ...catalog.assumed].slice(0, 6),
        ctx,
      );
    }
    case "What don't we know?": {
      const gapInsights = understanding.knowledgeModel.criticalGaps.map((gap) => ({
        id: `gap-${gap.id}`,
        topic: gap.missingInformation,
        statement: gap.whyItMatters,
        category: gapToCategory(gap),
        confidence: gap.priority === "high" ? ("low" as const) : ("medium" as const),
        confidenceReason: gap.recommendedAction,
      }));
      if (gapInsights.length === 0) {
        return buildQueryResponse(
          "No critical knowledge gaps are flagged — validate assumptions before advancing commercially.",
          catalog.assumed.slice(0, 3),
          ctx,
        );
      }
      return buildQueryResponse(
        `${gapInsights.length} gap${gapInsights.length === 1 ? "" : "s"} ranked by commercial risk.`,
        gapInsights.slice(0, 5),
        ctx,
        { suggestedQuestions: understanding.suggestedQuestions.slice(0, 3) },
      );
    }
    case "What should we ask next?": {
      if (understanding.suggestedQuestions.length === 0) {
        return buildQueryResponse(
          "Discovery questions depend on open knowledge gaps.",
          catalog.missingCritical.slice(0, 3),
          ctx,
          {
            unknown: buildUnknownResponse(
              "No specific questions are ready until critical gaps are identified.",
              understanding.knowledgeModel.criticalGaps.map((gap) => gap.missingInformation).slice(0, 3),
              ["What is the customer's primary objective?", "Who holds decision authority?"],
            ),
          },
        );
      }
      return buildQueryResponse(
        "Questions derived from missing information and validation needs.",
        catalog.missingCritical.slice(0, 2),
        ctx,
        { suggestedQuestions: understanding.suggestedQuestions.slice(0, 4) },
      );
    }
    case "What should we validate next?": {
      if (understanding.suggestedValidations.length === 0) {
        return buildQueryResponse(
          "Validations should follow once critical gaps are identified.",
          catalog.missingCritical.slice(0, 2),
          ctx,
        );
      }
      const validationInsights: SmartAssistInsight[] = understanding.suggestedValidations
        .slice(0, 4)
        .map((validation, index) => ({
          id: `validation-${index}`,
          topic: "Validation",
          statement: validation,
          category: "missing_critical" as const,
          confidence: "medium" as const,
          confidenceReason: "Required to reduce commercial and delivery risk.",
        }));
      return buildQueryResponse(
        "Validations prioritized to reduce commercial and delivery risk.",
        validationInsights,
        ctx,
      );
    }
    case "What should happen next?": {
      const nba = understanding.nextBestAction;
      const insights: SmartAssistInsight[] = [
        {
          id: "attention",
          topic: "Attention",
          statement: `${understanding.recommendedAttention} — ${understanding.attentionReason}`,
          category:
            understanding.recommendedAttention === "HIGH" ? "missing_critical" : "assumed",
          confidence:
            understanding.recommendedAttention === "HIGH"
              ? "high"
              : understanding.recommendedAttention === "MEDIUM"
                ? "medium"
                : "low",
        },
        {
          id: "next-best-action",
          topic: "Next best action",
          statement: nba.action,
          category: catalog.missingCritical.length > 0 ? "missing_critical" : "known",
          confidence: "high",
          confidenceReason: nba.expectedImpact,
        },
        {
          id: "next-best-action-why",
          topic: "Why",
          statement: nba.why,
          category: "assumed",
          confidence: "medium",
        },
      ];
      if (understanding.recommendedConversations[0]) {
        insights.push({
          id: "conversation-focus",
          topic: "Conversation focus",
          statement: understanding.recommendedConversations[0],
          category: "assumed",
          confidence: "medium",
        });
      }
      return buildQueryResponse(nba.action, insights, ctx);
    }
    default:
      return buildQueryResponse(
        "Ask a specific question about this opportunity.",
        [],
        ctx,
      );
  }
}

function answerStakeholderQuestion(ctx: OpportunityAskContext): SmartAssistQueryResponse {
  const company = findCompanyForDeal(ctx.pipeline.id, ctx.companies);
  const team = ctx.pipeline.team ?? [];
  const decisionMaker = team.find((member) => /decision maker/i.test(member.projectRole));

  const insights: SmartAssistInsight[] = [];

  if (team.length === 0) {
    insights.push({
      id: "decision-maker-unknown",
      topic: "Decision Maker",
      statement: "Unknown",
      category: "unknown",
      confidence: "low",
      confidenceReason:
        "No stakeholders are assigned on this opportunity yet. Do not invent contacts — add them from the company roster.",
    });

    return buildQueryResponse(
      "Stakeholder map is incomplete — Decision Maker is unknown.",
      insights,
      ctx,
      {
        unknown: buildUnknownResponse(
          "No stakeholders are assigned on this opportunity.",
          ["Decision maker identity", "Economic buyer", "Technical influencers"],
          [
            "Who holds budget authority for this project?",
            "Which company contact should we add first?",
          ],
        ),
        suggestedQuestions: [
          "Who holds final decision authority?",
          "Which contacts from the account should be on this opportunity?",
        ],
      },
    );
  }

  for (const [index, member] of team.entries()) {
    const contact = company?.contacts.find((entry) => entry.ContactID === member.contactId);
    const name = contact
      ? contact.Title || `${contact.FirstName} ${contact.LastName}`.trim()
      : member.contactId;
    const isDecision = /decision maker/i.test(member.projectRole);
    insights.push({
      id: `stakeholder-${index}`,
      topic: member.projectRole || "Stakeholder",
      statement: name,
      category: isDecision ? "known" : "known",
      confidence: "high",
      confidenceReason: "Assigned on this opportunity — user-controlled roster.",
    });
  }

  if (!decisionMaker) {
    insights.push({
      id: "decision-maker-unknown",
      topic: "Decision Maker",
      statement: "Unknown",
      category: "unknown",
      confidence: "low",
      confidenceReason:
        "Contacts are assigned, but none have the Decision Maker role yet.",
    });
  }

  return buildQueryResponse(
    `${team.length} stakeholder${team.length === 1 ? "" : "s"} on ${ctx.pipeline.assetName}.`,
    insights,
    ctx,
    {
      suggestedQuestions: [
        "Who holds final decision authority?",
        "Who controls budget for this project?",
      ],
    },
  );
}

function answerActivityQuestion(ctx: OpportunityAskContext): SmartAssistQueryResponse {
  const dealActivities = getActivitiesForDeal(ctx.activities, ctx.pipeline.id);
  if (dealActivities.length === 0) {
    return buildQueryResponse(
      "No customer activities are logged on this opportunity.",
      [],
      ctx,
      {
        unknown: buildUnknownResponse(
          "Without logged activities, recent dialogue and customer signals are unavailable.",
          ["Recent customer conversations", "Meeting outcomes", "Commitments made"],
          [
            "Log the most recent customer interaction.",
            "What did the customer say in your last conversation?",
          ],
        ),
      },
    );
  }

  const latest = [...dealActivities].sort(
    (a, b) => new Date(b.ActivityDate).getTime() - new Date(a.ActivityDate).getTime(),
  )[0];
  const context = latest?.Summary?.trim() || latest?.Subject?.trim() || "recent engagement";

  return buildQueryResponse(
    `Most recent engagement (${latest?.ActivityDate ?? "unknown date"}).`,
    [
      {
        id: "latest-activity",
        topic: "Recent dialogue",
        statement: context,
        category: "known",
        confidence: "high",
        confidenceReason: "From logged activity record.",
      },
      {
        id: "activity-count",
        topic: "Engagement history",
        statement: `${dealActivities.length} activit${dealActivities.length === 1 ? "y" : "ies"} inform understanding.`,
        category: "known",
        confidence: "high",
      },
    ],
    ctx,
  );
}

function answerDocumentQuestion(ctx: OpportunityAskContext): SmartAssistQueryResponse {
  if (ctx.dealDocuments.length === 0) {
    return buildQueryResponse(
      "No SmartDocs are linked to this opportunity.",
      [],
      ctx,
      {
        unknown: buildUnknownResponse(
          "Without linked documents, knowledge reuse and validation evidence are limited.",
          ["Quotations", "Technical studies", "Prior proposals"],
          [
            "Link relevant SmartDocs to this opportunity.",
            "What documents exist for this customer or project type?",
          ],
        ),
      },
    );
  }

  const insights: SmartAssistInsight[] = ctx.dealDocuments.slice(0, 4).map((doc) => ({
    id: doc.document.id,
    topic: doc.document.displayName,
    statement: doc.subtitle,
    category: "known" as const,
    confidence: "high" as const,
    confidenceReason: "Linked SmartDoc on this opportunity.",
  }));

  return buildQueryResponse(
    `${ctx.dealDocuments.length} linked document${ctx.dealDocuments.length === 1 ? "" : "s"}.`,
    insights,
    ctx,
  );
}

function answerRiskQuestion(ctx: OpportunityAskContext): SmartAssistQueryResponse {
  const gaps = ctx.understanding.knowledgeModel.criticalGaps;
  if (gaps.length === 0) {
    return buildQueryResponse(
      `Attention level is ${ctx.understanding.recommendedAttention}. No critical knowledge gaps are flagged.`,
      [
        {
          id: "attention",
          topic: "Attention",
          statement: ctx.understanding.attentionReason,
          category: "assumed",
          confidence: "medium",
        },
      ],
      ctx,
      {
        suggestedQuestions: ["Which assumptions still need customer validation?"],
      },
    );
  }

  const insights: SmartAssistInsight[] = gaps.slice(0, 3).map((gap) => ({
    id: `gap-${gap.id}`,
    topic: gap.missingInformation,
    statement: gap.whyItMatters,
    category: gapToCategory(gap),
    confidence: gap.priority === "high" ? "high" : "medium",
    confidenceReason: gap.recommendedAction,
  }));

  return buildQueryResponse(
    `Primary risk driver: ${gaps[0]!.missingInformation}.`,
    insights,
    ctx,
  );
}

function answerDefault(ctx: OpportunityAskContext): SmartAssistQueryResponse {
  const { understanding } = ctx;
  const catalog = buildOpportunityInsightCatalog(understanding);
  const gapPreview =
    understanding.knowledgeModel.criticalGaps[0]?.missingInformation ?? null;

  const objectiveInsight = catalog.all.find((item) => item.id === "client-objective");
  const insights: SmartAssistInsight[] = [];
  if (objectiveInsight) insights.push(objectiveInsight);
  insights.push({
    id: "next-best-action",
    topic: "Next best action",
    statement: understanding.nextBestAction.action,
    category: catalog.missingCritical.length > 0 ? "missing_critical" : "assumed",
    confidence: "medium",
    confidenceReason: understanding.nextBestAction.why,
  });

  const headline = gapPreview
    ? `${catalog.known.length} known insight${catalog.known.length === 1 ? "" : "s"}. Most pressing gap: ${gapPreview}.`
    : `${catalog.known.length} known insight${catalog.known.length === 1 ? "" : "s"}. Next: ${understanding.nextBestAction.action}.`;

  return buildQueryResponse(headline, insights, ctx);
}

function answerOfferingQuestion(ctx: OpportunityAskContext): SmartAssistQueryResponse {
  const intel = buildOfferingIntelligence(ctx.pipeline.offeringIds, ctx.pipeline.team);

  if (intel.offeringsUnknown) {
    return buildQueryResponse(
      "What Standard Bio is selling is Unknown.",
      [
        {
          id: "offerings-unknown",
          topic: "Standard Bio offerings",
          statement: "Unknown",
          category: "unknown",
          confidence: "low",
          confidenceReason:
            "No systems, products, or services are linked. Select offerings so SmartAssist can qualify this opportunity.",
        },
      ],
      ctx,
      {
        unknown: buildUnknownResponse(
          "Offering scope is not defined on this opportunity.",
          ["Systems in scope", "Products in scope", "Services in scope"],
          [
            "Which Standard Bio offerings are we proposing?",
            "Is this primarily equipment, assessment, or ongoing service?",
          ],
        ),
        suggestedQuestions: intel.discoveryQuestions.slice(0, 3),
      },
    );
  }

  const insights: SmartAssistInsight[] = [
    {
      id: "offerings-intent",
      topic: "What we are selling",
      statement: intel.commercialIntent,
      category: "known",
      confidence: "high",
      confidenceReason: "From selected Standard Bio offerings on this opportunity.",
    },
    ...intel.offerings.slice(0, 4).map((offering, index) => ({
      id: `offering-${index}`,
      topic: offering.category === "system" ? "System" : offering.category === "product" ? "Product" : "Service",
      statement: `${offering.name} — ${offering.summary}`,
      category: "known" as const,
      confidence: "high" as const,
      confidenceReason: "Linked offering record.",
    })),
  ];

  if (intel.missingStakeholderRoles.length > 0) {
    insights.push({
      id: "offering-stakeholders",
      topic: "Stakeholder identification",
      statement: `Still needed for these offerings: ${intel.missingStakeholderRoles.slice(0, 3).join(", ")}`,
      category: "unknown",
      confidence: "medium",
      confidenceReason: "Suggested by offering profile — add real contacts, do not invent them.",
    });
  }

  if (intel.requiredInformation[0]) {
    insights.push({
      id: "offering-required",
      topic: "Required information",
      statement: intel.requiredInformation[0],
      category: "unknown",
      confidence: "medium",
      confidenceReason: "Required to advance selected offerings.",
    });
  }

  return buildQueryResponse(intel.commercialIntent, insights, ctx, {
    suggestedQuestions: intel.discoveryQuestions.slice(0, 3),
  });
}

export function answerOpportunityQuestion(
  query: string,
  ctx: OpportunityAskContext,
): SmartAssistQueryResponse {
  const q = normalize(query);
  if (!q) {
    return buildQueryResponse(
      "Ask a specific question about this opportunity — gaps, stakeholders, next steps, or documents.",
      [],
      ctx,
    );
  }

  const understandingQuestion = matchUnderstandingQuestion(query);
  if (understandingQuestion) {
    return answerFromUnderstandingQuestion(understandingQuestion, ctx);
  }

  if (matchesAny(q, ["who", "contact", "stakeholder", "decision maker", "buyer"])) {
    return answerStakeholderQuestion(ctx);
  }

  if (matchesAny(q, ["offering", "selling", "sell", "system", "product", "service", "what are we"])) {
    return answerOfferingQuestion(ctx);
  }

  if (matchesAny(q, ["activit", "conversation", "meeting", "call", "dialogue", "last spoke"])) {
    return answerActivityQuestion(ctx);
  }

  if (matchesAny(q, ["document", "smartdoc", "quotation", "quote", "knowledge", "file"])) {
    return answerDocumentQuestion(ctx);
  }

  if (matchesAny(q, ["risk", "block", "concern", "attention", "gap", "unknown"])) {
    return answerRiskQuestion(ctx);
  }

  if (matchesAny(q, ["value", "deal size", "budget", "close", "stage", "owner"])) {
    const company = findCompanyForDeal(ctx.pipeline.id, ctx.companies);
    return buildQueryResponse(
      [
        `${ctx.pipeline.assetName} is at ${ctx.pipeline.status} stage with value ${formatDealValue(ctx.pipeline.currency, ctx.pipeline.salesValue)}.`,
        company ? `Account: ${company.Title}.` : "",
      ]
        .filter(Boolean)
        .join(" "),
      [
        {
          id: "commercial-metadata",
          topic: "Commercial record",
          statement: `Stage ${ctx.pipeline.status}, value ${formatDealValue(ctx.pipeline.currency, ctx.pipeline.salesValue)}.`,
          category: "known",
          confidence: "high",
          confidenceReason: "From opportunity header — confirm with customer before relying on budget assumptions.",
        },
        {
          id: "next-action",
          topic: "Recommended next step",
          statement: ctx.understanding.nextBestAction.action,
          category: "assumed",
          confidence: "medium",
          confidenceReason: ctx.understanding.nextBestAction.why,
        },
      ],
      ctx,
    );
  }

  return answerDefault(ctx);
}
