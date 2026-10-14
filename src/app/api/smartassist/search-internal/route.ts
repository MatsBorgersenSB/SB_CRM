import { NextResponse } from "next/server";
import {
  mockGraphSearchResults,
  searchInternalContext,
  truncateSnippet,
  type GraphSearchResultItem,
} from "@/lib/smartassist/graphSearch";
import { resolveUserGraphToken } from "@/lib/smartassist/session-graph-token";

export const dynamic = "force-dynamic";

function mockEnabled(): boolean {
  return process.env.MOCK_GRAPH_SEARCH === "true";
}

function jsonItems(items: GraphSearchResultItem[], status = 200) {
  const trimmed = items.map((item) => ({
    ...item,
    snippet: truncateSnippet(item.snippet),
  }));
  return NextResponse.json(
    { success: true, count: trimmed.length, items: trimmed },
    { status },
  );
}

export async function POST(request: Request) {
  let body: { query?: unknown };
  try {
    body = (await request.json()) as { query?: unknown };
  } catch {
    return NextResponse.json(
      { error: "QUERY_REQUIRED", items: [] },
      { status: 400 },
    );
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return NextResponse.json(
      { error: "QUERY_REQUIRED", items: [] },
      { status: 400 },
    );
  }

  if (mockEnabled()) {
    return jsonItems(mockGraphSearchResults());
  }

  const accessToken = await resolveUserGraphToken(request);
  if (!accessToken) {
    if (process.env.NODE_ENV === "development") {
      return jsonItems(mockGraphSearchResults());
    }
    return NextResponse.json(
      { error: "MISSING_M365_TOKEN", items: [] },
      { status: 401 },
    );
  }

  const items = await searchInternalContext(query, accessToken);
  return jsonItems(items);
}
