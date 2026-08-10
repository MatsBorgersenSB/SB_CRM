import {
  filterActivitiesToLiveEntities,
  getActivitiesForCompany,
  getActivitiesForContact,
  getActivitiesForDeal,
  isFollowUpOpen,
  isFollowUpOverdue,
  resolveActivityCompany,
} from "@/lib/activity-utils";
import type { NextBestAction } from "@/lib/next-best-action-engine";
import { computeOpportunityIntelligence } from "@/lib/opportunity-intelligence-engine";
import { computeRelationshipHealth } from "@/lib/relationship-health-engine";
import { daysBetween, formatLastContact } from "@/lib/relative-time";
import type { Activity } from "@/types/activity";
import type {
  AttentionItem,
  AttentionObjectType,
  AttentionQueue,
  AttentionSeverity,
} from "@/types/attention-item";
import {
  groupAttentionBySeverity,
  sortAttentionItems,
  SEVERITY_RANK,
} from "@/types/attention-item";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import { getContactDisplayName } from "@/types/contact";
import type { PipelineRow } from "@/types/pipeline";
import { company360Href } from "@/types/company-360";
import {
  commercialPackageHref,
  contact360Href,
  deal360Href,
} from "@/types/relationship-navigation";
import { documentSet360Href } from "@/types/document-set";

const STALLED_DAYS = 21;
const COLD_CONTACT_DAYS = 45;
const RISK_HEALTH_THRESHOLD = 50;

export type AttentionEngineContext = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  commercialPackages: CommercialPackage[];
  /** Scope to a single company when building company hub attention. */
  companyId?: string;
  ownerId?: string;
};

function parseActivityDate(value: string): Date {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  return new Date(normalized);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isDueToday(activity: Activity): boolean {
  if (!activity.NextActionDate) return false;
  return (
    startOfDay(new Date(activity.NextActionDate)).getTime() ===
    startOfDay(new Date()).getTime()
  );
}

function findCompanyForDeal(dealId: string, companies: Company[]): Company | undefined {
  return companies.find((c) => c.pipelineIds.includes(dealId));
}

function primaryContact(company: Company) {
  return company.contacts[0];
}

function pushItem(
  items: AttentionItem[],
  item: Omit<AttentionItem, "status"> & { status?: AttentionItem["status"] },
) {
  items.push({ status: "open", ...item });
}

function nbaToAttention(
  nba: NextBestAction,
  ctx: {
    company: Company;
    objectType?: AttentionObjectType;
    sourceObjectId?: string;
    sourceObjectName?: string;
    href?: string;
    severity?: AttentionSeverity;
    contactEmail?: string;
    contactPhone?: string;
  },
): AttentionItem | null {
  if (!nba) return null;

  const severity: AttentionSeverity =
    ctx.severity ??
    (nba.priority === "High"
      ? "needs_attention"
      : nba.priority === "Medium"
        ? "waiting"
        : "healthy");

  return {
    id: nba.id,
    sourceObjectId: ctx.sourceObjectId ?? ctx.company.CompanyID,
    sourceObjectName: ctx.sourceObjectName ?? ctx.company.Title,
    objectType: ctx.objectType ?? "Company",
    severity,
    status: "open",
    recommendation: nba.reason,
    suggestedAiAction: nba.action,
    href: ctx.href ?? company360Href(ctx.company.CompanyID),
    companyId: ctx.company.CompanyID,
    companyName: ctx.company.Title,
    ruleId: nba.ruleId,
    contactEmail: ctx.contactEmail ?? primaryContact(ctx.company)?.Email,
    contactPhone:
      ctx.contactPhone ??
      primaryContact(ctx.company)?.Mobile ??
      primaryContact(ctx.company)?.Phone,
  };
}

function buildActivityAttention(
  activities: Activity[],
  companies: Company[],
  companyId?: string,
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const activity of activities) {
    if (!isFollowUpOpen(activity)) continue;

    // Reality First — never surface follow-ups for deleted/seed companies.
    const company = resolveActivityCompany(activity, companies);
    if (!company) continue;
    if (companyId && company.CompanyID !== companyId) continue;

    const href = `/activities/${activity.ActivityID}`;

    if (isFollowUpOverdue(activity)) {
      const daysOverdue = activity.NextActionDate
        ? Math.max(1, daysBetween(activity.NextActionDate))
        : 1;
      pushItem(items, {
        id: `attn-overdue-${activity.ActivityID}`,
        sourceObjectId: activity.ActivityID,
        sourceObjectName: activity.NextAction || activity.Subject,
        objectType: "Activity",
        severity: "urgent",
        recommendation: `Commitment overdue by ${daysOverdue} day${daysOverdue === 1 ? "" : "s"} — trust and health score at risk.`,
        suggestedAiAction: "Complete Overdue Commitment",
        dueDate: activity.NextActionDate,
        href,
        companyId: company.CompanyID,
        companyName: company.Title,
        ruleId: "overdue_followup",
      });
    } else if (isDueToday(activity)) {
      pushItem(items, {
        id: `attn-today-${activity.ActivityID}`,
        sourceObjectId: activity.ActivityID,
        sourceObjectName: activity.NextAction || activity.Subject,
        objectType: "Activity",
        severity: "waiting",
        recommendation: "Due today — complete or reschedule before end of day.",
        suggestedAiAction: activity.NextAction || "Complete commitment",
        dueDate: activity.NextActionDate,
        href,
        companyId: company.CompanyID,
        companyName: company.Title,
        ruleId: "due_today",
      });
    }
  }

  return items;
}

