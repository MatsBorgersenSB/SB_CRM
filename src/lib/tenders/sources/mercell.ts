import "server-only";

import { type ThermalNoticeInput } from "@/lib/tenders/thermalFilter";
import {
  failedSource,
  fetchJson,
  firstDate,
  parseBudget,
  pickLocalizedText,
  skippedSource,
  type SourcePullResult,
} from "@/lib/tenders/source-shared";

function mapMercellNotice(row: Record<string, unknown>): ThermalNoticeInput | null {
  const id = String(row.id ?? row.tenderId ?? row.noticeId ?? "").trim();
  const title = pickLocalizedText(row.title ?? row.name);
  const publicationDate = firstDate(row.publicationDate ?? row.published ?? row.created);
  const deadline = firstDate(row.deadline ?? row.bidDueDate ?? row.submissionDeadline);
  if (!id || !title || !publicationDate || !deadline) return null;

  return {
    externalId: `Mercell:${id}`,
    source: "Mercell",
    title,
    authorityName:
      pickLocalizedText(row.buyer ?? row.authority ?? row.organization) ??
      "Unknown contracting authority",
    country: pickLocalizedText(row.country) ?? "Unknown",
    publicationDate,
    submissionDeadline: deadline,
    estimatedBudget: parseBudget(row.estimatedValue ?? row.value),
    summary: pickLocalizedText(row.description ?? row.summary) ?? title,
    rawUrl: String(row.url ?? row.link ?? ""),
    rawText: `${title}\n${pickLocalizedText(row.description ?? row.summary) ?? ""}`,
  };
}

export async function pullMercellNotices(): Promise<SourcePullResult> {
  const endpoint = process.env.MERCELL_API_URL?.trim();
  const apiKey = process.env.MERCELL_API_KEY?.trim();
  if (!endpoint || !apiKey) {
    return skippedSource(
      "Mercell",
      "Mercell search is a paid add-on. TED already covers EU/EEA notices Mercell publishes to TED. Set MERCELL_API_URL and MERCELL_API_KEY to enable the monitoring feed.",
    );
  }

  try {
    const result = await fetchJson(endpoint, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
    });
    if (!result.ok) {
      return failedSource(
        "Mercell",
        `Mercell HTTP ${result.status}: ${JSON.stringify(result.body).slice(0, 240)}`,
      );
    }

    const payload = result.body as
      | Record<string, unknown>[]
      | { results?: Record<string, unknown>[]; notices?: Record<string, unknown>[] };
    const rows = Array.isArray(payload)
      ? payload
      : (payload.results ?? payload.notices ?? []);
    const notices: ThermalNoticeInput[] = [];
    for (const row of rows) {
      const mapped = mapMercellNotice(row);
      if (mapped) notices.push(mapped);
    }

    return {
      source: "Mercell",
      status: "ok",
      fetched: rows.length,
      mapped: notices.length,
      notices,
    };
  } catch (error) {
    return failedSource(
      "Mercell",
      error instanceof Error ? error.message : "Mercell pull failed",
    );
  }
}
