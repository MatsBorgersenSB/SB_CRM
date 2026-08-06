/**
 * ATEX & Safety Interlock Guardian + PLC/SCADA Loop Check Co-Pilot
 * Reality First: verification status only from recorded interlocks/releases — never invent tests.
 */

import { withPrismaRetry } from "@/lib/prisma";
import type {
  AtexInterlockRecord,
  AtexPlcSummary,
  AtexZone,
  PlcReleaseRecord,
  SafetyInterlockCheck,
} from "@/lib/execution/atex-plc-types";
import { HOT_GAS_CRITICAL_ZONES } from "@/lib/execution/atex-plc-types";

export type {
  AtexInterlockRecord,
  AtexPlcSummary,
  AtexZone,
  PlcReleaseRecord,
  SafetyInterlockCheck,
} from "@/lib/execution/atex-plc-types";
export {
  ATEX_ZONE_LABELS,
  ATEX_ZONE_OPTIONS,
  HOT_GAS_CRITICAL_ZONES,
} from "@/lib/execution/atex-plc-types";

export type CreateAtexInterlockPayload = {
  projectId: string;
  loopName: string;
  atexZone: AtexZone;
  causeDescription: string;
  effectDescription: string;
};

export type LogInterlockVerificationPayload = {
  interlockId: string;
  projectId: string;
  field: "isDryTested" | "isWetTested";
  value: boolean;
  verifiedBy?: string | null;
};

export type RecordPlcReleasePayload = {
  projectId: string;
  plcTargetName: string;
  codeVersion: string;
  backupChecksum?: string | null;
  notes?: string | null;
  totalLoopsCount?: number;
  verifiedLoopsCount?: number;
  deployedBy?: string | null;
};

type PrismaInterlockRow = {
  id: string;
  projectId: string;
  loopName: string;
  atexZone: AtexZone;
  causeDescription: string;
  effectDescription: string;
  isDryTested: boolean;
  isWetTested: boolean;
  verifiedBy: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
};

type PrismaPlcRow = {
  id: string;
  projectId: string;
  plcTargetName: string;
  codeVersion: string;
  backupChecksum: string | null;
  notes: string | null;
  totalLoopsCount: number;
  verifiedLoopsCount: number;
  deployedBy: string | null;
  createdAt: Date;
};

