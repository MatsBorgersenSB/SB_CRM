import type { CompanyIndustry } from "@/types/company";
import type { Company } from "@/types/company";
import type { Contact } from "@/types/contact";
import growthSeed from "@/data/growth-intelligence.json";
import type { GrowthEvent } from "@/types/growth-intelligence";
import type {
  EventContactDiscovery,
  EventMeetingCategory,
  EventMeetingSignal,
  EventOutreachRecommendation,
  EventPlanningContact,
  EventPlanningMetrics,
  EventPlanningSeed,
  EventPlanningWorkspace,
  EventSignalGroups,
} from "@/types/event-planning";
import { company360Href } from "@/types/company-360";
import { companyHasType, isOpportunityEligibleCompany } from "@/lib/company-classification";
import type { EventPlanningPersistedState } from "@/lib/event-planning-state";
import {
  applySignalBudget,
  discoverySourceToSignalSource,
  SIGNAL_BUDGETS,
  sourceToInsightCategory,
} from "@/lib/signal-extraction";

type GrowthSeedWithPlanning = {
  events: GrowthEvent[];
  eventPlanning: Record<string, EventPlanningSeed>;
};

const seed = growthSeed as unknown as GrowthSeedWithPlanning;

export function getGrowthEventById(eventId: string): GrowthEvent | null {
  return seed.events.find((event) => event.id === eventId) ?? null;
}

export function listGrowthEventIds(): string[] {
  return seed.events.map((event) => event.id);
}

function getPlanningSeed(eventId: string): EventPlanningSeed | null {
  return seed.eventPlanning[eventId] ?? null;
}

function websiteFromDomain(domain?: string): string | undefined {
  if (!domain?.trim()) return undefined;
  const normalized = domain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return `https://${normalized}`;
}

function buildCompanyDiscovery(
  company: Company,
  source: EventContactDiscovery["source"] = "crm",
): EventContactDiscovery {
  return {
    website: websiteFromDomain(company.Domain),
    email: company.Email || undefined,
    phone: company.Phone || undefined,
    source,
  };
}

function buildContactDiscovery(
  contact: Contact,
  company: Company,
): EventContactDiscovery {
  return {
    website: websiteFromDomain(company.Domain),
    email: contact.Email || undefined,
    phone: contact.Phone || contact.Mobile || undefined,
    linkedInUrl: contact.LinkedInURL || undefined,
    source: "crm",
  };
}

function scoreCrmCompany(
  company: Company,
  planningSeed: EventPlanningSeed,
  event: GrowthEvent,
): { score: number; reasons: string[] } {
  if (companyHasType(company, "Competitor")) {
    return { score: 0, reasons: [] };
  }
  if (!isOpportunityEligibleCompany(company)) {
    return { score: 0, reasons: [] };
  }

  let score = 40;
  const reasons: string[] = [];

  if (planningSeed.targetIndustries.includes(company.Industry)) {
    score += 25;
    reasons.push(`${company.Industry} aligns with ${event.name} audience`);
  }

  const geography = company.Country?.Title ?? company.City;
  if (
    geography &&
    planningSeed.targetGeographies.some((geo) =>
      geography.toLowerCase().includes(geo.toLowerCase()),
    )
  ) {
    score += 15;
    reasons.push(`Geography match (${geography})`);
  }

  if (company.Domain.endsWith(".de") && event.location.includes("Germany")) {
    score += 10;
    reasons.push("German market presence relevant for IFAT");
  }

  if (company.Status === "Prospecting" || company.Status === "Active") {
    score += 10;
    reasons.push(`${company.Status} account — outreach window open`);
  }

  if (company.pipelineIds && company.pipelineIds.length > 0) {
    score += 10;
    reasons.push("Existing pipeline relationship");
  }

  if (reasons.length === 0) {
    reasons.push("CRM account in adjacent sector");
  }

  return { score: Math.min(score, 100), reasons };
}

