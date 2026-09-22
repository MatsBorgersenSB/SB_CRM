import "server-only";

import { ingestThermalTenders, type TenderIngestSummary } from "@/lib/tenders/ingest";
import { noticeDedupeKey, type SourcePullResult } from "@/lib/tenders/source-shared";
import { pullDoffinNotices } from "@/lib/tenders/sources/doffin";
import { pullMercellNotices } from "@/lib/tenders/sources/mercell";
import { pullSamNotices } from "@/lib/tenders/sources/sam";
import { pullTedNotices } from "@/lib/tenders/sources/ted";
import type { ThermalNoticeInput } from "@/lib/tenders/thermalFilter";

export type ThermalTenderPullSummary = {
  sources: Array<Omit<SourcePullResult, "notices">>;
  uniqueNotices: number;
  ingest: TenderIngestSummary;
};

function dedupeNotices(notices: ThermalNoticeInput[]): ThermalNoticeInput[] {
  const seenExternal = new Set<string>();
  const seenSoft = new Set<string>();
  const unique: ThermalNoticeInput[] = [];
  for (const notice of notices) {
    if (seenExternal.has(notice.externalId)) continue;
    const soft = noticeDedupeKey(notice);
    if (seenSoft.has(soft)) continue;
    seenExternal.add(notice.externalId);
    seenSoft.add(soft);
    unique.push(notice);
  }
  return unique;
}

export async function pullAndIngestThermalTenders(
  now: Date = new Date(),
): Promise<ThermalTenderPullSummary> {
  const [ted, doffin, sam, mercell] = await Promise.all([
    pullTedNotices(now),
    pullDoffinNotices(now),
    pullSamNotices(now),
    pullMercellNotices(),
  ]);

  const sources = [ted, doffin, sam, mercell];
  const uniqueNotices = dedupeNotices(sources.flatMap((source) => source.notices));
  const ingest = await ingestThermalTenders(uniqueNotices, now);

  return {
    sources: sources.map(({ notices: _notices, ...rest }) => rest),
    uniqueNotices: uniqueNotices.length,
    ingest,
  };
}
