import type { Activity } from "@/types/activity";
import type { ActivityActionRecommendations } from "@/types/activity-action-recommendations";
import type {
  ActivityActionContext,
  RelevantActivity,
  RelevantContact,
  RelevantDecision,
  RelevantDocument,
  RelatedOpportunity,
} from "@/types/activity-action-context";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";
import type { ActivityBriefing } from "@/lib/activity-briefing";
import { buildRelationshipMemory } from "@/lib/relationship-memory";
import { computeCommercialViability } from "@/lib/commercial-viability-engine";
import { buildOpportunityUnderstanding } from "@/lib/opportunity-workspace-intelligence";
import { opportunityStageLabel } from "@/lib/opportunity-overview";
import { contact360Href, deal360Href } from "@/types/relationship-navigation";
import { smartDocDisplayName, smartDocHref } from "@/types/smartdoc";
import type { InsightCategory } from "@/types/smartassist-intelligence";
import { SIGNAL_BUDGETS } from "@/lib/signal-extraction";

const MAX_DOCUMENTS = SIGNAL_BUDGETS.documents;
const MAX_ACTIVITIES = SIGNAL_BUDGETS.activities;
const MAX_CONTACTS = SIGNAL_BUDGETS.contacts;
const MAX_DECISIONS = SIGNAL_BUDGETS.decisions;

type Scored<T> = { item: T; score: number };

type BuildContextInput = {
  activity: Activity;
  briefing: ActivityBriefing;
  recommendations: ActivityActionRecommendations;
  companies: Company[];
  pipelines: PipelineRow[];
  allActivities: Activity[];
  smartDocsLibrary: SmartDocLibraryRecord[];
  commercialPackages: CommercialPackage[];
};

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2);
}

function overlapScore(corpus: string, needles: string[]): number {
  const tokens = new Set(tokenize(corpus));
  let score = 0;
  for (const needle of needles) {
    for (const token of tokenize(needle)) {
      if (tokens.has(token)) score += 8;
    }
  }
  return score;
}

function actionKeywords(recommendations: ActivityActionRecommendations): string[] {
  const { primary, blockingProgress } = recommendations;
  const parts = [
    primary.actionLabel,
    primary.reason,
    primary.expectedOutcome,
    blockingProgress,
  ];
  if (recommendations.email?.objective) parts.push(recommendations.email.objective);
  if (recommendations.followUp?.title) parts.push(recommendations.followUp.title);
  return parts;
}