function scoreContact(
  contact: Contact,
  companyScore: number,
  planningSeed: EventPlanningSeed,
): { score: number; whyRelevant: string; topics: string[] } {
  let score = companyScore;
  const roleBoost =
    contact.Role === "Executive Sponsor" || contact.Role === "Procurement" ? 15 : 5;
  score += roleBoost;

  const whyRelevant =
    contact.Role === "Executive Sponsor"
      ? `${contact.JobTitle || contact.Role} — budget and strategic authority`
      : contact.Role === "Procurement"
        ? `${contact.JobTitle || contact.Role} — vendor evaluation gatekeeper`
        : `${contact.JobTitle || contact.Role} — operational influence on project scope`;

  const topics = [
    ...planningSeed.discussionThemes.slice(0, 2),
    `${contact.Role} perspective on project timeline`,
  ];

  return { score: Math.min(score, 100), whyRelevant, topics };
}

function contactPriority(score: number): EventPlanningContact["priority"] {
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}

function confidenceFromScore(score: number): EventOutreachRecommendation["confidence"] {
  if (score >= 80) return "high";
  if (score >= 60) return "medium";
  return "low";
}

function buildOutreachDraft(
  event: GrowthEvent,
  contactName: string,
  companyName: string,
  topics: string[],
): { subject: string; body: string } {
  return {
    subject: `Meeting at ${event.name} — ${companyName}`,
    body: `Dear ${contactName.split(" ")[0]},

We will be attending ${event.name} (${event.location}, ${event.dateLabel}) and would value a short conversation.

Topics we would like to explore:
${topics.map((topic) => `• ${topic}`).join("\n")}

Would you have 20 minutes during the event, or should we schedule a call beforehand?

Best regards`,
  };
}

export function buildEventPlanningWorkspace(
  eventId: string,
  companies: Company[],
  persisted: EventPlanningPersistedState,
): EventPlanningWorkspace | null {
  const event = getGrowthEventById(eventId);
  const planningSeed = getPlanningSeed(eventId);
  if (!event || !planningSeed) return null;

  const workspaceCompanies: EventPlanningWorkspace["companies"] = [];
  const workspaceContacts: EventPlanningContact[] = [];

  for (const company of companies) {
    const { score, reasons } = scoreCrmCompany(company, planningSeed, event);
    if (score < 50) continue;

    const companyTargetId = company.CompanyID;
    workspaceCompanies.push({
      id: companyTargetId,
      name: company.Title,
      companyId: company.CompanyID,
      industry: company.Industry,
      geography: company.Country?.Title ?? company.City,
      relevanceScore: score,
      relevanceReasons: reasons,
      discovery: buildCompanyDiscovery(company),
      inCrm: true,
      href: company360Href(company.CompanyID),
    });

    for (const contact of company.contacts ?? []) {
      const contactScoring = scoreContact(contact, score, planningSeed);
      const contactTargetId = contact.ContactID;
      const persistedStatus = persisted.contacts[contactTargetId]?.status ?? "identified";

      workspaceContacts.push({
        id: contactTargetId,
        contactId: contact.ContactID,
        companyTargetId,
        companyName: company.Title,
        name: contact.Title,
        jobTitle: contact.JobTitle,
        role: contact.Role,
        relevanceScore: contactScoring.score,
        whyRelevant: contactScoring.whyRelevant,
        discussionTopics: contactScoring.topics,
        discovery: buildContactDiscovery(contact, company),
        status: persistedStatus,
        inCrm: true,
        priority: contactPriority(contactScoring.score),
      });
    }
  }

  workspaceCompanies.sort((a, b) => b.relevanceScore - a.relevanceScore);
  workspaceContacts.sort((a, b) => b.relevanceScore - a.relevanceScore);

  const totalCompanies = workspaceCompanies.length;
  const totalContacts = workspaceContacts.length;

  const displayCompanies = applySignalBudget(workspaceCompanies, 5);
  const displayContacts = applySignalBudget(workspaceContacts, SIGNAL_BUDGETS.eventMeetings);

  const recommendations: EventOutreachRecommendation[] = workspaceContacts
    .slice(0, SIGNAL_BUDGETS.eventRecommendations)
    .map((contact, index) => {
      const draft = contact.discovery.email
        ? buildOutreachDraft(event, contact.name, contact.companyName, contact.discussionTopics)
        : undefined;

      return {
        contactTargetId: contact.id,
        contactName: contact.name,
        companyName: contact.companyName,
        whyContact: contact.whyRelevant,
        discussionTopics: contact.discussionTopics,
        confidence: confidenceFromScore(contact.relevanceScore),
        priority: index + 1,
        emailSubject: draft?.subject,
        emailBody: draft?.body,
      };
    });

  const metrics: EventPlanningMetrics = {
    companiesIdentified: totalCompanies,
    contactsIdentified: totalContacts,
    meetingsRequested: workspaceContacts.filter(
      (c) => c.status === "meeting_requested" || c.status === "meeting_scheduled",
    ).length,
    meetingsScheduled: workspaceContacts.filter((c) => c.status === "meeting_scheduled").length,
    companiesShown: displayCompanies.length,
    contactsShown: displayContacts.length,
  };

  const nextActions: string[] = [];
  const primaryAction =
    metrics.meetingsScheduled === 0 && recommendations.length > 0
      ? `Request meeting with ${recommendations[0].contactName} (${recommendations[0].companyName})`
      : null;

  if (primaryAction) nextActions.push(primaryAction);
  if (workspaceCompanies.some((c) => !c.inCrm)) {
    nextActions.push("Add high-relevance prospect companies to CRM before outreach");
  }
  if (event.planningStatus === "needs_planning") {
    nextActions.push("Confirm attendance and book meeting suite");
  }
  nextActions.push("Create pre-event activities for top 3 contacts");

  return {
    event,
    headline: `${event.name} — top meetings, not exhibitor lists`,
    focusQuestions: [
      "What matters at this event?",
      "Who should we meet?",
      "Why them?",
      "What should happen next?",
    ],
    companies: displayCompanies,
    contacts: displayContacts,
    signals: buildEventSignals(workspaceContacts, companies),
    recommendations,
    metrics,
    primaryAction,
    nextActions,
  };
}

