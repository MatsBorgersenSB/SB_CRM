import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { BuyingRole, Contact } from "@/types/contact";
import type { PipelineRow } from "@/types/pipeline";
import type { UnderstandingFieldId } from "@/types/opportunity-understanding";
import { deal360Href } from "@/types/relationship-navigation";
import { company360Href } from "@/types/company-360";
import { getActivitiesForDeal } from "@/lib/activity-utils";
import { resolveUnderstandingField } from "@/lib/opportunity-understanding-model";
import {
  getCompanyRelationshipPosture,
  isOpportunityEligibleCompany,
  companyHasType,
} from "@/lib/company-classification";
import { companyForDeal, openSalesDeals } from "@/lib/growth-operating-loop";
import { isEventUpcoming } from "@/lib/growth-event-timing";
import type { GrowthEvent } from "@/types/growth-intelligence";
import type {
  GrowthCorrespondenceSnippet,
  GrowthDealRecord,
  GrowthEcosystemMatch,
  GrowthMarketIntelCard,
  GrowthMeetingKnowledgeGap,
  GrowthMeetingTarget,
  GrowthOfferKind,
  GrowthSuperSkills,
  GrowthWinLossMemory,
  GrowthChangeSignal,
} from "@/types/growth-super-skills";
import {
  buildLiveCompetitorWatch,
  type LiveCompetitorWatch,
} from "@/lib/competitor-brief";
import { confirmedFindingAnswerForField, type SourceFinding } from "@/lib/source-findings";

const SEED_COMPETITOR_ALIASES = [
  { name: "PYREG", tokens: ["pyreg"] },
  { name: "ETIA / Biogreen", tokens: ["etia", "biogreen"] },
  { name: "Carbofex", tokens: ["carbofex"] },
] as const;

const ECONOMIC_ROLES = /economic buyer|decision maker|executive sponsor|cfo|finance|budget|procurement/i;
const TECHNICAL_ROLES = /technical|engineer|plant manager|operations|specifier|cto/i;
const FINANCE_ROLES = /cfo|finance|economic buyer|budget|investor/i;
const AUTHORITY_ROLES = /compliance|permit|environmental|authority|legal/i;

const ECONOMIC_BUYING: BuyingRole[] = ["Economic Buyer", "Champion"];
const TECHNICAL_BUYING: BuyingRole[] = ["Technical Evaluator", "End User"];

