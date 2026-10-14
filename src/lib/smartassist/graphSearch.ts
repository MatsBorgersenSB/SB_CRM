/**
 * Microsoft Graph Search for the signed-in user.
 * Results are read live and are not written to the database.
 */

const GRAPH_SEARCH_URL = "https://graph.microsoft.com/v1.0/search/query";

export const GRAPH_SEARCH_SNIPPET_LIMIT = 300;

export type GraphSearchSourceType = "OUTLOOK" | "ONEDRIVE" | "TEAMS";

export type GraphSearchResultItem = {
  id: string;
  sourceType: GraphSearchSourceType;
  title: string;
  timestamp: string;
  snippet: string;
  webUrl: string;
};

type GraphHitResource = {
  "@odata.type"?: string;
  id?: string;
  subject?: string;
  name?: string;
  summary?: string;
  bodyPreview?: string;
  webLink?: string;
  webUrl?: string;
  createdDateTime?: string;
  lastModifiedDateTime?: string;
  receivedDateTime?: string;
  body?: { content?: string };
};

type GraphHit = {
  hitId?: string;
  summary?: string;
  resource?: GraphHitResource;
};

export function stripHtml(value: string): string {
  return value
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateSnippet(value: string, max = GRAPH_SEARCH_SNIPPET_LIMIT): string {
  const clean = stripHtml(value);
  if (clean.length <= max) return clean;
  return clean.slice(0, max).trimEnd();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sourceTypeFrom(odataType: string): GraphSearchSourceType | null {
  const value = odataType.toLowerCase();
  if (value.includes("chatmessage")) return "TEAMS";
  if (value.includes("driveitem")) return "ONEDRIVE";
  if (value.includes("message")) return "OUTLOOK";
  return null;
}

function isoTimestamp(resource: GraphHitResource): string {
  const candidates = [
    resource.lastModifiedDateTime,
    resource.receivedDateTime,
    resource.createdDateTime,
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return new Date(0).toISOString();
}

function mapHit(hit: GraphHit): GraphSearchResultItem | null {
  const resource = hit.resource ?? {};
  const sourceType = sourceTypeFrom(readString(resource["@odata.type"]));
  if (!sourceType) return null;

  const id = readString(resource.id) || readString(hit.hitId);
  if (!id) return null;

  const title =
    readString(resource.subject) ||
    readString(resource.name) ||
    readString(hit.summary) ||
    (sourceType === "TEAMS" ? "Teams chat" : "Untitled");

  const snippet = stripHtml(
    readString(hit.summary) ||
      readString(resource.bodyPreview) ||
      readString(resource.summary) ||
      readString(resource.body?.content),
  );

  return {
    id,
    sourceType,
    title,
    timestamp: isoTimestamp(resource),
    snippet,
    webUrl: readString(resource.webUrl) || readString(resource.webLink),
  };
}

export function mapGraphSearchResponse(payload: unknown): GraphSearchResultItem[] {
  const root = asRecord(payload);
  const value = root?.value;
  if (!Array.isArray(value)) return [];

  const items: GraphSearchResultItem[] = [];
  for (const entry of value) {
    const containers = asRecord(entry)?.hitsContainers;
    if (!Array.isArray(containers)) continue;
    for (const container of containers) {
      const hits = asRecord(container)?.hits;
      if (!Array.isArray(hits) || hits.length === 0) continue;
      for (const hit of hits) {
        const record = asRecord(hit);
        if (!record) continue;
        const mapped = mapHit(record as GraphHit);
        if (mapped) items.push(mapped);
      }
    }
  }
  return items;
}

/** Local stand-in: one Outlook message and one SharePoint file (Graph returns files as driveItem). */
export function mockGraphSearchResults(now = new Date()): GraphSearchResultItem[] {
  const emailAt = new Date(now);
  emailAt.setUTCDate(emailAt.getUTCDate() - 1);
  emailAt.setUTCHours(9, 15, 0, 0);

  const fileAt = new Date(now);
  fileAt.setUTCDate(fileAt.getUTCDate() - 4);
  fileAt.setUTCHours(14, 40, 0, 0);

  return [
    {
      id: "mock-outlook-feedstock-follow-up",
      sourceType: "OUTLOOK",
      title: "Feedstock trial follow-up",
      timestamp: emailAt.toISOString(),
      snippet:
        "We can review sludge volumes and the proposed pyrolysis line next week. No decision has been made yet.",
      webUrl: "https://outlook.office.com/mail/inbox/id/mock-outlook-feedstock-follow-up",
    },
    {
      id: "mock-sharepoint-site-assessment",
      sourceType: "ONEDRIVE",
      title: "Site assessment — sludge drying.pdf",
      timestamp: fileAt.toISOString(),
      snippet:
        "Draft drying balance for the municipal sludge line. Figures are preliminary and not a quote.",
      webUrl:
        "https://contoso.sharepoint.com/sites/projects/Shared%20Documents/site-assessment-sludge-drying.pdf",
    },
  ];
}

export async function searchInternalContext(
  query: string,
  userAccessToken: string,
): Promise<GraphSearchResultItem[]> {
  const trimmedQuery = query.trim();
  const token = userAccessToken.trim();
  if (!trimmedQuery || !token) return [];

  try {
    const response = await fetch(GRAPH_SEARCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            entityTypes: ["message", "driveItem", "chatMessage"],
            query: { queryString: trimmedQuery },
            from: 0,
            size: 5,
            sortProperties: [{ name: "lastModifiedDateTime", isDescending: true }],
          },
        ],
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) return [];
    const payload: unknown = await response.json();
    return mapGraphSearchResponse(payload);
  } catch {
    return [];
  }
}