function mapInterlock(row: PrismaInterlockRow): AtexInterlockRecord {
  return {
    id: row.id,
    projectId: row.projectId,
    loopName: row.loopName,
    atexZone: row.atexZone,
    causeDescription: row.causeDescription,
    effectDescription: row.effectDescription,
    isDryTested: row.isDryTested,
    isWetTested: row.isWetTested,
    verifiedBy: row.verifiedBy,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

function mapPlc(row: PrismaPlcRow): PlcReleaseRecord {
  const total = row.totalLoopsCount;
  const verified = row.verifiedLoopsCount;
  const loopVerifiedPercent =
    total <= 0 ? 0 : Math.round((verified / total) * 100);
  return {
    id: row.id,
    projectId: row.projectId,
    plcTargetName: row.plcTargetName,
    codeVersion: row.codeVersion,
    backupChecksum: row.backupChecksum,
    notes: row.notes,
    totalLoopsCount: total,
    verifiedLoopsCount: verified,
    deployedBy: row.deployedBy,
    createdAt: row.createdAt.toISOString(),
    loopVerifiedPercent,
  };
}

/**
 * Zone 1 / Zone 2 ESD interlocks must be dry-tested before hot gas testing.
 */
export async function verifySafetyInterlocks(
  projectId: string,
): Promise<SafetyInterlockCheck> {
  const rows = await withPrismaRetry((prisma) =>
    prisma.atexInterlock.findMany({
      where: {
        projectId,
        atexZone: { in: HOT_GAS_CRITICAL_ZONES },
      },
      orderBy: { loopName: "asc" },
    }),
  );

  const interlocks = (rows as PrismaInterlockRow[]).map(mapInterlock);
  const unverifiedInterlocks = interlocks.filter((row) => !row.isDryTested);

  return {
    safeToAdvance: unverifiedInterlocks.length === 0,
    unverifiedInterlocks,
  };
}

export async function createAtexInterlock(
  payload: CreateAtexInterlockPayload,
): Promise<AtexInterlockRecord> {
  const loopName = payload.loopName.trim();
  const causeDescription = payload.causeDescription.trim();
  const effectDescription = payload.effectDescription.trim();
  if (!loopName) throw new Error("loopName is required");
  if (!causeDescription) throw new Error("causeDescription is required");
  if (!effectDescription) throw new Error("effectDescription is required");

  const project = await withPrismaRetry((prisma) =>
    prisma.project.findUnique({ where: { id: payload.projectId } }),
  );
  if (!project) throw new Error("Project not found");

  const created = await withPrismaRetry((prisma) =>
    prisma.atexInterlock.create({
      data: {
        projectId: payload.projectId,
        loopName,
        atexZone: payload.atexZone,
        causeDescription,
        effectDescription,
      },
    }),
  );

  return mapInterlock(created as PrismaInterlockRow);
}

/**
 * Toggle dry/wet test verification on an interlock.
 */
export async function logInterlockVerification(
  interlockId: string,
  payload: Omit<LogInterlockVerificationPayload, "interlockId">,
): Promise<AtexInterlockRecord> {
  const existing = await withPrismaRetry((prisma) =>
    prisma.atexInterlock.findFirst({
      where: { id: interlockId, projectId: payload.projectId },
    }),
  );
  if (!existing) throw new Error("Interlock not found");

  const now = new Date();
  const nextDry =
    payload.field === "isDryTested" ? payload.value : existing.isDryTested;
  const nextWet =
    payload.field === "isWetTested" ? payload.value : existing.isWetTested;
  const anyVerified = nextDry || nextWet;

  const updated = await withPrismaRetry((prisma) =>
    prisma.atexInterlock.update({
      where: { id: interlockId },
      data: {
        [payload.field]: payload.value,
        verifiedBy: anyVerified
          ? payload.verifiedBy?.trim() || existing.verifiedBy
          : null,
        verifiedAt: anyVerified ? now : null,
      },
    }),
  );

  return mapInterlock(updated as PrismaInterlockRow);
}

/**
 * Record a PLC/SCADA software release with loop verification counters.
 */
export async function recordPlcRelease(
  payload: RecordPlcReleasePayload,
): Promise<PlcReleaseRecord> {
  const plcTargetName = payload.plcTargetName.trim();
  const codeVersion = payload.codeVersion.trim();
  if (!plcTargetName) throw new Error("plcTargetName is required");
  if (!codeVersion) throw new Error("codeVersion is required");

  const project = await withPrismaRetry((prisma) =>
    prisma.project.findUnique({ where: { id: payload.projectId } }),
  );
  if (!project) throw new Error("Project not found");

  const total = Math.max(0, Math.round(payload.totalLoopsCount ?? 0));
  const verified = Math.max(
    0,
    Math.min(total, Math.round(payload.verifiedLoopsCount ?? 0)),
  );

  const created = await withPrismaRetry((prisma) =>
    prisma.plcRelease.create({
      data: {
        projectId: payload.projectId,
        plcTargetName,
        codeVersion,
        backupChecksum: payload.backupChecksum?.trim() || null,
        notes: payload.notes?.trim() || null,
        totalLoopsCount: total,
        verifiedLoopsCount: verified,
        deployedBy: payload.deployedBy?.trim() || null,
      },
    }),
  );

  return mapPlc(created as PrismaPlcRow);
}

export async function getAtexPlcSummary(
  projectId: string,
): Promise<AtexPlcSummary> {
  const project = await withPrismaRetry((prisma) =>
    prisma.project.findUnique({ where: { id: projectId } }),
  );
  if (!project) throw new Error("Project not found");

  const [interlockRows, plcRows, safetyCheck] = await Promise.all([
    withPrismaRetry((prisma) =>
      prisma.atexInterlock.findMany({
        where: { projectId },
        orderBy: [{ atexZone: "asc" }, { loopName: "asc" }],
      }),
    ),
    withPrismaRetry((prisma) =>
      prisma.plcRelease.findMany({
        where: { projectId },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ),
    verifySafetyInterlocks(projectId),
  ]);

  const interlocks = (interlockRows as PrismaInterlockRow[]).map(mapInterlock);
  const plcReleases = (plcRows as PrismaPlcRow[]).map(mapPlc);

  return {
    projectId: project.id,
    projectTitle: project.title,
    interlocks,
    safetyCheck,
    latestPlcRelease: plcReleases[0] ?? null,
    plcReleases,
  };
}
