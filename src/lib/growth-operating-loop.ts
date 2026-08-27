import {
  getCompanyRelationshipPosture,
  isCompanyUnclassified,
  isOpportunityEligibleCompany,
} from "@/lib/company-classification";
import { isEventPast, isEventUpcoming } from "@/lib/growth-event-timing";
import { getLifecycleStage } from "@/types/pipeline";
import { company360Href } from "@/types/company-360";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type {
  GrowthEvent,
  GrowthOperatingAction,
  GrowthOperatingLoop,
} from "@/types/growth-intelligence";
import { offerLabel, type GrowthSuperSkills } from "@/types/growth-super-skills";

const OPEN_SALES_STATUSES = new Set([
  "Prospecting",
  "Feedstock Analysis",
  "Contract Negotiation",
]);

export function companyForDeal(
  companies: Company[],
  deal: PipelineRow,
): Company | undefined {
  const byPipeline = companies.find((company) =>
    company.pipelineIds.includes(deal.id),
  );
  if (byPipeline) return byPipeline;
  const lookup = deal.ClientLookup?.trim().toLowerCase();
  if (!lookup) return undefined;
  return companies.find((company) => company.Title.trim().toLowerCase() === lookup);
}

export function openSalesDeals(pipelines: PipelineRow[]): PipelineRow[] {
  return pipelines.filter(
    (deal) =>
      OPEN_SALES_STATUSES.has(deal.status) ||
      (getLifecycleStage(deal.status) === "sales" && deal.status !== "Won"),
  );
}

function dealHref(deal: PipelineRow): string {
  return `/deals/${encodeURIComponent(deal.id)}`;
}

function nextStepLooksEmpty(deal: PipelineRow): boolean {
  const step = deal.currentMilestone?.trim() ?? "";
  if (!step) return true;
  return OPEN_SALES_STATUSES.has(step) || step === deal.status;
}

function pushUnique(
  actions: GrowthOperatingAction[],
  action: GrowthOperatingAction,
  limit: number,
) {
  if (actions.length >= limit) return;
  if (actions.some((existing) => existing.id === action.id)) return;
  actions.push(action);
}