function buildCompanyAttention(
  companies: Company[],
  pipelines: PipelineRow[],
  activities: Activity[],
  companyId?: string,
): AttentionItem[] {
  const items: AttentionItem[] = [];
  const scoped = companyId
    ? companies.filter((c) => c.CompanyID === companyId)
    : companies;

  for (const company of scoped) {
    const companyActivities = getActivitiesForCompany(activities, company).sort(
      (a, b) =>
        parseActivityDate(b.ActivityDate).getTime() -
        parseActivityDate(a.ActivityDate).getTime(),
    );
    const lastActivity = companyActivities[0];
    const health = computeRelationshipHealth(company, activities, pipelines);
    const contact = primaryContact(company);

    if (companyActivities.length === 0) {
      pushItem(items, {
        id: `attn-no-activity-${company.CompanyID}`,
        sourceObjectId: company.CompanyID,
        sourceObjectName: company.Title,
        objectType: "Company",
        severity: "needs_attention",
        recommendation: "No logged activity — relationship has no recorded touchpoints.",
        suggestedAiAction: "Log First Interaction",
        href: company360Href(company.CompanyID),
        companyId: company.CompanyID,
        companyName: company.Title,
        ruleId: "no_activity",
        contactEmail: contact?.Email,
        contactPhone: contact?.Mobile || contact?.Phone,
      });
    }

    const daysSince = lastActivity
      ? daysBetween(lastActivity.ActivityDate)
      : null;

    // Only emit cold-contact when a real last-contact date exists.
    // Missing dates are covered by no_activity — never show "Infinity days ago".
    if (daysSince != null && Number.isFinite(daysSince) && daysSince >= COLD_CONTACT_DAYS) {
      pushItem(items, {
        id: `attn-cold-${company.CompanyID}`,
        sourceObjectId: company.CompanyID,
        sourceObjectName: company.Title,
        objectType: "Company",
        severity: daysSince >= 60 ? "urgent" : "needs_attention",
        recommendation: `Last contact ${formatLastContact(lastActivity?.ActivityDate, daysSince)} — relationship is cooling (health ${health.score}/100).`,
        suggestedAiAction: "Schedule Follow-Up Call",
        href: company360Href(company.CompanyID),
        companyId: company.CompanyID,
        companyName: company.Title,
        ruleId: "no_recent_contact",
        contactEmail: contact?.Email,
        contactPhone: contact?.Mobile || contact?.Phone,
      });
    }

    if (company.contacts.length === 0) {
      pushItem(items, {
        id: `attn-no-contact-${company.CompanyID}`,
        sourceObjectId: company.CompanyID,
        sourceObjectName: company.Title,
        objectType: "Company",
        severity: "needs_attention",
        recommendation: "No contacts on file — add a primary stakeholder to advance the relationship.",
        suggestedAiAction: "Add Primary Contact",
        href: `${company360Href(company.CompanyID)}#contacts`,
        companyId: company.CompanyID,
        companyName: company.Title,
        ruleId: "add_primary_contact",
      });
    }

    if (health.score < RISK_HEALTH_THRESHOLD || health.status === "At Risk") {
      const nba = health.recommendedAction;
      const mapped = nbaToAttention(nba, {
        company,
        severity: health.score < 30 ? "urgent" : "needs_attention",
      });
      if (mapped) {
        mapped.ruleId = "risk_threshold_exceeded";
        items.push(mapped);
      }
    } else {
      const nba = nbaToAttention(health.recommendedAction, {
        company,
        severity:
          health.recommendedAction.priority === "Low" ? "healthy" : "waiting",
      });
      if (nba && nba.severity !== "healthy") items.push(nba);
    }
  }

  return items;
}

