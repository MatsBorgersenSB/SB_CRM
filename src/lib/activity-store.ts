import type { Prisma } from "@/generated/prisma";
import { getPrisma } from "@/lib/prisma";
import { shouldFallbackToJsonPortfolio } from "@/lib/prisma-data-mode";
import { stableNumericId, toContactTrackingId } from "@/lib/prisma-mappers";
import {
  createActivity as createJsonActivity,
  readActivities as readJsonActivities,
  updateActivity as updateJsonActivity,
} from "@/lib/pipeline-db";
import {
  SMART_ACTIVITY_DISPLAY,
  toSmartActivityType,
  type Activity,
  type ActivityEventDetails,
  type CreateActivityInput,
  type SmartActivityType,
  type UpdateActivityInput,
} from "@/types/activity";

/**
 * The one activity store.
 *
 * Prisma `activities` is the durable record: calendar placement and links live
 * in columns, the full business record (owner, next action, decisions,
 * commitments, risks) lives in `details`. The list, the calendar, and every
 * 360 view read from here. The JSON file remains only as the local fallback
 * when no database is configured.
 */

export function isPrismaActivityStore(): boolean {
  const mode = process.env.ACTIVITY_STORE?.trim().toLowerCase();
  if (mode === "json") return false;
  if (mode === "prisma") return true;
  return !shouldFallbackToJsonPortfolio();
}

export function activityTrackingId(seq: number): string {
  return `ACT-${seq}`;
}

function seqFromId(id: string | number): number | null {
  if (typeof id === "number") return Number.isFinite(id) ? id : null;
  const trimmed = id.trim();
  const match = /^ACT-(\d+)$/i.exec(trimmed);
  if (match) return Number(match[1]);
  return /^\d+$/.test(trimmed) ? Number(trimmed) : null;
}

const rowSelect = {
  id: true,
  seq: true,
  activityType: true,
  title: true,
  startDate: true,
  endDate: true,
  isAiProposed: true,
  completedAt: true,
  aiContext: true,
  details: true,
  companyId: true,
  opportunityId: true,
  company: { select: { id: true, name: true } },
  opportunity: { select: { id: true, code: true } },
} as const;

type Row = {
  id: string;
  seq: number;
  activityType: string;
  title: string;
  startDate: Date | null;
  endDate: Date | null;
  isAiProposed: boolean;
  completedAt: Date | null;
  aiContext: unknown;
  details: unknown;
  companyId: string | null;
  opportunityId: string | null;
  company: { id: string; name: string } | null;
  opportunity: { id: string; code: string | null } | null;
};

function eventDetailsFromContext(context: unknown): ActivityEventDetails | null {
  if (!context || typeof context !== "object") return null;
  const raw = context as Record<string, unknown>;
  const text = (key: string) =>
    typeof raw[key] === "string" && (raw[key] as string).trim() ? (raw[key] as string).trim() : null;
  const themes = Array.isArray(raw.themes)
    ? raw.themes.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    : [];
  const details: ActivityEventDetails = {
    location: text("location"),
    website: text("website"),
    organizer: text("organizer"),
    objective: text("objective"),
    themes,
  };
  return details.location || details.website || details.organizer || details.objective || themes.length
    ? details
    : null;
}

export function rowToActivity(row: Row): Activity {
  const stored = (row.details && typeof row.details === "object" ? row.details : {}) as Partial<Activity>;
  const smartType = row.activityType as SmartActivityType;
  const displayType = stored.ActivityType ?? SMART_ACTIVITY_DISPLAY[smartType] ?? "Note";
  const activityDate = row.startDate?.toISOString() ?? stored.ActivityDate ?? new Date(0).toISOString();
  const company =
    stored.Company ??
    (row.company ? { Id: stableNumericId(row.company.id), Title: row.company.name } : null);
  const deal =
    stored.Deal ??
    (row.opportunity ? { Id: 0, Title: row.opportunity.id } : null);
  const completed = Boolean(row.completedAt);

  return {
    ActivityDescription: "",
    ActionRequired: false,
    NextAction: "",
    NextActionDate: "",
    ActionOutcome: "",
    Contact: null,
    ActivityOwner: null,
    ...stored,
    id: row.seq,
    ActivityID: activityTrackingId(row.seq),
    ActivityType: displayType,
    ActivityDate: activityDate,
    Subject: row.title || stored.Subject || "",
    Company: company,
    Deal: deal,
    ActionStatus: completed ? "Completed" : stored.ActionStatus ?? "Planned",
    IsAiProposed: row.isAiProposed,
    EventDetails: stored.EventDetails ?? eventDetailsFromContext(row.aiContext),
  };
}

