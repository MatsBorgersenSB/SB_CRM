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
  parseBudget,
  skippedSource,
  usDate,
  type SourcePullResult,
} from "@/lib/tenders/source-shared";

const SAM_SEARCH_URL = "https://api.sam.gov/opportunities/v2/search";
const SAM_TITLE_TERMS = ["pyrolysis", "biochar", "torrefaction", "biocoal", "bio-coal"] as const;

function mapSamOpportunity(row: Record<string, unknown>): ThermalNoticeInput | null {
  const id = String(row.noticeId ?? row.solicitationNumber ?? "").trim();
  const title = String(row.title ?? "").trim();
  const publicationDate = firstDate(row.postedDate);
  const deadline = firstDate(row.responseDeadLine ?? row.responseDeadline);
  if (!id || !title || !publicationDate || !deadline) return null;

  const haystack = `${title}\n${String(row.description ?? "")}`.toLowerCase();
  const hasPositive = POSITIVE_KEYWORDS.some((keyword) => haystack.includes(keyword));
  if (!hasPositive) return null;

  const office = String(row.fullParentPathName ?? row.organizationName ?? row.department ?? "").trim();
  const country = String(row.countryCode ?? "United States").trim() || "United States";

  return {
    externalId: `SAM:${id}`,
    source: "SAM",
    title,
    authorityName: office || "Unknown contracting authority",
    country: country === "USA" || country === "US" ? "United States" : country,
    publicationDate,
    submissionDeadline: deadline,
    estimatedBudget: parseBudget(row.award),
    summary: String(row.description ?? title).slice(0, 2000),
    rawUrl: String(row.uiLink ?? `https://sam.gov/opp/${encodeURIComponent(id)}/view`),
    rawText: `${title}\n${String(row.description ?? "")}`,
  };
}

export async function pullSamNotices(now: Date = new Date()): Promise<SourcePullResult> {
  const apiKey = process.env.SAM_GOV_API_KEY?.trim();
  if (!apiKey) {
    return skippedSource(
      "SAM",
      "Set SAM_GOV_API_KEY to pull US federal opportunities from api.sam.gov.",
    );
  }

  const postedFrom = usDate(freshnessStart(now, TENDER_FRESHNESS_DAYS));
  const postedTo = usDate(now);
  const notices: ThermalNoticeInput[] = [];
  const seen = new Set<string>();
  let fetched = 0;

  try {
    for (const title of SAM_TITLE_TERMS) {
      const url = new URL(SAM_SEARCH_URL);
      url.searchParams.set("api_key", apiKey);
      url.searchParams.set("postedFrom", postedFrom);
      url.searchParams.set("postedTo", postedTo);
      url.searchParams.set("title", title);
      url.searchParams.set("limit", "100");
      url.searchParams.set("offset", "0");
      url.searchParams.set("ptype", "o");

      const result = await fetchJson(url.toString(), {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!result.ok) {
        return failedSource(
          "SAM",
          `SAM HTTP ${result.status}: ${JSON.stringify(result.body).slice(0, 240)}`,
        );
      }

      const payload = result.body as { opportunitiesData?: Record<string, unknown>[] };
      const rows = payload.opportunitiesData ?? [];
      fetched += rows.length;
      for (const row of rows) {
        const mapped = mapSamOpportunity(row);
        if (!mapped || seen.has(mapped.externalId)) continue;
        seen.add(mapped.externalId);
        notices.push(mapped);
      }
    }

    return {
      source: "SAM",
      status: "ok",
      fetched,
      mapped: notices.length,
      notices,
    };
  } catch (error) {
    return failedSource("SAM", error instanceof Error ? error.message : "SAM pull failed");
  }
}