function buildContactAttention(
  companies: Company[],
  activities: Activity[],
  companyId?: string,
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const company of companies) {
    if (companyId && company.CompanyID !== companyId) continue;

    for (const contact of company.contacts) {
      const contactActivities = getActivitiesForContact(activities, contact.ContactID);
      if (contactActivities.length === 0) {
        pushItem(items, {
          id: `attn-contact-silent-${contact.ContactID}`,
          sourceObjectId: contact.ContactID,
          sourceObjectName: getContactDisplayName(contact),
          objectType: "Contact",
          severity: "needs_attention",
          recommendation: `No activity logged with ${getContactDisplayName(contact)} — stakeholder may be disengaged.`,
          suggestedAiAction: "Draft Email",
          href: contact360Href(contact.ContactID, company.CompanyID),
          companyId: company.CompanyID,
          companyName: company.Title,
          ruleId: "no_activity",
          contactEmail: contact.Email,
          contactPhone: contact.Mobile || contact.Phone,
        });
        continue;
      }

      const daysSince = daysBetween(contactActivities[0]!.ActivityDate);
      if (Number.isFinite(daysSince) && daysSince >= COLD_CONTACT_DAYS) {
        pushItem(items, {
          id: `attn-contact-cold-${contact.ContactID}`,
          sourceObjectId: contact.ContactID,
          sourceObjectName: getContactDisplayName(contact),
          objectType: "Contact",
          severity: daysSince >= 60 ? "urgent" : "needs_attention",
          recommendation: `Last interaction ${formatLastContact(contactActivities[0]!.ActivityDate, daysSince)} — relationship may be cooling.`,
          suggestedAiAction: "Schedule Follow-Up Call",
          href: contact360Href(contact.ContactID, company.CompanyID),
          companyId: company.CompanyID,
          companyName: company.Title,
          ruleId: "no_recent_contact",
          contactEmail: contact.Email,
          contactPhone: contact.Mobile || contact.Phone,
        });
      }
    }
  }

  return items;
}