function formatActivityDate(value: string): string {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function documentDisplayName(title: string): string {
  return smartDocDisplayName(title) || title;
}

function inferDocumentRelevance(
  docName: string,
  category: string | undefined,
  actionKeys: string[],
  blocker: string,
): string {
  const name = docName.toLowerCase();
  const keys = actionKeys.join(" ").toLowerCase();

  if (/feedstock|assumption/.test(name) && /feedstock|sample|volume|material/.test(keys)) {
    return "Contains current feedstock assumptions.";
  }
  if (/throughput|reconcil|volume|invoice|report/.test(name) && /volume|throughput|reconcil/.test(keys)) {
    return "References discussed annual volumes.";
  }
  if (/moisture|certification|quality|spec/.test(name) && /moisture|sample|certification|validat|quality/.test(keys)) {
    return "Needed to validate supplier data.";
  }
  if (/technical|datasheet|process|heat balance/.test(name) && /technical|sample|validat/.test(keys)) {
    return "Supports technical validation for the next step.";
  }
  if (/quotation|commercial|terms|budget/.test(name) && /commercial|email|align|proposal/.test(keys)) {
    return "Grounds commercial discussion in the latest offer.";
  }
  if (category === "Technical" && /request|information|sample/.test(keys)) {
    return "Technical reference for the information request.";
  }
  if (overlapScore(docName, [blocker]) > 0) {
    return `Directly relates to the current blocker: ${blocker}.`;
  }
  return "Linked to this engagement and the recommended action.";
}

function scoreDocument(
  doc: { id: string; name: string; category?: string; href: string | null; source: "activity" | "library" },
  input: BuildContextInput,
  actionKeys: string[],
): Scored<RelevantDocument> {
  let score = 0;
  const { activity, briefing } = input;

  if (activity.LinkedDocuments?.some((item) => item.Title === doc.name)) score += 100;
  if (doc.source === "activity") score += 60;
  if (doc.href) score += 10;
  score += overlapScore(doc.name, actionKeys);
  score += overlapScore(doc.name, [briefing.blockingProgress, briefing.nextStep]);
  if (doc.category === "Technical" && input.recommendations.primary.actionType === "request_information") {
    score += 25;
  }
  if (doc.category === "Commercial" && input.recommendations.primary.actionType === "send_email") {
    score += 20;
  }

  return {
    score,
    item: {
      id: doc.id,
      name: documentDisplayName(doc.name),
      whyRelevant: inferDocumentRelevance(
        doc.name,
        doc.category,
        actionKeys,
        briefing.blockingProgress,
      ),
      href: doc.href,
      insightCategory: doc.source === "activity" ? "known" : "assumed",
    },
  };
}

function collectDocuments(input: BuildContextInput): RelevantDocument[] {
  const { activity, allActivities, smartDocsLibrary } = input;
  const dealId = activity.Deal?.Title;
  const actionKeys = actionKeywords(input.recommendations);
  const seen = new Set<string>();
  const candidates: Array<{
    id: string;
    name: string;
    category?: string;
    href: string | null;
    source: "activity" | "library";
  }> = [];

  const pushDoc = (
    title: string,
    category: string | undefined,
    href: string | null,
    source: "activity" | "library",
    id?: string,
  ) => {
    const key = title.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({
      id: id ?? key,
      name: title,
      category,
      href,
      source,
    });
  };

  for (const doc of activity.LinkedDocuments ?? []) {
    pushDoc(doc.Title, doc.DocCategory, null, "activity", doc.Title);
  }

  const relatedActivities = allActivities.filter(
    (item) =>
      item.ActivityID !== activity.ActivityID &&
      ((dealId && item.Deal?.Title === dealId) ||
        (activity.Company?.Title && item.Company?.Title === activity.Company.Title)),
  );

  for (const related of relatedActivities) {
    for (const doc of related.LinkedDocuments ?? []) {
      pushDoc(doc.Title, doc.DocCategory, null, "activity", `${related.ActivityID}:${doc.Title}`);
    }
  }

  if (dealId) {
    for (const record of smartDocsLibrary.filter((row) => row.DealId === dealId)) {
      pushDoc(
        record.FileLeafRef || record.DocumentName,
        record.DocCategory,
        smartDocHref(record.SmartDocID),
        "library",
        record.SmartDocID,
      );
    }
  }

  return candidates
    .map((doc) => scoreDocument(doc, input, actionKeys))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_DOCUMENTS)
    .map((entry) => entry.item);
}

function inferActivityRelevance(
  related: Activity,
  input: BuildContextInput,
): string {
  const { activity, briefing } = input;
  const subject = related.Subject.toLowerCase();
  const next = briefing.nextStep.toLowerCase();

  if (related.KeyDecisions?.some((decision) => overlapScore(decision, [briefing.blockingProgress]) > 0)) {
    return "Captured a decision that shapes the current step.";
  }
  if (related.AgreedActions?.some((item) => /moisture|certification|sample/.test(item.text.toLowerCase()))) {
    return "Open dependency for the recommended action.";
  }
  if (/feedstock|volume/.test(subject) && /feedstock|volume|sample/.test(next)) {
    return "Origin of current assumptions.";
  }
  if (/technical|validation|meeting/.test(subject) && /sample|validat|technical/.test(next)) {
    return "Discussed sample or validation requirements.";
  }
  if (related.ActionRequired && related.ActionStatus !== "Completed") {
    return "Open commitment on the same opportunity.";
  }
  if (related.Risks?.some((risk) => overlapScore(risk, [briefing.blockingProgress]) > 0)) {
    return "Surfaces the same risk factor.";
  }
  if (activity.Deal?.Title && related.Deal?.Title === activity.Deal.Title) {
    return "Same opportunity — provides continuity.";
  }
  return "Recent context for this customer relationship.";
}

