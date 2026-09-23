import "server-only";

import { getPrisma } from "@/lib/prisma";
import { daysUntilDeadline } from "@/lib/tenders/thermalFilter";
import { TENDER_SELECT, type TenderListItem } from "@/lib/tenders/types";
import type { TenderSource, TenderStatus } from "@/lib/tenders/thermalFilter";
import {
  isTenderSectorTag,
  isTenderTechnologyType,
} from "@/lib/tenders/thermalFilter";

function asTenderSource(value: string): TenderSource {
  if (value === "TED" || value === "Doffin" || value === "Mercell" || value === "SAM") {
    return value;
  }
  return "TED";
}

function asTenderStatus(value: string): TenderStatus {
  if (
    value === "PENDING" ||
    value === "PROMOTED" ||
    value === "EXPIRED" ||
    value === "DISMISSED"
  ) {
    return value;
  }
  return "PENDING";
}

export async function expireOverdueTenders(now: Date = new Date()): Promise<number> {
  const prisma = getPrisma();
  const result = await prisma.tender.updateMany({
    where: {
      status: "PENDING",
      submissionDeadline: { lte: now },
    },
    data: { status: "EXPIRED" },
  });
  return result.count;
}

export async function listPendingTenders(options?: {
  take?: number;
  now?: Date;
  /** Homepage / focus reads should not write. Cron already expires overdue notices. */
  expire?: boolean;
}): Promise<TenderListItem[]> {
  const now = options?.now ?? new Date();
  if (options?.expire !== false) {
    await expireOverdueTenders(now);
  }

  const prisma = getPrisma();
  const rows = await prisma.tender.findMany({
    where: { status: "PENDING" },
    select: TENDER_SELECT,
    orderBy: [{ submissionDeadline: "asc" }, { publicationDate: "desc" }],
    take: options?.take && options.take > 0 ? options.take : undefined,
  });

  const items: TenderListItem[] = [];
  for (const row of rows) {
    if (!isTenderSectorTag(row.sectorTag) || !isTenderTechnologyType(row.technologyType)) {
      continue;
    }
    items.push({
      id: row.id,
      externalId: row.externalId,
      source: asTenderSource(row.source),
      title: row.title,
      authorityName: row.authorityName,
      country: row.country,
      publicationDate: row.publicationDate.toISOString(),
      submissionDeadline: row.submissionDeadline.toISOString(),
      estimatedBudget: row.estimatedBudget,
      sectorTag: row.sectorTag,
      technologyType: row.technologyType,
      summary: row.summary,
      rawUrl: row.rawUrl,
      status: asTenderStatus(row.status),
      classifierConfidence: row.classifierConfidence,
      daysLeft: daysUntilDeadline(row.submissionDeadline, now),
    });
  }
  return items;
}
