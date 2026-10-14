import { listActivities, updateActivityRecord, isPrismaActivityStore } from "@/lib/activity-store";
import { resolveActivityCompany } from "@/lib/activity-utils";
import { COMPANY_SECTOR_PRESETS, normalizeSectorLabel } from "@/lib/company-sectors";
import { readCompanies, readPipelines } from "@/lib/pipeline-db";
import { getPrisma } from "@/lib/prisma";
import type {
  CalendarActivity,
  CalendarEventDetails,
  CalendarSector,
} from "@/types/calendar-activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import {
  SMART_ACTIVITY_TYPES,
  smartActivityLabel,
  toSmartActivityType,
  type Activity,
  type SmartActivityType,
} from "@/types/activity";

/**
 * Explicit calendar select. Prisma stores `activityType`, `company.sectors`,
 * and `opportunity.name` / `value`. The response uses title, type, sectorTag, and amount.
 */
const calendarActivitySelect = {
  id: true,
  title: true,
  activityType: true,
  startDate: true,
  endDate: true,
  isAiProposed: true,
  completedAt: true,
  aiContext: true,
  companyId: true,
  opportunityId: true,
  company: {
    select: {
      id: true,
      name: true,
      sectors: true,
    },
  },
  opportunity: {
    select: {
      id: true,
      name: true,
      value: true,
      currency: true,
    },
  },
} as const;

type CalendarActivityRow = {
  id: string;
  title: string;
  activityType: string;
  startDate: Date | null;
  endDate: Date | null;
  isAiProposed: boolean;
  completedAt: Date | null;
  aiContext: unknown;
  companyId: string | null;
  opportunityId: string | null;
  company: { id: string; name: string; sectors: string[] } | null;
  opportunity: { id: string; name: string; value: number | null; currency: string | null } | null;
};

function asSmartActivityType(value: string): SmartActivityType {
  if ((SMART_ACTIVITY_TYPES as readonly string[]).includes(value)) {
    return value as SmartActivityType;
  }
  throw new Error(`Unknown activity type: ${value}`);
}

function primarySector(sectors: string[]): CalendarSector | null {
  for (const raw of sectors) {
    const label = normalizeSectorLabel(raw);
    if ((COMPANY_SECTOR_PRESETS as readonly string[]).includes(label)) {
      return label as CalendarSector;
    }
  }
  return null;
}

function readEventDetails(context: unknown): CalendarEventDetails | null {
  if (!context || typeof context !== "object") return null;
  const raw = context as Record<string, unknown>;
  const text = (key: string) => (typeof raw[key] === "string" && (raw[key] as string).trim() ? (raw[key] as string).trim() : null);
  const themes = Array.isArray(raw.themes)
    ? raw.themes.filter((t): t is string => typeof t === "string" && t.trim().length > 0)
    : [];
  const details: CalendarEventDetails = {
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

export function toCalendarActivity(row: CalendarActivityRow): CalendarActivity {
  const type = asSmartActivityType(row.activityType);
  return {
    id: row.id,
    title: row.title.trim() || smartActivityLabel(type),
    type,
    startDate: row.startDate?.toISOString() ?? null,
    endDate: row.endDate?.toISOString() ?? null,
    isAiProposed: row.isAiProposed,
    completedAt: row.completedAt?.toISOString() ?? null,
    event: readEventDetails(row.aiContext),
    companyId: row.companyId,
    opportunityId: row.opportunityId,
    company: row.company
      ? {
          id: row.company.id,
          name: row.company.name,
          sectorTag: primarySector(row.company.sectors),
        }
      : null,
    opportunity: row.opportunity
      ? {
          id: row.opportunity.id,
          title: row.opportunity.name,
          amount: row.opportunity.value,
          currency: row.opportunity.currency,
        }
      : null,
  };
}

/**
 * Local JSON fallback: the same activities the list shows, placed on the calendar.
 * Only used when no database is configured.
 */
function legacyToCalendarActivity(
  activity: Activity,
  companies: Company[],
  pipelines: PipelineRow[],
): CalendarActivity | null {
  const type = toSmartActivityType(activity.ActivityType);
  if (!type) return null;
  const start = new Date(activity.ActivityDate);
  if (Number.isNaN(start.getTime())) return null;
  const end = activity.DurationMinutes
    ? new Date(start.getTime() + activity.DurationMinutes * 60_000)
    : null;
  const company = resolveActivityCompany(activity, companies);
  const dealId = activity.Deal?.Title ?? null;
  const deal = dealId ? pipelines.find((row) => row.id === dealId) : undefined;
  return {
    id: activity.ActivityID,
    title: activity.Subject.trim() || smartActivityLabel(type),
    type,
    startDate: start.toISOString(),
    endDate: end?.toISOString() ?? null,
    isAiProposed: Boolean(activity.IsAiProposed),
    completedAt: activity.ActionStatus === "Completed" ? start.toISOString() : null,
    event: activity.EventDetails ?? null,
    companyId: company?.CompanyID ?? null,
    opportunityId: dealId,
    company: company
      ? { id: company.CompanyID, name: company.Title, sectorTag: primarySector(company.Sectors ?? []) }
      : null,
    opportunity: deal
      ? { id: deal.id, title: deal.assetName, amount: deal.salesValue ?? null, currency: deal.currency ?? null }
      : null,
  };
}

export async function listCalendarActivities(start: Date, end: Date): Promise<CalendarActivity[]> {
  if (!isPrismaActivityStore()) {
    const [activities, companies, pipelines] = await Promise.all([
      listActivities(),
      readCompanies(),
      readPipelines(),
    ]);
    return activities
      .map((activity) => legacyToCalendarActivity(activity, companies, pipelines))
      .filter((item): item is CalendarActivity => Boolean(item?.startDate))
      .filter((item) => {
        const when = new Date(item.startDate!);
        return when >= start && when <= end;
      })
      .sort((a, b) => a.startDate!.localeCompare(b.startDate!));
  }
  const rows = await getPrisma().activity.findMany({
    where: {
      startDate: { gte: start, lte: end },
    },
    select: calendarActivitySelect,
    orderBy: { startDate: "asc" },
  });
  return rows.map((row) => toCalendarActivity(row));
}

export async function completeCalendarActivity(id: string): Promise<CalendarActivity | null> {
  if (!isPrismaActivityStore()) {
    const updated = await updateActivityRecord(id, { ActionStatus: "Completed" }).catch(() => null);
    if (!updated) return null;
    const [companies, pipelines] = await Promise.all([readCompanies(), readPipelines()]);
    return legacyToCalendarActivity(updated, companies, pipelines);
  }
  const prisma = getPrisma();
  const existing = await prisma.activity.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) return null;

  const row = await prisma.activity.update({
    where: { id },
    data: { completedAt: new Date() },
    select: calendarActivitySelect,
  });
  return toCalendarActivity(row);
}
