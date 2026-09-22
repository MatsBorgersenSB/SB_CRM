import "server-only";

import {
  POSITIVE_KEYWORDS,
  TENDER_FRESHNESS_DAYS,
  type ThermalNoticeInput,
} from "@/lib/tenders/thermalFilter";
import {
  failedSource,
  fetchJson,
  firstDate,
  freshnessStart,
  isoDate,
  parseBudget,
  pickLocalizedText,
  skippedSource,
  type SourcePullResult,
} from "@/lib/tenders/source-shared";

function doffinHeaders(apiKey: string): HeadersInit {
  return {
    Accept: "application/json",
    "Ocp-Apim-Subscription-Key": apiKey,
  };
}

function mapDoffinNotice(row: Record<string, unknown>): ThermalNoticeInput | null {
  const id = String(row.noticeId ?? row.id ?? "").trim();
  const title = pickLocalizedText(row.title ?? row.heading);
  const publicationDate = firstDate(row.publishedDate ?? row.publicationDate ?? row.issueDate);
  const deadline = firstDate(row.deadline ?? row.submissionDeadline);
  if (!id || !title || !publicationDate || !deadline) return null;

  const authority =
    pickLocalizedText(row.buyerName ?? row.buyer) ?? "Unknown contracting authority";
  const summary = pickLocalizedText(row.description) ?? title;
  const country = pickLocalizedText(row.country ?? row.location) ?? "Norway";

  return {
    externalId: `Doffin:${id}`,
    source: "Doffin",
    title,
    authorityName: authority,
    country,
    publicationDate,
    submissionDeadline: deadline,
    estimatedBudget: parseBudget(row.estimatedValue ?? row.value),
    summary,
    rawUrl: `https://doffin.no/Notice/${encodeURIComponent(id)}`,
    rawText: [title, authority, summary].join("\n"),
  };
}

export async function pullDoffinNotices(now: Date = new Date()): Promise<SourcePullResult> {
  const apiKey = process.env.DOFFIN_API_KEY?.trim();
  if (!apiKey) {
    return skippedSource(
      "Doffin",
      "Set DOFFIN_API_KEY to pull Norwegian notices that are not already on TED.",
    );
  }

  const base = (process.env.DOFFIN_API_BASE?.trim() || "https://betaapi.doffin.no/public/v2").replace(
    /\/$/,
    "",
  );
  const since = isoDate(freshnessStart(now, TENDER_FRESHNESS_DAYS));
  const query = POSITIVE_KEYWORDS.slice(0, 8).join(" ");
  const notices: ThermalNoticeInput[] = [];
  let fetched = 0;

  try {
    for (let page = 0; page < 3; page += 1) {
      const url = new URL(`${base}/notices/search`);
      url.searchParams.set("searchString", query);
      url.searchParams.set("status", "ACTIVE");
      url.searchParams.set("issueDateFrom", since);
      url.searchParams.set("page", String(page));
      url.searchParams.set("numHitsPerPage", "20");
      url.searchParams.set("sortBy", "PUBLICATION_DATE_DESC");

      const result = await fetchJson(url.toString(), {
        method: "GET",
        headers: doffinHeaders(apiKey),
      });
      if (!result.ok) {
        return failedSource(
          "Doffin",
          `Doffin HTTP ${result.status}: ${JSON.stringify(result.body).slice(0, 240)}`,
        );
      }

      const payload = result.body as { notices?: Record<string, unknown>[]; hits?: Record<string, unknown>[] };
      const rows = payload.notices ?? payload.hits ?? [];
      fetched += rows.length;
      for (const row of rows) {
        const mapped = mapDoffinNotice(row);
        if (mapped) notices.push(mapped);
      }
      if (rows.length < 20) break;
    }

    return {
      source: "Doffin",
      status: "ok",
      fetched,
      mapped: notices.length,
      notices,
    };
  } catch (error) {
    return failedSource(
      "Doffin",
      error instanceof Error ? error.message : "Doffin pull failed",
    );
  }
}
