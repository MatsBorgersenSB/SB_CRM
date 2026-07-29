/**
 * P&ID Tag & IO List Traceability Engine (EC&I)
 * Reality First: calibration/loop status only from recorded tags — never invent instruments.
 */

import { withPrismaRetry } from "@/lib/prisma";
import type {
  EciInstrumentTagRecord,
  EciInstrumentType,
  EciIoType,
  EciProjectSummary,
  EciReadiness,
} from "@/lib/execution/eci-traceability-types";
import { CRITICAL_SAFETY_INSTRUMENT_TYPES } from "@/lib/execution/eci-traceability-types";

export type {
  EciInstrumentTagRecord,
  EciInstrumentType,
  EciIoType,
  EciProjectSummary,
  EciReadiness,
} from "@/lib/execution/eci-traceability-types";
export {
  CRITICAL_SAFETY_INSTRUMENT_TYPES,
  ECI_INSTRUMENT_TYPE_LABELS,
  ECI_INSTRUMENT_TYPE_OPTIONS,
  ECI_IO_TYPE_LABELS,
  ECI_IO_TYPE_OPTIONS,
} from "@/lib/execution/eci-traceability-types";

export type LogEciInstrumentTagPayload = {
  projectId: string;
  /** When set, updates existing tag by id */
  id?: string;
  tagNumber: string;
  description: string;
  instrumentType: EciInstrumentType;
  ioType: EciIoType;
  exRating?: string | null;
  isCalibrated?: boolean;
  loopChecked?: boolean;
  locationZone?: string | null;
};

export type ToggleEciSignOffPayload = {
  projectId: string;
  tagId: string;
  field: "isCalibrated" | "loopChecked";
  value: boolean;
};

type PrismaTagRow = {
  id: string;
  projectId: string;
  tagNumber: string;
  description: string;
  instrumentType: EciInstrumentType;
  ioType: EciIoType;
  exRating: string | null;
  isCalibrated: boolean;
  loopChecked: boolean;
  locationZone: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function mapTag(row: PrismaTagRow): EciInstrumentTagRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    tagNumber: row.tagNumber,
    description: row.description,
    instrumentType: row.instrumentType,
    ioType: row.ioType,
    exRating: row.exRating,
    isCalibrated: row.isCalibrated,
    loopChecked: row.loopChecked,
    locationZone: row.locationZone,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export function calculateEciReadinessFromTags(
  tags: EciInstrumentTagRecord[],
): EciReadiness {
  const totalTags = tags.length;
  const calibrated = tags.filter((t) => t.isCalibrated).length;
  const loopChecked = tags.filter((t) => t.loopChecked).length;

  const pendingSafetyTags = tags.filter(
    (t) =>
      CRITICAL_SAFETY_INSTRUMENT_TYPES.includes(t.instrumentType) &&
      !t.isCalibrated,
  );

  return {
    totalTags,
    calibratedPercent: percent(calibrated, totalTags),
    loopCheckedPercent: percent(loopChecked, totalTags),
    pendingSafetyTags,
  };
}

export async function calculateEciReadiness(
  projectId: string,
): Promise<EciReadiness> {
  const tags = await withPrismaRetry((prisma) =>
    prisma.eciInstrumentTag.findMany({
      where: { projectId },
      orderBy: { tagNumber: "asc" },
    }),
  );
  return calculateEciReadinessFromTags(
    (tags as PrismaTagRow[]).map(mapTag),
  );
}

/**
 * Create or update an instrument tag on the project IO list.
 */
export async function logEciInstrumentTag(
  payload: LogEciInstrumentTagPayload,
): Promise<EciInstrumentTagRecord> {
  const tagNumber = payload.tagNumber.trim().toUpperCase();
  const description = payload.description.trim();
  if (!tagNumber) throw new Error("tagNumber is required");
  if (!description) throw new Error("description is required");

  const project = await withPrismaRetry((prisma) =>
    prisma.project.findUnique({ where: { id: payload.projectId } }),
  );
  if (!project) throw new Error("Project not found");

  if (payload.id) {
    const existing = await withPrismaRetry((prisma) =>
      prisma.eciInstrumentTag.findFirst({
        where: { id: payload.id, projectId: payload.projectId },
      }),
    );
    if (!existing) throw new Error("Instrument tag not found");

    const updated = await withPrismaRetry((prisma) =>
      prisma.eciInstrumentTag.update({
        where: { id: payload.id },
        data: {
          tagNumber,
          description,
          instrumentType: payload.instrumentType,
          ioType: payload.ioType,
          exRating: payload.exRating?.trim() || null,
          isCalibrated: payload.isCalibrated ?? existing.isCalibrated,
          loopChecked: payload.loopChecked ?? existing.loopChecked,
          locationZone: payload.locationZone?.trim() || null,
        },
      }),
    );
    return mapTag(updated as PrismaTagRow);
  }

  const created = await withPrismaRetry((prisma) =>
    prisma.eciInstrumentTag.upsert({
      where: {
        projectId_tagNumber: {
          projectId: payload.projectId,
          tagNumber,
        },
      },
      create: {
        projectId: payload.projectId,
        tagNumber,
        description,
        instrumentType: payload.instrumentType,
        ioType: payload.ioType,
        exRating: payload.exRating?.trim() || null,
        isCalibrated: payload.isCalibrated ?? false,
        loopChecked: payload.loopChecked ?? false,
        locationZone: payload.locationZone?.trim() || null,
      },
      update: {
        description,
        instrumentType: payload.instrumentType,
        ioType: payload.ioType,
        exRating: payload.exRating?.trim() || null,
        isCalibrated: payload.isCalibrated ?? false,
        loopChecked: payload.loopChecked ?? false,
        locationZone: payload.locationZone?.trim() || null,
      },
    }),
  );

  return mapTag(created as PrismaTagRow);
}

export async function toggleEciSignOff(
  payload: ToggleEciSignOffPayload,
): Promise<EciInstrumentTagRecord> {
  const existing = await withPrismaRetry((prisma) =>
    prisma.eciInstrumentTag.findFirst({
      where: { id: payload.tagId, projectId: payload.projectId },
    }),
  );
  if (!existing) throw new Error("Instrument tag not found");

  const updated = await withPrismaRetry((prisma) =>
    prisma.eciInstrumentTag.update({
      where: { id: payload.tagId },
      data: { [payload.field]: payload.value },
    }),
  );
  return mapTag(updated as PrismaTagRow);
}

export async function getEciProjectSummary(
  projectId: string,
): Promise<EciProjectSummary> {
  const project = await withPrismaRetry((prisma) =>
    prisma.project.findUnique({ where: { id: projectId } }),
  );
  if (!project) throw new Error("Project not found");

  const rows = await withPrismaRetry((prisma) =>
    prisma.eciInstrumentTag.findMany({
      where: { projectId },
      orderBy: { tagNumber: "asc" },
    }),
  );

  const tags = (rows as PrismaTagRow[]).map(mapTag);
  return {
    projectId: project.id,
    projectTitle: project.title,
    tags,
    readiness: calculateEciReadinessFromTags(tags),
  };
}
