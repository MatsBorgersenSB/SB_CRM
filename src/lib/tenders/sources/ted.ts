import "server-only";

import {
  TENDER_FRESHNESS_DAYS,
  type ThermalNoticeInput,
} from "@/lib/tenders/thermalFilter";
import {
  authorityFromTitle,
  buildTedFullTextQuery,
  countryFromCode,
  failedSource,
  fetchJson,
  firstDate,
  freshnessStart,
  parseBudget,
  pickLocalizedText,
  tedDateToken,
  type SourcePullResult,
} from "@/lib/tenders/source-shared";

const TED_SEARCH_URL = "https://api.ted.europa.eu/v3/notices/search";
const TED_FIELDS = [
  "publication-number",
  "publication-date",
  "notice-title",
  "buyer-name",
  "organisation-name-buyer",
  "buyer-country",
  "place-of-performance-country-proc",
  "deadline",
  "deadline-receipt-tender-date-lot",
  "deadline-receipt-request-date-lot",
  "estimated-value-proc",
  "estimated-value-lot",
  "description-proc",
  "description-lot",
  "links",
] as const;

type TedNotice = Record<string, unknown>;

function htmlUrl(links: unknown, publicationNumber: string): string {
  if (links && typeof links === "object") {
    const html = (links as { htmlDirect?: Record<string, string>; html?: Record<string, string> })
      .htmlDirect;
    const preferred = html?.ENG ?? html?.eng;
    if (preferred) return preferred;
    const first = html ? Object.values(html)[0] : null;
    if (first) return first;
  }
  return `https://ted.europa.eu/en/notice/-/detail/${publicationNumber}`;
}

function mapTedNotice(row: TedNotice): ThermalNoticeInput | null {
  const publicationNumber = String(row["publication-number"] ?? "").trim();
  const title = pickLocalizedText(row["notice-title"]);
  const publicationDate = firstDate(row["publication-date"]);
  const deadline =
    firstDate(row.deadline) ??
    firstDate(row["deadline-receipt-tender-date-lot"]) ??
    firstDate(row["deadline-receipt-request-date-lot"]);
  if (!publicationNumber || !title || !publicationDate || !deadline) return null;

  const authority =
    pickLocalizedText(row["buyer-name"]) ??
    pickLocalizedText(row["organisation-name-buyer"]) ??
    authorityFromTitle(title) ??
    "Unknown contracting authority";

  const country = countryFromCode(
    row["buyer-country"] ?? row["place-of-performance-country-proc"],
  );
  const summary =
    pickLocalizedText(row["description-proc"]) ??
    pickLocalizedText(row["description-lot"]) ??
    title;

  return {
    externalId: `TED:${publicationNumber}`,
    source: "TED",
    title,
    authorityName: authority,
    country,
    publicationDate,
    submissionDeadline: deadline,
    estimatedBudget: parseBudget(row["estimated-value-proc"] ?? row["estimated-value-lot"]),
    summary,
    rawUrl: htmlUrl(row.links, publicationNumber),
    rawText: [title, authority, summary].join("\n"),
  };
}

export async function pullTedNotices(now: Date = new Date()): Promise<SourcePullResult> {
  const since = tedDateToken(freshnessStart(now, TENDER_FRESHNESS_DAYS));
  const query = `${buildTedFullTextQuery()} AND PD >= ${since}`;
  const notices: ThermalNoticeInput[] = [];
  let fetched = 0;

  try {
    for (let page = 1; page <= 3; page += 1) {
      const result = await fetchJson(TED_SEARCH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          query,
          fields: TED_FIELDS,
          page,
          limit: 50,
          scope: "ALL",
          checkQuerySyntax: false,
          paginationMode: "PAGE_NUMBER",
          onlyLatestVersions: true,
        }),
      });

      if (!result.ok) {
        return failedSource(
          "TED",
          `TED HTTP ${result.status}: ${JSON.stringify(result.body).slice(0, 240)}`,
        );
      }

      const payload = result.body as {
        notices?: TedNotice[];
        timedOut?: boolean;
      };
      if (payload.timedOut) {
        return failedSource("TED", "TED search timed out");
      }

      const rows = payload.notices ?? [];
      fetched += rows.length;
      for (const row of rows) {
        const mapped = mapTedNotice(row);
        if (mapped) notices.push(mapped);
      }
      if (rows.length < 50) break;
    }

    return {
      source: "TED",
      status: "ok",
      fetched,
      mapped: notices.length,
      notices,
    };
  } catch (error) {
    return failedSource("TED", error instanceof Error ? error.message : "TED pull failed");
  }
}
