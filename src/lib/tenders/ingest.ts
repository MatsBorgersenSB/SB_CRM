import "server-only";

import { getPrisma } from "@/lib/prisma";
import { classifyThermalNotice } from "@/lib/tenders/classifier";
import {
  qualifyThermalNotice,
  type ThermalFilterRejectReason,
  type ThermalNoticeInput,
  type TenderSource,
} from "@/lib/tenders/thermalFilter";

const TENDER_SOURCES = new Set<TenderSource>(["TED", "Doffin", "Mercell", "SAM"]);
const CLASSIFIER_THRESHOLD = 80;

export type IngestTenderNotice = ThermalNoticeInput;

export type TenderIngestSummary = {
  received: number;
  keywordRejected: number;
  classifierRejected: number;
  saved: number;
  skippedExisting: number;
  rejectReasons: Partial<Record<ThermalFilterRejectReason, number>>;
  savedIds: string[];
};

function asSource(value: unknown): TenderSource | null {
  if (typeof value !== "string") return null;
  return TENDER_SOURCES.has(value as TenderSource) ? (value as TenderSource) : null;
}

function asOptionalNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value;
}

export function parseIngestNotices(body: unknown): ThermalNoticeInput[] {
  if (!body || typeof body !== "object") return [];
  const raw = (body as { notices?: unknown }).notices;
  if (!Array.isArray(raw)) return [];

  const notices: ThermalNoticeInput[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const source = asSource(row.source);
    const externalId = String(row.externalId ?? "").trim();
    const title = String(row.title ?? "").trim();
    const authorityName = String(row.authorityName ?? "").trim();
    const country = String(row.country ?? "").trim();
    if (!source || !externalId || !title || !authorityName || !country) continue;
    if (!row.publicationDate || !row.submissionDeadline) continue;

    notices.push({
      externalId,
      source,
      title,
      authorityName,
      country,
      publicationDate: row.publicationDate as string | Date,
      submissionDeadline: row.submissionDeadline as string | Date,
      estimatedBudget: asOptionalNumber(row.estimatedBudget),
      summary: typeof row.summary === "string" ? row.summary : null,
      rawUrl: typeof row.rawUrl === "string" ? row.rawUrl : null,
      rawText: typeof row.rawText === "string" ? row.rawText : null,
    });
  }
  return notices;
}

export async function ingestThermalTenders(
  notices: ThermalNoticeInput[],
  now: Date = new Date(),
): Promise<TenderIngestSummary> {
  const summary: TenderIngestSummary = {
    received: notices.length,
    keywordRejected: 0,
    classifierRejected: 0,
    saved: 0,
    skippedExisting: 0,
    rejectReasons: {},
    savedIds: [],
  };

  const prisma = getPrisma();

  for (const notice of notices) {
    const filtered = qualifyThermalNotice(notice, now);
    if (!filtered.accepted) {
      summary.keywordRejected += 1;
      summary.rejectReasons[filtered.reason] =
        (summary.rejectReasons[filtered.reason] ?? 0) + 1;
      continue;
    }

    const classification = await classifyThermalNotice(notice, filtered);
    if (!classification.qualified || classification.confidence < CLASSIFIER_THRESHOLD) {
      summary.classifierRejected += 1;
      continue;
    }

    const existing = await prisma.tender.findUnique({
      where: { externalId: notice.externalId },
      select: { id: true },
    });
    if (existing) {
      summary.skippedExisting += 1;
      continue;
    }

    const created = await prisma.tender.create({
      data: {
        externalId: notice.externalId,
        source: notice.source,
        title: notice.title,
        authorityName: notice.authorityName,
        country: notice.country,
        publicationDate: filtered.publicationDate,
        submissionDeadline: filtered.submissionDeadline,
        estimatedBudget: notice.estimatedBudget ?? null,
        sectorTag: classification.sectorTag,
        technologyType: classification.technologyType,
        summary: classification.summary,
        rawUrl: notice.rawUrl ?? null,
        status: "PENDING",
        classifierConfidence: classification.confidence,
      },
      select: { id: true },
    });

    summary.saved += 1;
    summary.savedIds.push(created.id);
  }

  return summary;
}