function detailsFromActivity(activity: Activity): Prisma.InputJsonObject {
  // Everything except the identity, which is derived from the row.
  const rest: Partial<Activity> = { ...activity };
  delete rest.id;
  delete rest.ActivityID;
  return JSON.parse(JSON.stringify(rest)) as Prisma.InputJsonObject;
}

function columnsFromActivity(activity: Activity) {
  const smartType = toSmartActivityType(activity.ActivityType) || "NOTE";
  const start = activity.ActivityDate ? new Date(activity.ActivityDate) : null;
  const validStart = start && !Number.isNaN(start.getTime()) ? start : null;
  const end =
    validStart && activity.DurationMinutes
      ? new Date(validStart.getTime() + activity.DurationMinutes * 60_000)
      : null;
  const event = activity.EventDetails;
  return {
    activityType: smartType,
    title: activity.Subject.trim(),
    startDate: validStart,
    endDate: end,
    completedAt: activity.ActionStatus === "Completed" ? validStart ?? new Date() : null,
    isAiProposed: Boolean(activity.IsAiProposed),
    aiContext: event
      ? {
          location: event.location,
          website: event.website,
          organizer: event.organizer,
          objective: event.objective,
          themes: event.themes,
        }
      : undefined,
    details: detailsFromActivity(activity),
  };
}

async function resolveLinks(input: CreateActivityInput) {
  const prisma = getPrisma();
  let companyLookup = input.Company ?? null;
  let contactLookup = input.Contact ?? null;
  let dealLookup = input.Deal ?? null;
  let companyId: string | null = null;
  let opportunityId: string | null = null;

  if (companyLookup && "CompanyID" in companyLookup) {
    const code = companyLookup.CompanyID;
    const company = await prisma.company.findFirst({
      where: { OR: [{ code }, { id: code }] },
      select: { id: true, name: true },
    });
    companyLookup = company ? { Id: stableNumericId(company.id), Title: company.name } : null;
    companyId = company?.id ?? null;
  } else if (companyLookup && "Title" in companyLookup && companyLookup.Title) {
    const company = await prisma.company.findFirst({
      where: { name: companyLookup.Title },
      select: { id: true },
    });
    companyId = company?.id ?? null;
  }

  if (contactLookup && "ContactID" in contactLookup) {
    const code = contactLookup.ContactID;
    const contacts = await prisma.contact.findMany({
      where: { company: companyId ? { id: companyId } : undefined },
      select: { id: true, fullName: true, firstName: true, lastName: true, companyId: true, company: { select: { id: true, name: true } } },
      take: companyId ? 500 : 2000,
    });
    const contact = contacts.find((c) => c.id === code || toContactTrackingId(c.id) === code);
    if (contact) {
      const title =
        contact.fullName?.trim() || `${contact.firstName ?? ""} ${contact.lastName ?? ""}`.trim() || "Contact";
      contactLookup = { Id: stableNumericId(contact.id), Title: title };
      if (!companyId && contact.company) {
        companyId = contact.company.id;
        companyLookup = { Id: stableNumericId(contact.company.id), Title: contact.company.name };
      }
    } else {
      contactLookup = null;
    }
  }

  if (dealLookup && "DealID" in dealLookup) {
    const code = dealLookup.DealID;
    const opportunity = await prisma.opportunity.findFirst({
      where: { OR: [{ id: code }, { code }] },
      select: { id: true, companyId: true, company: { select: { id: true, name: true } } },
    });
    dealLookup = opportunity ? { Id: 0, Title: opportunity.id } : null;
    opportunityId = opportunity?.id ?? null;
    if (!companyId && opportunity?.company) {
      companyId = opportunity.company.id;
      companyLookup = { Id: stableNumericId(opportunity.company.id), Title: opportunity.company.name };
    }
  } else if (dealLookup && "Title" in dealLookup && dealLookup.Title) {
    opportunityId = dealLookup.Title;
  }

  return {
    companyLookup: companyLookup as Activity["Company"],
    contactLookup: contactLookup as Activity["Contact"],
    dealLookup: dealLookup as Activity["Deal"],
    companyId,
    opportunityId,
  };
}