function applySuperSkillsToLoop(
  thisWeek: GrowthOperatingAction[],
  thisQuarter: GrowthOperatingAction[],
  watch: GrowthOperatingAction[],
  skills: GrowthSuperSkills,
) {
  for (const reality of skills.realities) {
    if (!reality.fatal) continue;
    pushUnique(
      thisWeek,
      {
        id: `reality-${reality.dealId}`,
        horizon: "this_week",
        title: `Project reality: ${reality.dealName}`,
        why: reality.fatal,
        next: reality.next,
        impact: "A plant that cannot be funded, permitted or offtaken is not a machinery campaign.",
        href: reality.href,
        evidence: "observed",
        companyName: reality.companyName,
        dealName: reality.dealName,
      },
      3,
    );
  }

  for (const coverage of skills.stakeholders) {
    if (!coverage.missing.includes("economic_buyer")) continue;
    pushUnique(
      thisWeek,
      {
        id: `buyer-${coverage.dealId}`,
        horizon: "this_week",
        title: `Name the economic buyer on ${coverage.dealName}`,
        why: "Capital coverage is incomplete — no economic buyer on the roster or understanding record.",
        next: "Find that person in existing mail or meetings. Do not invent a contact.",
        impact: "Without a named funder, every brochure and event meeting is theatre.",
        href: coverage.href,
        evidence: "unknown",
        companyName: coverage.companyName,
        dealName: coverage.dealName,
      },
      3,
    );
  }

  for (const hearing of skills.hearings) {
    if (hearing.unknown) continue;
    const names = hearing.mentions.map((item) => item.competitorName).join(", ");
    pushUnique(
      thisWeek,
      {
        id: `hearing-${hearing.dealId}`,
        horizon: "this_week",
        title: `${names} named on ${hearing.dealName}`,
        why: hearing.mentions[0]?.quote || "Competitor mentioned in live records.",
        next: "Prepare the counter on that deal — bankability and commissioning — with the quote in hand.",
        impact: "Deal-room hearing beats a generic competitor essay.",
        href: hearing.href,
        evidence: "observed",
        companyName: hearing.companyName,
        dealName: hearing.dealName,
      },
      3,
    );
  }

  for (const choice of skills.offers) {
    if (choice.offer === "walk_away") {
      pushUnique(
        watch,
        {
          id: `offer-${choice.dealId}`,
          horizon: "watch",
          title: `Do not sell on ${choice.dealName}`,
          why: choice.why,
          next: "Classify, name the buyer, or leave the record. No campaign.",
          impact: "Restraint is a growth skill — pitching the wrong relationship wastes the quarter.",
          href: choice.href,
          evidence: "observed",
          companyName: choice.companyName,
          dealName: choice.dealName,
        },
        4,
      );
      continue;
    }
    if (choice.offer !== "paid_feasibility") continue;
    pushUnique(
      thisWeek,
      {
        id: `offer-${choice.dealId}`,
        horizon: "this_week",
        title: `Offer a paid study on ${choice.dealName}`,
        why: choice.why,
        next: offerLabel(choice.offer),
        impact: "Paid feasibility is the product until the plant is bankable.",
        href: choice.href,
        evidence: "observed",
        companyName: choice.companyName,
        dealName: choice.dealName,
      },
      3,
    );
  }

  const byEvent = new Map<string, typeof skills.meetingMachine>();
  for (const target of skills.meetingMachine) {
    const list = byEvent.get(target.eventId) ?? [];
    list.push(target);
    byEvent.set(target.eventId, list);
  }
  for (const targets of byEvent.values()) {
    const eventName = targets[0]?.eventName ?? "upcoming event";
    const named = targets.filter((target) => target.contactName);
    const names = named
      .slice(0, 3)
      .map((target) => `${target.contactName} (${target.companyName})`);
    pushUnique(
      thisQuarter,
      {
        id: `meetings-${targets[0].eventId}`,
        horizon: "this_quarter",
        title: `Book named meetings for ${eventName}`,
        why:
          names.length > 0
            ? `People on file: ${names.join("; ")}.`
            : "Sell-to companies exist, but no named contact yet — do not invent attendees.",
        next:
          names.length > 0
            ? "Open planning. Agenda is the offer chooser (usually a paid study), then Outlook."
            : "Name the economic buyer on the company record before requesting a meeting.",
        impact: "A named person plus a paid-study agenda beats a booth.",
        href: targets[0].href,
        evidence: names.length > 0 ? "observed" : "unknown",
      },
      4,
    );
  }

  for (const memory of skills.winLoss) {
    pushUnique(
      watch,
      {
        id: `winloss-${memory.id}`,
        horizon: "watch",
        title: `${memory.dealName} ${memory.outcome}`,
        why: memory.lesson,
        next: memory.lesson.includes("not captured")
          ? "Write the real reason on the opportunity before the next campaign."
          : "Reuse this lesson on the next similar live deal.",
        impact: "Win/loss memory stops repeating last year’s brochure.",
        href: memory.href,
        evidence: memory.lesson.includes("not captured") ? "unknown" : "observed",
        companyName: memory.companyName,
        dealName: memory.dealName,
      },
      4,
    );
  }
}