function buildOpportunityAttention(
  companies: Company[],
  pipelines: PipelineRow[],
  activities: Activity[],
  companyId?: string,
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const deal of pipelines) {
    const company = findCompanyForDeal(deal.id, companies);
    // Reality First — skip orphan opportunities with no live company.
    if (!company) continue;
    if (companyId && company.CompanyID !== companyId) continue;
    if (["Live Production", "Scheduled Maintenance"].includes(deal.status)) continue;

    const intelligence = computeOpportunityIntelligence(
      deal,
      companies,
      activities,
      pipelines,
    );

    const dealActivities = getActivitiesForDeal(activities, deal.id);
    const lastDealActivity = dealActivities[0];
    const daysSince = lastDealActivity
      ? daysBetween(lastDealActivity.ActivityDate)
      : null;

    if (daysSince == null || !Number.isFinite(daysSince)) {
      pushItem(items, {
        id: `attn-stalled-${deal.id}`,
        sourceObjectId: deal.id,
        sourceObjectName: deal.assetName,
        objectType: "Opportunity",
        severity: "needs_attention",
        recommendation: `No contact recorded at ${deal.status} — momentum cannot be confirmed.`,
        suggestedAiAction: "Re-engage Stalled Opportunity",
        href: deal360Href(deal.id),
        companyId: company?.CompanyID,
        companyName: company?.Title,
        ruleId: "stalled_opportunity",
        contactEmail: company?.contacts[0]?.Email,
        contactPhone: company?.contacts[0]?.Mobile || company?.contacts[0]?.Phone,
      });
    } else if (daysSince >= STALLED_DAYS) {
      pushItem(items, {
        id: `attn-stalled-${deal.id}`,
        sourceObjectId: deal.id,
        sourceObjectName: deal.assetName,
        objectType: "Opportunity",
        severity: daysSince >= 45 ? "urgent" : "needs_attention",
        recommendation: `No activity for ${daysSince} days at ${deal.status} — momentum is stalling.`,
        suggestedAiAction: "Re-engage Stalled Opportunity",
        href: deal360Href(deal.id),
        companyId: company?.CompanyID,
        companyName: company?.Title,
        ruleId: "stalled_opportunity",
        contactEmail: company?.contacts[0]?.Email,
        contactPhone: company?.contacts[0]?.Mobile || company?.contacts[0]?.Phone,
      });
    }

    if (intelligence.stakeholderCount < 2) {
      pushItem(items, {
        id: `attn-stakeholders-${deal.id}`,
        sourceObjectId: deal.id,
        sourceObjectName: deal.assetName,
        objectType: "Opportunity",
        severity: "needs_attention",
        recommendation: "Single-stakeholder coverage — engage additional decision makers.",
        suggestedAiAction: "Engage Additional Stakeholders",
        href: deal360Href(deal.id),
        companyId: company?.CompanyID,
        companyName: company?.Title,
        ruleId: "missing_stakeholders",
        contactEmail: company?.contacts[0]?.Email,
      });
    }

    for (const risk of intelligence.risks.filter((r) => r.severity !== "info")) {
      pushItem(items, {
        id: `attn-deal-risk-${deal.id}-${risk.id}`,
        sourceObjectId: deal.id,
        sourceObjectName: deal.assetName,
        objectType: "Opportunity",
        severity: risk.severity === "critical" ? "urgent" : "needs_attention",
        recommendation: risk.detail,
        suggestedAiAction: intelligence.nextBestAction.action,
        href: deal360Href(deal.id),
        companyId: company?.CompanyID,
        companyName: company?.Title,
        ruleId: "risk_threshold_exceeded",
        contactEmail: company?.contacts[0]?.Email,
      });
    }

    if (
      intelligence.nextBestAction.priority === "High" &&
      !items.some((i) => i.sourceObjectId === deal.id && i.ruleId === "stalled_opportunity")
    ) {
      pushItem(items, {
        id: `attn-deal-nba-${deal.id}`,
        sourceObjectId: deal.id,
        sourceObjectName: deal.assetName,
        objectType: "Opportunity",
        severity: "needs_attention",
        recommendation: intelligence.nextBestAction.reason,
        suggestedAiAction: intelligence.nextBestAction.action,
        href: deal360Href(deal.id),
        companyId: company?.CompanyID,
        companyName: company?.Title,
        ruleId: intelligence.nextBestAction.ruleId,
        contactEmail: company?.contacts[0]?.Email,
      });
    }
  }

  return items;
}