function todayIso(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function clip(text: string, max = 140): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function dealText(deal: GrowthDealRecord): string {
  const understanding = Object.values(deal.understanding?.fields ?? {}).join(" ");
  return [
    deal.assetName,
    deal.description ?? "",
    deal.currentMilestone,
    deal.ClientLookup ?? "",
    understanding,
  ]
    .join(" \n ")
    .toLowerCase();
}

function activityText(activity: Activity): string {
  return [
    activity.Subject,
    activity.ActivityDescription,
    activity.Summary ?? "",
    activity.NextAction,
    ...(activity.Risks ?? []),
  ]
    .join(" \n ")
    .toLowerCase();
}

type CompetitorSearchRow = {
  name: string;
  tokens: string[];
  companyId?: string;
  href?: string;
  knownFact?: string;
};

function competitorSearchRows(watch: LiveCompetitorWatch[]): CompetitorSearchRow[] {
  const live: CompetitorSearchRow[] = watch.map((row) => ({
    name: row.companyName,
    tokens: row.tokens,
    companyId: row.companyId,
    href: row.href,
    knownFact: row.confirmedFacts[0],
  }));
  const liveTokens = new Set(live.flatMap((row) => row.tokens));
  const seed: CompetitorSearchRow[] = SEED_COMPETITOR_ALIASES.filter(
    (alias) => !alias.tokens.some((token) => liveTokens.has(token)),
  ).map((alias) => ({
    name: alias.name,
    tokens: [...alias.tokens],
  }));
  return [...live, ...seed];
}

function findCompetitorMentions(
  haystack: string,
  rows: CompetitorSearchRow[],
): Array<{
  name: string;
  quote: string;
  companyId?: string;
  href?: string;
  knownFact?: string;
}> {
  const hits: Array<{
    name: string;
    quote: string;
    companyId?: string;
    href?: string;
    knownFact?: string;
  }> = [];
  for (const row of rows) {
    const token = row.tokens.find((item) => haystack.includes(item));
    if (!token) continue;
    const start = Math.max(0, haystack.indexOf(token) - 40);
    hits.push({
      name: row.name,
      quote: clip(haystack.slice(start, start + 120)),
      companyId: row.companyId,
      href: row.href,
      knownFact: row.knownFact,
    });
  }
  return hits;
}

function activitiesForDeal(activities: Activity[], deal: PipelineRow): Activity[] {
  const keys = new Set(
    [deal.id, deal.code ?? "", deal.assetName].map((value) => value.trim().toLowerCase()).filter(Boolean),
  );
  const matched = activities.filter((activity) => {
    const titles = [
      activity.Deal?.Title,
      ...(activity.LinkedDeals ?? []).map((linked) => linked.Title),
    ]
      .map((title) => title?.trim().toLowerCase() ?? "")
      .filter(Boolean);
    return titles.some((title) => keys.has(title));
  });
  const fromLookup = getActivitiesForDeal(activities, deal.id);
  const byId = new Map<string, Activity>();
  for (const activity of [...fromLookup, ...matched]) {
    byId.set(activity.ActivityID || String(activity.id), activity);
  }
  return [...byId.values()];
}

function contactCovers(
  contact: Contact,
  kind: "economic" | "technical" | "financier" | "authority",
): boolean {
  const role = `${contact.Role} ${contact.JobTitle} ${contact.buyingRole ?? ""}`;
  if (kind === "economic") {
    return ECONOMIC_BUYING.includes(contact.buyingRole as BuyingRole) || ECONOMIC_ROLES.test(role);
  }
  if (kind === "technical") {
    return TECHNICAL_BUYING.includes(contact.buyingRole as BuyingRole) || TECHNICAL_ROLES.test(role);
  }
  if (kind === "financier") {
    return contact.buyingRole === "Economic Buyer" || FINANCE_ROLES.test(role);
  }
  return AUTHORITY_ROLES.test(role) || contact.Role === "Compliance Officer";
}

function rosterCovers(deal: PipelineRow, pattern: RegExp): boolean {
  return (deal.team ?? []).some((member) => pattern.test(member.projectRole));
}

function fieldKnown(deal: PipelineRow, fieldId: UnderstandingFieldId): boolean {
  return resolveUnderstandingField(deal, fieldId).source !== "empty";
}

function knowledgeKnown(
  deal: PipelineRow,
  fieldId: UnderstandingFieldId,
  companyFindings?: SourceFinding[],
): boolean {
  if (fieldKnown(deal, fieldId)) return true;
  return Boolean(confirmedFindingAnswerForField(companyFindings, fieldId));
}

export function buildGrowthSuperSkills(input: {
  companies: Company[];
  pipelines: PipelineRow[];
  events: GrowthEvent[];
  activities?: Activity[];
  growthDeals?: GrowthDealRecord[];
  correspondence?: GrowthCorrespondenceSnippet[];
  findingsByCompanyId?: Record<string, SourceFinding[]>;
  now?: Date;
}): GrowthSuperSkills {
  const now = input.now ?? new Date();
  const asOf = todayIso(now);
  const deals = (input.growthDeals?.length ? input.growthDeals : input.pipelines) as GrowthDealRecord[];
  const open = openSalesDeals(deals);
  const activities = input.activities ?? [];
  const correspondence = input.correspondence ?? [];
  const findingsByCompanyId = input.findingsByCompanyId ?? {};
  const watch = buildLiveCompetitorWatch(input.companies, findingsByCompanyId);
  const searchRows = competitorSearchRows(watch);

  const hearings = open.map((deal) => {
    const company = companyForDeal(input.companies, deal);
    const mentions: GrowthSuperSkills["hearings"][number]["mentions"] = [];
    if (company && companyHasType(company, "Competitor")) {
      return {
        dealId: deal.id,
        dealName: deal.assetName,
        companyName: company.Title,
        href: deal360Href(deal.id),
        mentions: [],
        unknown: true,
      };
    }

    for (const hit of findCompetitorMentions(dealText(deal), searchRows)) {
      mentions.push({
        competitorName: hit.name,
        quote: hit.quote,
        source: "deal_field",
        competitorId: hit.companyId,
        competitorHref: hit.href,
        knownFact: hit.knownFact,
      });
    }

    for (const activity of activitiesForDeal(activities, deal)) {
      for (const hit of findCompetitorMentions(activityText(activity), searchRows)) {
        mentions.push({
          competitorName: hit.name,
          quote: hit.quote,
          source: "activity",
          asOf: activity.ActivityDate.slice(0, 10),
          competitorId: hit.companyId,
          competitorHref: hit.href,
          knownFact: hit.knownFact,
        });
      }
    }

    for (const snippet of correspondence.filter((row) => row.opportunityId === deal.id)) {
      const haystack = `${snippet.subject} ${snippet.bodyPreview ?? ""}`.toLowerCase();
      for (const hit of findCompetitorMentions(haystack, searchRows)) {
        mentions.push({
          competitorName: hit.name,
          quote: hit.quote,
          source: "email",
          asOf: snippet.sentAt.slice(0, 10),
          competitorId: hit.companyId,
          competitorHref: hit.href,
          knownFact: hit.knownFact,
        });
      }
    }

    const unique = mentions.filter(
      (item, index) =>
        mentions.findIndex((other) => other.competitorName === item.competitorName) === index,
    );

    return {
      dealId: deal.id,
      dealName: deal.assetName,
      companyName: company?.Title ?? deal.ClientLookup ?? "Unlinked company",
      href: deal360Href(deal.id),
      mentions: unique,
      unknown: unique.length === 0,
    };
  });

  const realities = open.map((deal) => {
    const company = companyForDeal(input.companies, deal);
    const companyFindings = company ? findingsByCompanyId[company.CompanyID] : undefined;
    const blockers: GrowthSuperSkills["realities"][number]["blockers"] = [];
    if (!knowledgeKnown(deal, "funding_source", companyFindings) && !knowledgeKnown(deal, "budget", companyFindings)) {
      blockers.push("funding");
    }
    if (!knowledgeKnown(deal, "permitting", companyFindings)) blockers.push("permit");
    if (!knowledgeKnown(deal, "offtake_strategy", companyFindings)) blockers.push("offtake");
    if (!knowledgeKnown(deal, "site_readiness", companyFindings)) blockers.push("build");
    if (!knowledgeKnown(deal, "utilities", companyFindings)) blockers.push("operate");
    if (
      !fieldKnown(deal, "decision_maker") &&
      !fieldKnown(deal, "economic_buyer") &&
      !rosterCovers(deal, /decision maker|economic buyer/i)
    ) {
      blockers.push("decision_maker");
    }

    const capital = blockers.filter(
      (item) => item === "funding" || item === "permit" || item === "offtake" || item === "decision_maker",
    );
    const fatal =
      capital[0] === "funding"
        ? "Funding path not captured — a plant PO is not bankable yet."
        : capital[0] === "permit"
          ? "Permitting pathway not captured — approval risk is unknown."
          : capital[0] === "offtake"
            ? "Offtake path not captured — project economics are unproven."
            : capital[0] === "decision_maker"
              ? "No decision maker on the roster or understanding record."
              : null;

    const next =
      capital[0] === "funding" || capital[0] === "offtake" || capital[0] === "permit"
        ? "Propose a paid bankability / feasibility pack that answers this gap — do not lead with machinery."
        : capital[0] === "decision_maker"
          ? "Name the go/no-go owner from existing mail or meetings. Do not invent a contact."
          : "Confirm the next paid step on the deal.";

    const evidenceNote =
      blockers.length === 0
        ? "Funding, permitting and offtake are on the record — this can be treated as a real project, not a brochure cycle."
        : "Blockers are missing confirmed evidence — not a score. Fill from documents and meetings, or sell a paid study.";

    return {
      dealId: deal.id,
      dealName: deal.assetName,
      companyName: company?.Title ?? deal.ClientLookup ?? "Unlinked company",
      href: deal360Href(deal.id),
      blockers,
      fatal,
      next,
      evidenceNote,
      authorityLevel:
        capital[0] === "permit"
          ? ("project" as const)
          : capital[0] === "funding"
            ? ("national" as const)
            : ("project" as const),
    };
  });

  const stakeholders = open.map((deal) => {
    const company = companyForDeal(input.companies, deal);
    const contacts = company?.contacts ?? [];
    const have: string[] = [];
    const missing: GrowthSuperSkills["stakeholders"][number]["missing"] = [];

    if (
      contacts.some((contact) => contactCovers(contact, "economic")) ||
      rosterCovers(deal, ECONOMIC_ROLES) ||
      fieldKnown(deal, "decision_maker") ||
      fieldKnown(deal, "economic_buyer")
    ) {
      have.push("Economic buyer / decision");
    } else {
      missing.push("economic_buyer");
    }

    if (contacts.some((contact) => contactCovers(contact, "technical")) || rosterCovers(deal, TECHNICAL_ROLES)) {
      have.push("Technical specifier");
    } else {
      missing.push("technical");
    }

    if (contacts.some((contact) => contactCovers(contact, "financier")) || fieldKnown(deal, "funding_source")) {
      have.push("Financier / funding path");
    } else {
      missing.push("financier");
    }

    if (contacts.some((contact) => contactCovers(contact, "authority")) || fieldKnown(deal, "permitting")) {
      have.push("Permitting / authority");
    } else {
      missing.push("authority");
    }

    return {
      dealId: deal.id,
      dealName: deal.assetName,
      companyName: company?.Title ?? deal.ClientLookup ?? "Unlinked company",
      href: deal360Href(deal.id),
      have,
      missing,
    };
  });

  const offers = open.map((deal) => {
    const company = companyForDeal(input.companies, deal);
    const reality = realities.find((row) => row.dealId === deal.id);
    const coverage = stakeholders.find((row) => row.dealId === deal.id);
    let offer: GrowthOfferKind = "paid_feasibility";
    let why = "Default for capital pyrolysis: prove bankability before a machinery conversation.";

    if (company && !isOpportunityEligibleCompany(company)) {
      offer = "walk_away";
      why = `${company.Title} is not a sell-to relationship. Do not run a plant or study motion.`;
    } else if (coverage?.missing.includes("economic_buyer")) {
      offer = "walk_away";
      why = "No economic buyer identified. Finding that person beats any campaign or brochure.";
    } else if (reality?.blockers.some((item) => item === "funding" || item === "permit" || item === "offtake")) {
      offer = "paid_feasibility";
      why = "Funding, permitting or offtake is unknown. A paid study is the honest next product.";
    } else if (deal.status === "Contract Negotiation") {
      offer = "machinery";
      why = "Deal is in negotiation and capital gaps are not blank — a machinery conversation is justified.";
    } else if (deal.status === "Feedstock Analysis") {
      offer = "engineering";
      why = "Feedstock / discovery stage — sell engineering or qualification work, not a turnkey pitch.";
    }

    return {
      dealId: deal.id,
      dealName: deal.assetName,
      companyName: company?.Title ?? deal.ClientLookup ?? "Unlinked company",
      href: deal360Href(deal.id),
      offer,
      why,
    };
  });

  const offerByCompanyId = new Map<string, GrowthOfferKind>();
  for (const choice of offers) {
    const deal = open.find((row) => row.id === choice.dealId);
    if (!deal) continue;
    const company = companyForDeal(input.companies, deal);
    if (company && !offerByCompanyId.has(company.CompanyID)) {
      offerByCompanyId.set(company.CompanyID, choice.offer);
    }
  }

  const winLoss: GrowthWinLossMemory[] = deals
    .filter(
      (deal) =>
        deal.registryStatus === "closed_won" ||
        deal.registryStatus === "closed_lost" ||
        deal.status === "Won",
    )
    .map((deal) => {
      const outcome: "won" | "lost" = deal.registryStatus === "closed_lost" ? "lost" : "won";
      const captured =
        deal.description?.trim() ||
        resolveUnderstandingField(deal, "funding_source").value ||
        (deal.currentMilestone && !["prospecting", "Prospecting"].includes(deal.currentMilestone)
          ? deal.currentMilestone
          : "");
      return {
        id: deal.id,
        dealName: deal.assetName,
        companyName: companyForDeal(input.companies, deal)?.Title ?? deal.ClientLookup ?? "Unlinked company",
        outcome,
        lesson: captured
          ? clip(captured, 200)
          : "Outcome is in the registry — the reason was not captured (unknown).",
        source: "SmartCRM opportunity registry",
        asOf: (deal.updatedAt ?? asOf).slice(0, 10),
        href: deal360Href(deal.id),
      };
    });

  const marketIntel: GrowthMarketIntelCard[] = [];

  const byCountry = new Map<string, GrowthDealRecord[]>();
  for (const deal of open) {
    const company = companyForDeal(input.companies, deal);
    const geo = company?.Country?.Title?.trim() || company?.continent || "Geography not captured";
    const list = byCountry.get(geo) ?? [];
    list.push(deal);
    byCountry.set(geo, list);
  }
  for (const [geography, list] of [...byCountry.entries()].slice(0, 3)) {
    marketIntel.push({
      id: `mi-demand-${geography}`,
      category: "demand",
      title: `${list.length} open sales opportunit${list.length === 1 ? "y" : "ies"} in ${geography}`,
      fact: list.map((deal) => deal.assetName).join("; "),
      geography,
      asOf,
      sourceLabel: "SmartCRM live opportunity registry",
      evidence: "observed",
      offerImplication: "paid_feasibility",
      offerWhy: "Demand is observed as named deals — not as a market slogan. Qualify bankability per project.",
      relatedDeals: list.slice(0, 4).map((deal) => ({
        id: deal.id,
        name: deal.assetName,
        href: deal360Href(deal.id),
      })),
      nextAction: "Work the named deals this week. Do not buy awareness until these move.",
      nextHref: list[0] ? deal360Href(list[0].id) : "/growth",
      authorityLevel: geography === "Geography not captured" ? "project" : "national",
    });
  }

  const bankability = realities.filter((row) =>
    row.blockers.some((item) => item === "funding" || item === "offtake" || item === "permit"),
  );
  if (bankability.length > 0) {
    marketIntel.push({
      id: "mi-bankability",
      category: "funding",
      title: `${bankability.length} live deal${bankability.length === 1 ? "" : "s"} missing funding, offtake or permitting`,
      fact: bankability.map((row) => `${row.dealName}: ${row.blockers.join(", ")}`).join("; "),
      geography: "Project-level",
      asOf,
      sourceLabel: "Confirmed understanding and company findings — empty stays unknown",
      evidence: "observed",
      offerImplication: "paid_feasibility",
      offerWhy:
        "Investors and authorities will not sign a machinery PO on blanks. Paid bankability is the product.",
      relatedDeals: bankability.slice(0, 4).map((row) => ({
        id: row.dealId,
        name: row.dealName,
        href: row.href,
      })),
      nextAction: "Open the highest-value deal and capture funding, offtake and permitting — or sell a paid study.",
      nextHref: bankability[0].href,
      authorityLevel: "project",
    });
  }

  const heard = hearings.filter((row) => !row.unknown);
  if (heard.length > 0) {
    marketIntel.push({
      id: "mi-hearing",
      category: "competitor_activity",
      title: `Competitor named on ${heard.length} live deal${heard.length === 1 ? "" : "s"}`,
      fact: heard
        .map((row) => `${row.dealName}: ${row.mentions.map((item) => item.competitorName).join(", ")}`)
        .join("; "),
      geography: "Deal-room",
      asOf,
      sourceLabel: "Mail, activities and opportunity fields",
      evidence: "observed",
      offerImplication: "engineering",
      offerWhy: "Internal knowledge: they already appear on this deal. Confirm what we know about them on the competitor record.",
      relatedDeals: heard.slice(0, 4).map((row) => ({
        id: row.dealId,
        name: row.dealName,
        href: row.href,
      })),
      nextAction: "Open internal competitor knowledge on that deal. This is not a customer brief.",
      nextHref: heard[0].href,
      authorityLevel: "project",
    });
  } else if (open.length > 0) {
    marketIntel.push({
      id: "mi-hearing-unknown",
      category: "unknown",
      title: "No competitor is evidenced on live deals",
      fact: "Searched live competitor companies plus PYREG / ETIA / Carbofex aliases in opportunity fields, activities and mail. No named rival on a live deal.",
      geography: "Deal-room",
      asOf,
      sourceLabel: "SmartCRM search of live records",
      evidence: "observed",
      offerImplication: "watch",
      offerWhy: "Unknown stays unknown. Do not brief the team as if a rival is in the room.",
      relatedDeals: open.slice(0, 3).map((deal) => ({
        id: deal.id,
        name: deal.assetName,
        href: deal360Href(deal.id),
      })),
      nextAction: "Record who else they are evaluating on the deal — internal knowledge only.",
      nextHref: open[0] ? deal360Href(open[0].id) : "/growth",
      authorityLevel: "project",
    });
  }

  if (winLoss.length > 0) {
    const latest = winLoss[0];
    marketIntel.push({
      id: "mi-winloss",
      category: "pipeline",
      title: `Closed-loop memory: ${latest.dealName} ${latest.outcome}`,
      fact: latest.lesson,
      geography: latest.companyName,
      asOf: latest.asOf,
      sourceLabel: latest.source,
      evidence: latest.lesson.includes("not captured") ? "unverified" : "observed",
      offerImplication: latest.outcome === "lost" ? "paid_feasibility" : "machinery",
      offerWhy: "Next campaign should reuse what this outcome actually taught — not last year’s brochure.",
      relatedDeals: [{ id: latest.id, name: latest.dealName, href: latest.href }],
      nextAction: latest.lesson.includes("not captured")
        ? "Write the real win/loss reason on the opportunity before planning the next event."
        : "Apply this lesson to the next similar live deal.",
      nextHref: latest.href,
      authorityLevel: "project",
    });
  }

  const unclassified = input.companies.filter(
    (company) => getCompanyRelationshipPosture(company) === "unclassified",
  ).length;
  if (unclassified > 0) {
    marketIntel.push({
      id: "mi-posture",
      category: "demand",
      title: `${unclassified} companies have no relationship posture`,
      fact: "Market size in the CRM is not knowable until companies are classified.",
      geography: "Registry",
      asOf,
      sourceLabel: "Company types in SmartCRM",
      evidence: "observed",
      offerImplication: "watch",
      offerWhy: "Do not treat unclassified nodes as pyrolysis demand.",
      relatedDeals: [],
      nextAction: "Classify before any sell-to campaign or whitespace.",
      nextHref: "/companies",
      authorityLevel: "national",
    });
  }

  const meetingMachine: GrowthMeetingTarget[] = [];
  const upcoming = input.events.filter(
    (event) => isEventUpcoming(event, now) && event.recommendation === "attend",
  );
  for (const event of upcoming) {
    const sellTo = input.companies
      .filter((company) => isOpportunityEligibleCompany(company))
      .filter((company) => offerByCompanyId.get(company.CompanyID) !== "walk_away")
      .slice(0, 5);
    for (const company of sellTo) {
      const offer = offerByCompanyId.get(company.CompanyID) ?? "paid_feasibility";
      const contacts = (company.contacts ?? []).filter(
        (contact) =>
          contactCovers(contact, "economic") ||
          contactCovers(contact, "technical") ||
          contactCovers(contact, "financier"),
      );
      const primary = contacts[0] ?? company.contacts?.[0] ?? null;
      const companyDeals = open.filter(
        (deal) => companyForDeal(input.companies, deal)?.CompanyID === company.CompanyID,
      );
      meetingMachine.push({
        eventId: event.id,
        eventName: event.name,
        companyName: company.Title,
        companyHref: company360Href(company.CompanyID),
        contactName: primary?.Title ?? null,
        contactRole: primary ? `${primary.Role}${primary.buyingRole ? ` · ${primary.buyingRole}` : ""}` : null,
        contactEmail: primary?.Email?.trim() || null,
        offer,
        agenda:
          offer === "paid_feasibility"
            ? "20 min: bankability gaps (funding, offtake, permits) and a paid study scope — not a plant brochure."
            : offer === "machinery"
              ? "20 min: commissioning quality, delivery, and next decision date."
              : offer === "engineering"
                ? "20 min: feedstock / engineering pack and what would justify a paid assessment."
                : "Do not book a sales meeting — posture is not sell-to.",
        href: `/growth/events/${encodeURIComponent(event.id)}`,
        dealName: companyDeals[0]?.assetName,
      });
    }
  }

  const whatChanged = buildWhatChanged({
    asOf,
    now,
    watch,
    open,
    activities,
    correspondence,
    companies: input.companies,
    findingsByCompanyId,
  });
  const meetingKnowledge = buildMeetingKnowledgeGaps({
    now,
    activities,
    companies: input.companies,
    deals: open,
  });
  const ecosystemMatches = buildEcosystemMatches({
    companies: input.companies,
    open,
    realities,
  });

  return {
    hearings,
    realities,
    stakeholders,
    offers,
    winLoss,
    marketIntel: marketIntel.slice(0, 7),
    meetingMachine,
    whatChanged,
    meetingKnowledge,
    ecosystemMatches,
  };
}

function daysAgo(iso: string | undefined, now: Date): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.floor((now.getTime() - ms) / (1000 * 60 * 60 * 24));
}