export function buildGrowthOperatingLoop(
  companies: Company[],
  pipelines: PipelineRow[],
  events: GrowthEvent[],
  now: Date = new Date(),
  skills?: GrowthSuperSkills,
): GrowthOperatingLoop {
  const thisWeek: GrowthOperatingAction[] = [];
  const thisQuarter: GrowthOperatingAction[] = [];
  const watch: GrowthOperatingAction[] = [];
  const unknowns: string[] = [];

  if (skills) {
    applySuperSkillsToLoop(thisWeek, thisQuarter, watch, skills);
  }

  const deals = openSalesDeals(pipelines);
  const unclassified = companies.filter((company) => isCompanyUnclassified(company));
  const sellTo = companies.filter((company) => isOpportunityEligibleCompany(company));
  const competitors = companies.filter(
    (company) => getCompanyRelationshipPosture(company) === "watch",
  );
  const upcomingEvents = events.filter(
    (event) => isEventUpcoming(event, now) && event.recommendation === "attend",
  );
  const pastEvents = events.filter((event) => isEventPast(event, now));

  for (const deal of deals) {
    const company = companyForDeal(companies, deal);
    const companyName = company?.Title ?? deal.ClientLookup?.trim();
    if (!companyName) {
      unknowns.push(`Opportunity “${deal.assetName}” is not linked to a company.`);
      continue;
    }

    if (company && isCompanyUnclassified(company)) {
      pushUnique(
        thisWeek,
        {
          id: `classify-${company.CompanyID}`,
          horizon: "this_week",
          title: `Classify ${companyName} before treating this as a sale`,
          why: `${deal.assetName} is open, but this company has no relationship posture.`,
          next: "Set Customer, Prospect, Offtaker — or supplier / partner — on the company record.",
          impact:
            "Prevents pitching a pyrolysis plant to a buy-from or unclassified relationship.",
          href: company360Href(company.CompanyID),
          evidence: "observed",
          companyName,
          dealName: deal.assetName,
        },
        3,
      );
      continue;
    }

    if (company && !isOpportunityEligibleCompany(company)) {
      pushUnique(
        watch,
        {
          id: `posture-${company.CompanyID}`,
          horizon: "watch",
          title: `${companyName} is not a commercial target`,
          why: `${deal.assetName} sits on a ${getCompanyRelationshipPosture(company).replaceAll("_", " ")} relationship.`,
          next: "Keep the record. Do not run sales whitespace or Create Opportunity on this company.",
          impact: "Protects relationship posture — company is not automatically a client.",
          href: company360Href(company.CompanyID),
          evidence: "observed",
          companyName,
          dealName: deal.assetName,
        },
        4,
      );
      continue;
    }

    const contactCount = company?.contacts?.length ?? 0;
    if (company && contactCount === 0) {
      pushUnique(
        thisWeek,
        {
          id: `stakeholder-${company.CompanyID}`,
          horizon: "this_week",
          title: `Name a stakeholder at ${companyName}`,
          why: `${deal.assetName} is open with nobody on the roster.`,
          next: "Add the economic buyer or technical owner from existing mail and meetings — do not invent a contact.",
          impact:
            "A capital plant does not move without a named person who can fund, permit, or specify.",
          href: company360Href(company.CompanyID),
          evidence: "observed",
          companyName,
          dealName: deal.assetName,
        },
        3,
      );
    }

    if (nextStepLooksEmpty(deal)) {
      pushUnique(
        thisWeek,
        {
          id: `next-${deal.id}`,
          horizon: "this_week",
          title: `Confirm the next paid step on ${deal.assetName}`,
          why: `${companyName} has an open opportunity with no commercial next step beyond the stage name.`,
          next: "Propose a paid feasibility / bankability pack, or schedule the decision meeting — then write that next step on the deal.",
          impact:
            "Unowned next steps are how 12–36 month machinery cycles stall into free scoping.",
          href: dealHref(deal),
          evidence: "observed",
          companyName,
          dealName: deal.assetName,
        },
        3,
      );
    } else {
      pushUnique(
        thisWeek,
        {
          id: `progress-${deal.id}`,
          horizon: "this_week",
          title: `Advance ${deal.assetName}`,
          why: `Next step on file: ${deal.currentMilestone}.`,
          next: deal.currentMilestone,
          impact: "Keeps a live machinery or services opportunity moving this week.",
          href: dealHref(deal),
          evidence: "observed",
          companyName,
          dealName: deal.assetName,
        },
        3,
      );
    }
  }

  if (thisWeek.length === 0 && unclassified.length > 0) {
    const sample = unclassified.slice(0, 3).map((company) => company.Title);
    pushUnique(
      thisWeek,
      {
        id: "classify-queue",
        horizon: "this_week",
        title: `Classify ${unclassified.length} relationship${unclassified.length === 1 ? "" : "s"}`,
        why: `${sample.join(", ")}${unclassified.length > 3 ? "…" : ""} have no posture. Growth cannot recommend sell-to actions yet.`,
        next: "Open each company and set the relationship type. Unknown stays unclassified.",
        impact: "Stops the assistant from inventing customers and opportunities.",
        href: "/companies",
        evidence: "observed",
      },
      3,
    );
  }

  if (deals.length === 0) {
    unknowns.push("No open sales opportunities in the live registry.");
  }

  for (const event of upcomingEvents) {
    if (skills?.meetingMachine.some((target) => target.eventId === event.id)) {
      continue;
    }
    const targets = sellTo
      .filter((company) => company.pipelineIds.length > 0)
      .concat(sellTo.filter((company) => company.pipelineIds.length === 0))
      .slice(0, 5);
    const names = targets.map((company) => company.Title);
    pushUnique(
      thisQuarter,
      {
        id: `event-${event.id}`,
        horizon: "this_quarter",
        title: `Book meetings for ${event.name}`,
        why:
          names.length > 0
            ? `Live commercial targets: ${names.join(", ")}.`
            : "No sell-to companies classified yet — classify before inventing a meeting list.",
        next:
          names.length > 0
            ? "Open the planning workspace and request meetings with named accounts only."
            : "Classify Customer / Prospect / Offtaker companies first.",
        impact: `${event.location} · ${event.dateLabel}. Meeting-led presence beats a booth.`,
        href: `/growth/events/${encodeURIComponent(event.id)}`,
        evidence: names.length > 0 ? "observed" : "unknown",
      },
      4,
    );
  }

  if (unclassified.length > 0) {
    pushUnique(
      thisQuarter,
      {
        id: "posture-quarter",
        horizon: "this_quarter",
        title: `${unclassified.length} companies still unclassified`,
        why: "Whitespace, events, and Create Opportunity stay gated until posture is known.",
        next: "Work the classify queue from Companies — do not default anyone to Customer.",
        impact: "Relationship posture before pipeline.",
        href: "/companies",
        evidence: "observed",
      },
      4,
    );
  }

  const sellToWithoutDeals = sellTo.filter((company) => company.pipelineIds.length === 0);
  if (sellToWithoutDeals.length > 0) {
    const sample = sellToWithoutDeals.slice(0, 3).map((company) => company.Title);
    pushUnique(
      thisQuarter,
      {
        id: "sell-to-no-deal",
        horizon: "this_quarter",
        title: `${sellToWithoutDeals.length} commercial target${sellToWithoutDeals.length === 1 ? " has" : "s have"} no open opportunity`,
        why: `${sample.join(", ")}${sellToWithoutDeals.length > 3 ? "…" : ""}.`,
        next: "Decide whether a paid study or machinery conversation is justified — do not auto-create deals.",
        impact: "Sell-to without a deal is healthy only until you choose the next commercial move.",
        href: company360Href(sellToWithoutDeals[0].CompanyID),
        evidence: "observed",
        companyName: sellToWithoutDeals[0].Title,
      },
      4,
    );
  }

  if (competitors.length === 0) {
    pushUnique(
      watch,
      {
        id: "no-competitors",
        horizon: "watch",
        title: "No competitor is classified in the live registry",
        why: "PYREG, ETIA and others exist only as strategy notes — not as companies you can open.",
        next: "If they are real competitors, create the company and classify it as Competitor. Do not treat essays as tracking.",
        impact: "Stops fake ‘3 competitors tracked’ from driving budget.",
        href: "/growth/competitors",
        evidence: "unknown",
      },
      4,
    );
  } else {
    for (const competitor of competitors.slice(0, 3)) {
      pushUnique(
        watch,
        {
          id: `competitor-${competitor.CompanyID}`,
          horizon: "watch",
          title: `Watch ${competitor.Title}`,
          why: "Classified as Competitor in the live registry.",
          next: "Attach evidence from live deals and events — not generic market copy.",
          impact: "Competitor intelligence only counts when it overlaps our pipeline.",
          href: `/growth/competitors/${encodeURIComponent(competitor.CompanyID)}`,
          evidence: "observed",
          companyName: competitor.Title,
        },
        4,
      );
    }
  }

  for (const event of pastEvents) {
    pushUnique(
      watch,
      {
        id: `past-${event.id}`,
        horizon: "watch",
        title: `${event.name} has passed`,
        why: `${event.dateLabel} is over. “Needs planning” is no longer a next action.`,
        next: "Capture who we met — or archive the event. Do not keep a meeting-suite task for a finished show.",
        impact: "Stale event cards destroy trust in the operating loop.",
        href: `/growth/events/${encodeURIComponent(event.id)}`,
        evidence: "observed",
      },
      4,
    );
  }

  if (thisWeek.length === 0 && thisQuarter.length === 0) {
    unknowns.push("No live sell-to companies or open sales deals to operate on.");
  }

  return { thisWeek, thisQuarter, watch, unknowns };
}