function buildCommercialPackageAttention(
  companies: Company[],
  pipelines: PipelineRow[],
  packages: CommercialPackage[],
  companyId?: string,
): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const pkg of packages) {
    const pipeline = pipelines.find((p) => p.id === pkg.DealId);
    // Reality First — skip packages tied to deleted/seed deals.
    if (!pipeline) continue;

    const company = findCompanyForDeal(pkg.DealId, companies);
    if (!company) continue;
    if (companyId && company.CompanyID !== companyId) continue;

    const dealName = pipeline.assetName;
    const href = commercialPackageHref(pkg);

    const missingMembers = pkg.members.filter((m) => !m.fileName && !m.Title);
    const incomplete = pkg.members.length > 0 && missingMembers.length > 0;

    if (incomplete || (pkg.status === "draft" && pkg.members.length === 0)) {
      const objectType: AttentionObjectType =
        pkg.kind === "transmission"
          ? "TransmissionPackage"
          : pkg.kind === "commercial_baseline"
            ? "CommercialBaseline"
            : "DocumentSet";

      pushItem(items, {
        id: `attn-docset-incomplete-${pkg.PackageID}`,
        sourceObjectId: pkg.DocumentSetID ?? pkg.PackageID,
        sourceObjectName: pkg.title || dealName,
        objectType,
        severity: "needs_attention",
        recommendation: `Document set incomplete — ${pkg.members.length - missingMembers.length} of ${pkg.members.length} documents assigned.`,
        suggestedAiAction: "Build Document Set",
        href: pkg.DocumentSetID ? documentSet360Href(pkg.DocumentSetID) : href,
        companyId: company?.CompanyID,
        companyName: company?.Title,
        ruleId: "incomplete_document_set",
      });
    }

    if (
      (pkg.kind === "transmission" || pkg.kind === "formal_quotation") &&
      pkg.status === "draft" &&
      !pkg.sentAt
    ) {
      pushItem(items, {
        id: `attn-not-transmitted-${pkg.PackageID}`,
        sourceObjectId: pkg.PackageID,
        sourceObjectName: pkg.title || dealName,
        objectType:
          pkg.kind === "transmission" ? "TransmissionPackage" : "DocumentSet",
        severity: "waiting",
        recommendation: "Package ready but not transmitted to client.",
        suggestedAiAction: "Create Transmission Package",
        href: deal360Href(pkg.DealId, "commercial", { packageId: pkg.PackageID }),
        companyId: company?.CompanyID,
        companyName: company?.Title,
        ruleId: "package_not_transmitted",
        contactEmail: company?.contacts[0]?.Email,
      });
    }
  }

  return items;
}

function dedupeAttentionItems(items: AttentionItem[]): AttentionItem[] {
  const byKey = new Map<string, AttentionItem>();

  for (const item of items) {
    const key = `${item.sourceObjectId}-${item.ruleId}`;
    const existing = byKey.get(key);
    if (!existing || SEVERITY_RANK[item.severity] < SEVERITY_RANK[existing.severity]) {
      byKey.set(key, item);
    }
  }

  return sortAttentionItems([...byKey.values()]);
}

function attentionItemReferencesLiveEntity(
  item: AttentionItem,
  ctx: AttentionEngineContext,
): boolean {
  if (item.companyId && !ctx.companies.some((c) => c.CompanyID === item.companyId)) {
    return false;
  }

  switch (item.objectType) {
    case "Company":
      return ctx.companies.some((c) => c.CompanyID === item.sourceObjectId);
    case "Contact":
      return ctx.companies.some((c) =>
        c.contacts.some((contact) => contact.ContactID === item.sourceObjectId),
      );
    case "Opportunity":
      return ctx.pipelines.some((p) => p.id === item.sourceObjectId);
    case "Activity":
      return ctx.activities.some(
        (a) => a.ActivityID === item.sourceObjectId || String(a.id) === item.sourceObjectId,
      );
    case "Document":
    case "DocumentSet":
    case "TransmissionPackage":
    case "CommercialBaseline":
      return ctx.commercialPackages.some(
        (pkg) =>
          pkg.PackageID === item.sourceObjectId ||
          pkg.DocumentSetID === item.sourceObjectId,
      );
    default:
      return Boolean(item.companyId);
  }
}