function classifyMeetingCategory(
  company: Company | undefined,
  inCrm: boolean,
  hasPipeline: boolean,
): EventMeetingCategory {
  if (company && companyHasType(company, "Competitor")) return "competitor";
  if (company && companyHasType(company, "Partner")) return "partner";
  if (company && (companyHasType(company, "Customer") || company.Status === "Contracted")) {
    return "customer";
  }
  if (hasPipeline) return "opportunity_match";
  return "prospect";
}

function buildEventSignals(
  contacts: EventPlanningContact[],
  companies: Company[],
): EventSignalGroups {
  const companyMap = new Map(companies.map((c) => [c.CompanyID, c]));

  const signals: EventMeetingSignal[] = contacts.map((contact, index) => {
    const company = contact.companyTargetId.startsWith("CO-")
      ? companyMap.get(contact.companyTargetId)
      : undefined;
    const hasPipeline = Boolean(company?.pipelineIds?.length);
    const category = classifyMeetingCategory(company, contact.inCrm, hasPipeline);

    return {
      rank: index + 1,
      contactTargetId: contact.id,
      name: contact.name,
      companyName: contact.companyName,
      category,
      whyMeet: contact.whyRelevant,
      confidence: confidenceFromScore(contact.relevanceScore),
      insightCategory: sourceToInsightCategory(
        discoverySourceToSignalSource(contact.discovery.source),
      ),
    };
  });

  const topToMeet = applySignalBudget(signals, SIGNAL_BUDGETS.eventMeetings);

  const byCategory = (category: EventMeetingCategory) =>
    applySignalBudget(
      signals.filter((s) => s.category === category),
      3,
    );

  return {
    topToMeet,
    topCompetitors: byCategory("competitor"),
    topPartners: byCategory("partner"),
    topCustomers: byCategory("customer"),
    topProspects: byCategory("prospect"),
  };
}

export function industryForEventSeed(eventId: string): CompanyIndustry | undefined {
  const planning = getPlanningSeed(eventId);
  const first = planning?.targetIndustries[0];
  if (!first) return undefined;
  return first as CompanyIndustry;
}
