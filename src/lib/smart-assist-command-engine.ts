import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { getContactDisplayName } from "@/types/contact";
import { company360Href } from "@/types/company-360";
import { deal360Href } from "@/types/relationship-navigation";
import type { SmartAssistCommandResult } from "@/types/smart-assist";
import { answerSmartSearchQuestion } from "@/lib/smart-search-ask-engine";
import type { SmartSearchContext } from "@/lib/smart-search-ask-engine";
import type { SmartAssistConversationContext } from "@/lib/smart-assist-conversation-engine";
import {
  answerConversationalQuestion,
  buildContextFirstAnswer,
  classifyConversationalIntent,
} from "@/lib/smart-assist-conversation-engine";
import {
  answerNaturalLanguage,
  classifyNaturalLanguageIntent,
  extractDealId,
  findPipelineForQuery,
} from "@/lib/smart-assist-intent-engine";
import {
  parseFilterIntentFromNaturalLanguage,
  stashWorkspaceFilters,
} from "@/lib/workspace-filter-bridge";
import {
  buildDeepResearchBriefing,
  classifyDeepResearchQuery,
} from "@/lib/deep-research-engine";

function normalize(text: string): string {
  return text.toLowerCase().trim();
}

function findContactByName(companies: Company[], query: string) {
  const q = normalize(query);
  for (const company of companies) {
    for (const contact of company.contacts) {
      const name = getContactDisplayName(contact).toLowerCase();
      if (q.includes(name) || name.includes(q)) {
        return { contact, company };
      }
    }
  }
  return null;
}

function findCompanyByName(companies: Company[], query: string) {
  const q = normalize(query);
  return companies.find(
    (company) =>
      q.includes(company.Title.toLowerCase()) ||
      company.Title.toLowerCase().includes(q),
  );
}