export async function listActivities(): Promise<Activity[]> {
  if (!isPrismaActivityStore()) return readJsonActivities();
  const rows = await getPrisma().activity.findMany({
    select: rowSelect,
    orderBy: [{ startDate: "desc" }, { seq: "desc" }],
  });
  return rows.map(rowToActivity);
}

export async function getActivity(id: string | number): Promise<Activity | undefined> {
  if (!isPrismaActivityStore()) {
    const rows = await readJsonActivities();
    return rows.find((a) => a.ActivityID === String(id) || String(a.id) === String(id));
  }
  const seq = seqFromId(id);
  const row = await getPrisma().activity.findFirst({
    where: seq != null ? { seq } : { id: String(id) },
    select: rowSelect,
  });
  return row ? rowToActivity(row) : undefined;
}

export async function createActivityRecord(input: CreateActivityInput): Promise<Activity> {
  if (!isPrismaActivityStore()) return createJsonActivity(input);

  const links = await resolveLinks(input);
  const record: Activity = {
    id: 0,
    ActivityID: "",
    ActivityType: input.ActivityType,
    ActivityDate: input.ActivityDate,
    Subject: input.Subject,
    ActivityDescription: input.ActivityDescription,
    Summary: input.Summary,
    KeyDecisions: input.KeyDecisions ?? [],
    AgreedActions: input.AgreedActions ?? [],
    Risks: input.Risks ?? [],
    LinkedDocuments: input.LinkedDocuments ?? [],
    LinkedDeals: input.LinkedDeals ?? [],
    LinkedContacts: input.LinkedContacts ?? [],
    Stakeholders: input.Stakeholders ?? [],
    SharedWith: input.SharedWith ?? [],
    SmartAssistAssessment: input.SmartAssistAssessment,
    Company: links.companyLookup,
    Contact: links.contactLookup,
    Deal: links.dealLookup,
    ProjectId: input.ProjectId?.trim() || null,
    ProjectName: input.ProjectName?.trim() || null,
    ActivityOwner: input.ActivityOwner ?? null,
    ActionRequired: input.ActionRequired,
    NextAction: input.NextAction,
    NextActionDate: input.NextActionDate,
    ActionStatus: input.ActionStatus,
    ActionOutcome: input.ActionOutcome,
    DurationMinutes: input.DurationMinutes,
    Priority: input.Priority,
    M365Targets: input.M365Targets,
    OutlookMessageId: input.OutlookMessageId,
    OutlookConversationId: input.OutlookConversationId,
    ReconciledFromOutlook: input.ReconciledFromOutlook,
    EventDetails: input.EventDetails ?? null,
    IsAiProposed: input.IsAiProposed ?? false,
  };

  const row = await getPrisma().activity.create({
    data: {
      ...columnsFromActivity(record),
      companyId: links.companyId,
      opportunityId: links.opportunityId,
    },
    select: rowSelect,
  });
  return rowToActivity(row);
}

export async function updateActivityRecord(
  id: string | number,
  patch: UpdateActivityInput,
): Promise<Activity> {
  if (!isPrismaActivityStore()) return updateJsonActivity(String(id), patch);

  const prisma = getPrisma();
  const seq = seqFromId(id);
  const existing = await prisma.activity.findFirst({
    where: seq != null ? { seq } : { id: String(id) },
    select: rowSelect,
  });
  if (!existing) throw new Error(`Activity not found: ${id}`);

  const current = rowToActivity(existing);
  const merged: Activity = { ...current, ...patch, id: current.id, ActivityID: current.ActivityID };

  let companyId = existing.companyId;
  let opportunityId = existing.opportunityId;
  if (patch.Company && "CompanyID" in patch.Company) {
    const links = await resolveLinks({ ...patch, Company: patch.Company } as CreateActivityInput);
    companyId = links.companyId;
    merged.Company = links.companyLookup;
  }
  if (patch.Deal && "DealID" in patch.Deal) {
    const links = await resolveLinks({ ...patch, Deal: patch.Deal } as CreateActivityInput);
    opportunityId = links.opportunityId;
    merged.Deal = links.dealLookup;
  }

  const row = await prisma.activity.update({
    where: { id: existing.id },
    data: { ...columnsFromActivity(merged), companyId, opportunityId },
    select: rowSelect,
  });
  return rowToActivity(row);
}