/** Generate attention items across the portfolio or for one company. */
export function buildAttentionItems(ctx: AttentionEngineContext): AttentionItem[] {
  const liveActivities = filterActivitiesToLiveEntities(ctx.activities, {
    companies: ctx.companies,
    pipelines: ctx.pipelines,
  });
  const livePackages = ctx.commercialPackages.filter((pkg) =>
    ctx.pipelines.some((pipeline) => pipeline.id === pkg.DealId),
  );
  const scoped: AttentionEngineContext = {
    ...ctx,
    activities: liveActivities,
    commercialPackages: livePackages,
  };

  const raw = [
    ...buildActivityAttention(scoped.activities, scoped.companies, scoped.companyId),
    ...buildCompanyAttention(
      scoped.companies,
      scoped.pipelines,
      scoped.activities,
      scoped.companyId,
    ),
    ...buildContactAttention(scoped.companies, scoped.activities, scoped.companyId),
    ...buildOpportunityAttention(
      scoped.companies,
      scoped.pipelines,
      scoped.activities,
      scoped.companyId,
    ),
    ...buildCommercialPackageAttention(
      scoped.companies,
      scoped.pipelines,
      scoped.commercialPackages,
      scoped.companyId,
    ),
  ];

  return dedupeAttentionItems(raw)
    .filter((item) => item.status === "open")
    .filter((item) => attentionItemReferencesLiveEntity(item, scoped));
}

export function buildAttentionQueue(
  ctx: AttentionEngineContext,
  options?: { limit?: number },
): AttentionQueue {
  const items = buildAttentionItems(ctx);
  const limited = options?.limit ? items.slice(0, options.limit) : items;
  return groupAttentionBySeverity(limited);
}

export function buildCompanyAttentionItems(
  company: Company,
  pipelines: PipelineRow[],
  activities: Activity[],
  commercialPackages: CommercialPackage[],
  allCompanies: Company[],
): AttentionItem[] {
  const accountOwner = company.AccountOwner?.Title;
  return buildAttentionItems({
    companies: allCompanies,
    pipelines,
    activities,
    commercialPackages,
    companyId: company.CompanyID,
  }).map((item) => ({
    ...item,
    ownerLabel: item.ownerLabel ?? accountOwner,
  }));
}

export function buildContactAttentionItems(
  contactId: string,
  companyId: string,
  companies: Company[],
  pipelines: PipelineRow[],
  activities: Activity[],
  commercialPackages: CommercialPackage[],
): AttentionItem[] {
  const company = companies.find((c) => c.CompanyID === companyId);
  const accountOwner = company?.AccountOwner?.Title;

  return buildAttentionItems({
    companies,
    pipelines,
    activities,
    commercialPackages,
    companyId,
  })
    .filter(
      (item) =>
        item.sourceObjectId === contactId ||
        (item.objectType === "Contact" && item.sourceObjectId === contactId),
    )
    .map((item) => ({
      ...item,
      ownerLabel: item.ownerLabel ?? accountOwner,
    }));
}

export function buildDealAttentionItems(
  dealId: string,
  companies: Company[],
  pipelines: PipelineRow[],
  activities: Activity[],
  commercialPackages: CommercialPackage[],
): AttentionItem[] {
  const company = findCompanyForDeal(dealId, companies);
  const accountOwner = company?.AccountOwner?.Title;

  return buildAttentionItems({
    companies,
    pipelines,
    activities,
    commercialPackages,
    companyId: company?.CompanyID,
  })
    .filter(
      (item) =>
        item.sourceObjectId === dealId ||
        (item.objectType === "Opportunity" && item.sourceObjectId === dealId) ||
        item.href.includes(`/deals/${dealId}`),
    )
    .map((item) => ({
      ...item,
      ownerLabel: item.ownerLabel ?? accountOwner,
    }));
}

export function countOpenAttention(items: AttentionItem[]): number {
  return items.filter(
    (i) =>
      i.status === "open" &&
      (i.severity === "urgent" ||
        i.severity === "needs_attention" ||
        i.severity === "waiting"),
  ).length;
}

export function topAttentionHeadline(queue: AttentionQueue): string {
  const urgent = queue.urgent.length;
  const needs = queue.needs_attention.length;
  const waiting = queue.waiting.length;

  if (urgent > 0) {
    return `${urgent} urgent item${urgent === 1 ? "" : "s"} need your decision now.`;
  }
  if (needs > 0) {
    return `${needs} relationship${needs === 1 ? "" : "s"} need attention today.`;
  }
  if (waiting > 0) {
    return `${waiting} item${waiting === 1 ? "" : "s"} waiting on you or the client.`;
  }
  return "Your portfolio is on track — no urgent decisions right now.";
}