function scoreActivity(related: Activity, input: BuildContextInput, actionKeys: string[]): Scored<RelevantActivity> {
  const { activity, briefing } = input;
  let score = 0;

  if (activity.Deal?.Title && related.Deal?.Title === activity.Deal.Title) score += 50;
  if (activity.Company?.Title && related.Company?.Title === activity.Company.Title) score += 25;
  if (related.ActionRequired && related.ActionStatus !== "Completed") score += 35;
  if (related.LinkedDocuments?.length) score += 15;
  score += overlapScore(`${related.Subject} ${related.Summary ?? ""}`, actionKeys);
  score += overlapScore(`${related.Subject} ${related.ActivityDescription}`, [
    briefing.blockingProgress,
    briefing.nextStep,
  ]);

  const ageDays =
    (Date.now() - new Date(related.ActivityDate).getTime()) / (1000 * 60 * 60 * 24);
  if (ageDays <= 7) score += 30;
  else if (ageDays <= 21) score += 15;

  for (const decision of activity.KeyDecisions ?? []) {
    if (related.Summary && overlapScore(related.Summary, [decision]) > 0) score += 20;
  }

  return {
    score,
    item: {
      id: related.ActivityID,
      subject: related.Subject,
      dateLabel: formatActivityDate(related.ActivityDate),
      whyRelevant: inferActivityRelevance(related, input),
      href: `/activities/${related.ActivityID}`,
      insightCategory: "known",
    },
  };
}

function collectActivities(input: BuildContextInput): RelevantActivity[] {
  const { activity, allActivities } = input;

  return allActivities
    .filter((item) => item.ActivityID !== activity.ActivityID)
    .filter((item) => {
      if (activity.Deal?.Title && item.Deal?.Title === activity.Deal.Title) return true;
      if (activity.Company?.Title && item.Company?.Title === activity.Company.Title) return true;
      return false;
    })
    .map((item) => scoreActivity(item, input, actionKeywords(input.recommendations)))
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ACTIVITIES)
    .map((entry) => entry.item);
}

function attentionLabel(level: string): string {
  switch (level) {
    case "HIGH":
      return "High";
    case "MEDIUM":
      return "Medium";
    case "LOW":
      return "Low";
    default:
      return "Hold";
  }
}

function buildRelatedOpportunity(input: BuildContextInput): RelatedOpportunity | null {
  const dealId = input.activity.Deal?.Title;
  if (!dealId) return null;

  const pipeline = input.pipelines.find((row) => row.id === dealId);
  if (!pipeline) return null;

  const company = input.companies.find((row) => row.Title === input.activity.Company?.Title);
  const assessment = computeCommercialViability(
    pipeline,
    input.companies,
    input.allActivities,
    input.pipelines,
    input.commercialPackages,
  );
  const understanding = buildOpportunityUnderstanding(
    pipeline,
    input.companies,
    assessment,
    input.allActivities,
    [],
  );

  const topGap =
    understanding.knowledgeModel.criticalGaps.find((gap) => gap.priority === "high") ??
    understanding.knowledgeModel.criticalGaps[0];

  return {
    dealId,
    name: pipeline.assetName,
    status: opportunityStageLabel(pipeline, input.commercialPackages),
    attentionLevel: attentionLabel(understanding.recommendedAttention),
    biggestUnknown:
      topGap?.missingInformation ??
      understanding.assessment.gapsInUnderstanding[0] ??
      "No critical unknowns flagged",
    href: deal360Href(dealId),
  };
}

function inferContactRelationship(
  contactName: string,
  activity: Activity,
  company: Company | undefined,
): string {
  if (activity.Contact?.Title === contactName) return "Primary stakeholder";
  if (company?.AccountOwner?.Title === contactName) return "Account owner";
  return "Engagement contact";
}