function extractWeekdayDate(text: string): string | undefined {
  const weekdays = [
    "monday",
    "tuesday",
    "wednesday",
    "thursday",
    "friday",
    "saturday",
    "sunday",
  ];
  const lower = text.toLowerCase();
  const target = weekdays.find((day) => lower.includes(day));
  if (!target) return undefined;

  const now = new Date();
  const current = now.getDay();
  const targetIndex = weekdays.indexOf(target) + 1;
  let diff = targetIndex - current;
  if (diff <= 0) diff += 7;
  const date = new Date(now);
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

function tryOperationalCommands(
  command: string,
  companies: Company[],
  pipelines: PipelineRow[],
): SmartAssistCommandResult | null {
  const q = normalize(command);

  if (q.includes("schedule meeting") || q.includes("book meeting") || q.includes("plan meeting")) {
    const match = findContactByName(companies, command);
    const planDate = extractWeekdayDate(command);
    const subject = match
      ? `Meeting with ${getContactDisplayName(match.contact)}`
      : "Scheduled meeting";

    return {
      intent: "schedule_meeting",
      summary: match
        ? `I'll help you schedule a meeting with ${getContactDisplayName(match.contact)}${planDate ? ` on ${planDate}` : ""}.`
        : "Open activities to plan a meeting with the right stakeholders.",
      actionLabel: "Plan meeting",
      href: "/activities",
      prefill: {
        ActivityType: q.includes("teams") ? "Teams Meeting" : "Meeting",
        Subject: subject,
        ...(match ? { contactId: match.contact.ContactID, companyId: match.company.CompanyID } : {}),
        ...(planDate ? { planDate } : {}),
      },
    };
  }

  if (q.includes("draft email") || q.includes("write email") || q.includes("compose email")) {
    const company = findCompanyByName(companies, command);
    const match = findContactByName(companies, command);
    const target = match ?? (company ? { company, contact: company.contacts[0] } : null);

    return {
      intent: "draft_email",
      summary: target?.contact
        ? `Prepare an email follow-up to ${getContactDisplayName(target.contact)} at ${target.company.Title}.`
        : company
          ? `Prepare an email to ${company.Title}.`
          : "Select a company or contact to draft an email follow-up.",
      actionLabel: "Create email follow-up",
      href: target
        ? `/activities?intent=email&contact=${encodeURIComponent(target.contact?.ContactID ?? "")}`
        : "/activities",
      prefill: {
        ActivityType: "Email Follow-Up",
        Subject: target?.contact
          ? `Follow-up with ${getContactDisplayName(target.contact)}`
          : "Email follow-up",
        ...(target
          ? {
              contactId: target.contact?.ContactID ?? "",
              companyId: target.company.CompanyID,
            }
          : {}),
      },
    };
  }

  if (q.includes("follow-up") || q.includes("follow up") || q.includes("create follow")) {
    const dealId = extractDealId(command);
    const pipeline = dealId ? pipelines.find((p) => p.id === dealId) : undefined;

    return {
      intent: "create_follow_up",
      summary: pipeline
        ? `Create a follow-up commitment for ${pipeline.assetName} (${dealId}).`
        : dealId
          ? `Create a follow-up for opportunity ${dealId}.`
          : "Name an opportunity or include an ID (e.g. PL-1042) to create a targeted follow-up.",
      actionLabel: "Create follow-up",
      href: pipeline ? deal360Href(pipeline.id, "activities") : "/activities",
      prefill: dealId ? { dealId, Subject: `Follow-up on ${dealId}` } : undefined,
    };
  }

  if (q.includes("meeting brief") || q.includes("briefing")) {
    const company = findCompanyByName(companies, command);
    return {
      intent: "generate_meeting_brief",
      summary: company
        ? `Generate a meeting brief for ${company.Title}.`
        : "Open meeting briefing with portfolio context.",
      actionLabel: "Meeting brief",
      href: company ? company360Href(company.CompanyID) : "/outlook/meeting-briefing",
    };
  }

  if (q.includes("stakeholder")) {
    const dealId = extractDealId(command);
    const pipeline =
      dealId ? pipelines.find((p) => p.id === dealId) : findPipelineForQuery(command, pipelines, companies);

    return {
      intent: "stakeholder_review",
      summary: pipeline
        ? `Review stakeholders on ${pipeline.assetName}.`
        : "Open an opportunity to review stakeholder coverage.",
      actionLabel: "Stakeholder review",
      href: pipeline ? deal360Href(pipeline.id, "intelligence") : "/opportunities",
      dealId: pipeline?.id,
    };
  }

  return null;
}

export function parseSmartAssistCommand(
  command: string,
  companies: Company[],
  pipelines: PipelineRow[],
): SmartAssistCommandResult {
  if (!command.trim()) {
    return {
      intent: "ask",
      summary:
        "Ask in plain language — e.g. What should I focus on today?, What am I forgetting?, or Which customer is at risk?",
      actionLabel: "View activities",
      href: "/activities",
    };
  }

  const operational = tryOperationalCommands(command, companies, pipelines);
  if (operational) return operational;

  if (classifyNaturalLanguageIntent(command)) {
    return {
      intent: "ask",
      summary: "Analyzing opportunity with CVM…",
      actionLabel: "View assessment",
    };
  }

  return {
    intent: "ask",
    summary: "Searching SmartCRM…",
    actionLabel: "View results",
  };
}

export function executeSmartAssistAsk(
  command: string,
  ctx: SmartSearchContext & Partial<SmartAssistConversationContext>,
): SmartAssistCommandResult {
  const conversationCtx: SmartAssistConversationContext = {
    companies: ctx.companies,
    pipelines: ctx.pipelines,
    activities: ctx.activities,
    commercialPackages: ctx.commercialPackages,
    index: ctx.index,
    user: ctx.user,
    pathname: ctx.pathname,
    focus: ctx.focus,
  };

  const operational = tryOperationalCommands(command, ctx.companies, ctx.pipelines);
  if (operational) return operational;

  if (classifyDeepResearchQuery(command)) {
    const briefing = buildDeepResearchBriefing(
      command,
      ctx.companies,
      ctx.pipelines,
      ctx.activities,
    );
    if (briefing) {
      return {
        intent: "deep_research",
        summary: `${briefing.subjectLabel} — ${briefing.overallAssessment.summary}`,
        actionLabel: briefing.href ? "Open in CRM" : "View briefing",
        href: briefing.href,
        researchBriefing: briefing,
        openResearch: true,
      };
    }
    return {
      intent: "deep_research",
      summary:
        "I could not match that research target. Try a company name, contact, competitor (PYREG), or market topic (Swedish biochar market).",
      actionLabel: "Browse companies",
      href: "/companies",
    };
  }

  const filterIntent = parseFilterIntentFromNaturalLanguage(command);
  if (filterIntent) {
    stashWorkspaceFilters(filterIntent);
    return {
      intent: "ask",
      summary: filterIntent.summary,
      actionLabel: "Open filtered view",
      href: filterIntent.path,
    };
  }

  const conversational = answerConversationalQuestion(command, conversationCtx);
  if (conversational) return conversational;

  const natural = answerNaturalLanguage(command, ctx);
  if (natural) return natural;

  const search = answerSmartSearchQuestion(command, ctx);
  if (search) {
    return {
      intent: "ask",
      summary: search.answer,
      actionLabel: search.recommendedAction,
      href: search.actionHref,
    };
  }

  return buildContextFirstAnswer(command, conversationCtx);
}

export function executeSmartAssistCommand(
  command: string,
  ctx: SmartSearchContext & Partial<SmartAssistConversationContext>,
): SmartAssistCommandResult {
  return executeSmartAssistAsk(command, ctx);
}

export {
  extractDealId,
  findPipelineForQuery,
  classifyNaturalLanguageIntent,
  classifyConversationalIntent,
};