function latestFindingAt(findings: SourceFinding[] | undefined): string | null {
  let latest: string | null = null;
  for (const finding of findings ?? []) {
    if (!finding.addedAt) continue;
    if (!latest || finding.addedAt > latest) latest = finding.addedAt;
  }
  return latest;
}

function buildWhatChanged(input: {
  asOf: string;
  now: Date;
  watch: LiveCompetitorWatch[];
  open: GrowthDealRecord[];
  activities: Activity[];
  correspondence: GrowthCorrespondenceSnippet[];
  companies: Company[];
  findingsByCompanyId: Record<string, SourceFinding[]>;
}): GrowthChangeSignal[] {
  const signals: GrowthChangeSignal[] = [];

  for (const activity of input.activities) {
    const meeting =
      activity.ActivityType === "Meeting" ||
      activity.ActivityType === "Teams Meeting" ||
      activity.ActivityType === "Site Visit";
    if (!meeting) continue;
    const age = daysAgo(activity.ActivityDate, input.now);
    if (age == null || age > 14) continue;
    const companyName = activity.Company?.Title?.trim() || "Unlinked company";
    signals.push({
      id: `chg-meet-${activity.ActivityID}`,
      title: `Meeting: ${activity.Subject}`,
      why: `${companyName} · ${activity.ActivityDate.slice(0, 10)}`,
      next: "Turn this meeting into knowledge — facts, decisions, commitments, unknowns.",
      impact: "A meeting that does not change a record did not happen for SmartCRM.",
      href: `/activities/${encodeURIComponent(activity.ActivityID)}`,
      asOf: activity.ActivityDate.slice(0, 10),
      kind: "meeting",
    });
  }

  for (const snippet of input.correspondence.slice(0, 8)) {
    const age = daysAgo(snippet.sentAt, input.now);
    if (age == null || age > 14) continue;
    const deal = input.open.find((row) => row.id === snippet.opportunityId);
    if (!deal) continue;
    signals.push({
      id: `chg-mail-${deal.id}-${snippet.sentAt}`,
      title: `New mail on ${deal.assetName}`,
      why: snippet.subject.trim() || "Opportunity mail in the last two weeks.",
      next: "Confirm any new fact, decision or commitment onto the deal.",
      impact: "Mail that is not turned into knowledge is lost.",
      href: deal360Href(deal.id),
      asOf: snippet.sentAt.slice(0, 10),
      kind: "mail",
    });
  }

  for (const rival of input.watch) {
    const added = latestFindingAt(input.findingsByCompanyId[rival.companyId]);
    const age = daysAgo(added ?? undefined, input.now);
    if (rival.confirmedFacts.length === 0) {
      signals.push({
        id: `chg-know-${rival.companyId}`,
        title: `We classified ${rival.companyName} as a competitor but have no confirmed knowledge`,
        why: "A rival record without offer, feedstock or overlap does not increase understanding.",
        next: "Collect competitor knowledge — internal only.",
        impact: "Growth cannot use a classified rival until someone confirms a fact.",
        href: rival.href,
        asOf: input.asOf,
        kind: "competitor",
      });
      continue;
    }
    if (age != null && age <= 14) {
      signals.push({
        id: `chg-fact-${rival.companyId}`,
        title: `Competitor knowledge updated: ${rival.companyName}`,
        why: rival.confirmedFacts[0] ?? "",
        next: "Keep this current. Internal only.",
        impact: "Confirmed rival facts now feed hearings on live deals.",
        href: rival.href,
        asOf: (added ?? input.asOf).slice(0, 10),
        kind: "competitor",
      });
    }
  }

  const unique: GrowthChangeSignal[] = [];
  const seen = new Set<string>();
  for (const row of signals) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    unique.push(row);
    if (unique.length >= 5) break;
  }
  return unique;
}

