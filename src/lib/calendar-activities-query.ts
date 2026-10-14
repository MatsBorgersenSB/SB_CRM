import { COMPANY_SECTOR_PRESETS, normalizeSectorLabel } from "@/lib/company-sectors";
import { getPrisma } from "@/lib/prisma";
import type { CalendarActivity, CalendarSector } from "@/types/calendar-activity";
import { SMART_ACTIVITY_TYPES, smartActivityLabel, type SmartActivityType } from "@/types/activity";

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

export async function listCalendarActivities(start: Date, end: Date): Promise<CalendarActivity[]> {
  const rows = await getPrisma().activity.findMany({
    where: {
      startDate: { gte: start, lte: end },
    },
    select: calendarActivitySelect,
    orderBy: { startDate: "asc" },
  });
  return rows.map((row) => toCalendarActivity(row));
}

export async function createCalendarActivity(input: {
  type: SmartActivityType;
  title: string;
  startDate: Date;
  endDate: Date | null;
  companyCode: string | null;
  opportunityCode: string | null;
}): Promise<CalendarActivity> {
  const prisma = getPrisma();
  const company = input.companyCode
    ? await prisma.company.findFirst({
        where: { OR: [{ id: input.companyCode }, { code: input.companyCode }] },
        select: { id: true },
      })
    : null;
  const opportunity = input.opportunityCode
    ? await prisma.opportunity.findFirst({
        where: { OR: [{ id: input.opportunityCode }, { code: input.opportunityCode }] },
        select: { id: true },
      })
    : null;

  const row = await prisma.activity.create({
    data: {
      activityType: input.type,
      title: input.title,
      startDate: input.startDate,
      endDate: input.endDate,
      companyId: company?.id ?? null,
      opportunityId: opportunity?.id ?? null,
    },
    select: calendarActivitySelect,
  });
  return toCalendarActivity(row);
}

export async function completeCalendarActivity(id: string): Promise<CalendarActivity | null> {
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