function collectContacts(input: BuildContextInput): RelevantContact[] {
  const { activity, companies, briefing } = input;
  const company = companies.find((row) => row.Title === activity.Company?.Title);
  const memory = buildRelationshipMemory(activity);
  const seen = new Set<string>();
  const scored: Scored<RelevantContact>[] = [];

  const pushContact = (name: string, role: string, contactId: string | undefined, score: number) => {
    if (!name.trim() || seen.has(name)) return;
    seen.add(name);
    const resolved =
      company?.contacts.find((row) => row.Title === name) ??
      company?.contacts.find((row) => row.ContactID === contactId);
    scored.push({
      score,
      item: {
        contactId: resolved?.ContactID ?? contactId ?? name,
        name,
        role: resolved?.JobTitle?.trim() || resolved?.Role?.trim() || role || "Contact",
        relationship: inferContactRelationship(name, activity, company),
        href: contact360Href(resolved?.ContactID ?? contactId ?? name, company?.CompanyID),
      },
    });
  };

  if (activity.Contact?.Title) {
    pushContact(activity.Contact.Title, "Primary contact", activity.Contact.Title, 100);
  }

  for (const person of memory.stakeholders) {
    pushContact(person.name, person.role ?? "Stakeholder", person.contactId, 60);
  }

  if (company) {
    for (const contact of company.contacts.slice(0, 4)) {
      const title = `${contact.JobTitle ?? ""} ${contact.Role ?? ""}`.toLowerCase();
      const bonus =
        /procurement|commercial|technical|plant|operations|manager|director/.test(title) ? 30 : 10;
      pushContact(contact.Title, contact.JobTitle ?? contact.Role ?? "Contact", contact.ContactID, bonus);
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CONTACTS)
    .map((entry) => entry.item);
}

function inferDecisionRelevance(
  decision: string,
  input: BuildContextInput,
): string {
  const action = input.recommendations.primary.actionType;
  const keys = actionKeywords(input.recommendations).join(" ").toLowerCase();
  const decisionLower = decision.toLowerCase();

  if (action === "request_information" && /feedstock|material|sample|moisture/.test(decisionLower)) {
    return "Current validation depends on this decision.";
  }
  if (action === "schedule_teams_meeting" && /proceed|approve|align/.test(decisionLower)) {
    return "Meeting should confirm or advance this decision.";
  }
  if (overlapScore(decision, [input.briefing.blockingProgress]) > 0) {
    return "Directly connected to what is blocking progress.";
  }
  if (/proceed|approve|lock|confirm/.test(decisionLower) && /sample|validat|request/.test(keys)) {
    return "Shapes what can be validated in the next step.";
  }
  return "Informs the recommended action.";
}

function collectDecisions(input: BuildContextInput): RelevantDecision[] {
  const { activity, briefing, allActivities } = input;
  const actionKeys = actionKeywords(input.recommendations);
  const seen = new Set<string>();
  const scored: Scored<RelevantDecision>[] = [];

  const pushDecision = (text: string, sourceScore: number) => {
    const trimmed = text.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    scored.push({
      score:
        sourceScore +
        overlapScore(trimmed, actionKeys) +
        overlapScore(trimmed, [briefing.blockingProgress, briefing.nextStep]),
      item: {
        text: trimmed,
        whyRelevant: inferDecisionRelevance(trimmed, input),
      },
    });
  };

  for (const decision of activity.KeyDecisions ?? []) {
    pushDecision(decision, 80);
  }
  for (const decision of briefing.support.decisions) {
    pushDecision(decision, 70);
  }

  const dealId = activity.Deal?.Title;
  if (dealId) {
    for (const related of allActivities) {
      if (related.ActivityID === activity.ActivityID) continue;
      if (related.Deal?.Title !== dealId) continue;
      for (const decision of related.KeyDecisions ?? []) {
        pushDecision(decision, 40);
      }
    }
  }

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_DECISIONS)
    .map((entry) => entry.item);
}

export function buildActivityActionContext(input: BuildContextInput): ActivityActionContext {
  const dealId = input.activity.Deal?.Title;
  const documents = collectDocuments(input);
  const activities = collectActivities(input);
  const opportunity = buildRelatedOpportunity(input);
  const contacts = collectContacts(input);
  const decisions = collectDecisions(input);

  return {
    documents,
    activities,
    opportunity,
    contacts,
    decisions,
    viewAllDocumentsHref: dealId ? deal360Href(dealId, "documents") : null,
    viewAllActivitiesHref: dealId ? deal360Href(dealId, "activities") : "/activities",
  };
}

export function actionContextHasContent(context: ActivityActionContext): boolean {
  return (
    context.documents.length > 0 ||
    context.activities.length > 0 ||
    context.opportunity !== null ||
    context.contacts.length > 0 ||
    context.decisions.length > 0
  );
}

/** Michelin rule — only render when at least one contextual item is worth showing. */
export function shouldShowActionContext(context: ActivityActionContext): boolean {
  const total =
    context.documents.length +
    context.activities.length +
    (context.opportunity ? 1 : 0) +
    context.contacts.length +
    context.decisions.length;
  return total >= 1;
}