function meetingHasCapturedKnowledge(activity: Activity): boolean {
  const decisions = (activity.KeyDecisions ?? []).some((row) => row.trim());
  const actions = (activity.AgreedActions ?? []).some((row) => row.text.trim());
  const summary = Boolean(activity.Summary?.trim());
  return decisions || actions || summary;
}

function buildMeetingKnowledgeGaps(input: {
  now: Date;
  activities: Activity[];
  companies: Company[];
  deals: GrowthDealRecord[];
}): GrowthMeetingKnowledgeGap[] {
  const gaps: GrowthMeetingKnowledgeGap[] = [];
  for (const activity of input.activities) {
    const meeting =
      activity.ActivityType === "Meeting" ||
      activity.ActivityType === "Teams Meeting" ||
      activity.ActivityType === "Site Visit";
    if (!meeting) continue;
    const age = daysAgo(activity.ActivityDate, input.now);
    if (age == null || age > 21) continue;
    if (meetingHasCapturedKnowledge(activity)) continue;
    const deal =
      input.deals.find((row) => row.id === activity.Deal?.Title) ||
      input.deals.find((row) => activity.Deal?.Title && row.assetName === activity.Deal.Title) ||
      null;
    const companyName =
      activity.Company?.Title?.trim() || deal?.ClientLookup || "Unlinked company";
    gaps.push({
      activityId: activity.ActivityID,
      subject: activity.Subject,
      when: activity.ActivityDate.slice(0, 10),
      companyName,
      dealName: deal?.assetName ?? activity.Deal?.Title ?? null,
      href: `/activities/${encodeURIComponent(activity.ActivityID)}`,
      why: activity.ActivityDescription?.trim()
        ? "There is a note, but no confirmed decisions, commitments or summary."
        : "The meeting is logged with nothing we can reuse as knowledge.",
    });
    if (gaps.length >= 3) break;
  }
  return gaps;
}

function buildEcosystemMatches(input: {
  companies: Company[];
  open: GrowthDealRecord[];
  realities: GrowthSuperSkills["realities"];
}): GrowthEcosystemMatch[] {
  const offtakers = input.companies.filter((company) => companyHasType(company, "Offtaker"));
  const investors = input.companies.filter((company) => companyHasType(company, "Investor"));
  const matches: GrowthEcosystemMatch[] = [];

  for (const reality of input.realities) {
    const deal = input.open.find((row) => row.id === reality.dealId);
    if (!deal) continue;
    const account = companyForDeal(input.companies, deal);
    const country = account?.Country?.Title?.trim().toLowerCase();

    const gap: "offtake" | "funding" | null = reality.blockers.includes("offtake")
      ? "offtake"
      : reality.blockers.includes("funding")
        ? "funding"
        : null;
    if (!gap) continue;

    const pool = gap === "offtake" ? offtakers : investors;
    const ranked = [...pool]
      .filter((company) => company.CompanyID !== account?.CompanyID)
      .sort((a, b) => {
        const aSame = country && a.Country?.Title?.trim().toLowerCase() === country ? 0 : 1;
        const bSame = country && b.Country?.Title?.trim().toLowerCase() === country ? 0 : 1;
        return aSame - bSame;
      })
      .slice(0, 3);

    if (ranked.length === 0) continue;

    matches.push({
      dealId: reality.dealId,
      dealName: reality.dealName,
      companyName: reality.companyName,
      href: reality.href,
      gap,
      candidates: ranked.map((company) => ({
        companyId: company.CompanyID,
        companyName: company.Title,
        href: company360Href(company.CompanyID),
        role: gap === "offtake" ? "Offtaker" : "Investor",
        why:
          country && company.Country?.Title?.trim().toLowerCase() === country
            ? `Already in our registry as ${gap === "offtake" ? "Offtaker" : "Investor"} in ${company.Country?.Title}. Introduce only if you choose — do not invent a company.`
            : `Already classified ${gap === "offtake" ? "Offtaker" : "Investor"} in SmartCRM. You decide whether an introduction is right.`,
      })),
    });
    if (matches.length >= 3) break;
  }
  return matches;
}

export { offerLabel } from "@/types/growth-super-skills";
