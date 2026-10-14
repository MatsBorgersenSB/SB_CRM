import { NextResponse } from "next/server";
import { mockGraphSearchResults, searchInternalContext } from "@/lib/smartassist/graphSearch";
import { resolveTaskContext } from "@/lib/smartassist/omniOrchestrator";
import { resolveUserGraphToken } from "@/lib/smartassist/session-graph-token";
import type { GraphSearchResultItem } from "@/lib/smartassist/graphSearch";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { taskDescription?: unknown; dateLimit?: unknown };
  try {
    body = (await request.json()) as { taskDescription?: unknown; dateLimit?: unknown };
  } catch {
    return NextResponse.json({ error: "TASK_REQUIRED", success: false }, { status: 400 });
  }

  const taskDescription =
    typeof body.taskDescription === "string" ? body.taskDescription.trim() : "";
  if (!taskDescription) {
    return NextResponse.json({ error: "TASK_REQUIRED", success: false }, { status: 400 });
  }
  const dateLimit = typeof body.dateLimit === "string" ? body.dateLimit.trim() : undefined;

  let internalHits: GraphSearchResultItem[] = [];
  try {
    if (process.env.MOCK_GRAPH_SEARCH === "true") {
      internalHits = mockGraphSearchResults();
    } else {
      const token = await resolveUserGraphToken(request);
      if (token) {
        internalHits = await searchInternalContext(taskDescription, token);
      }
    }
  } catch {
    internalHits = [];
  }

  try {
    const resolution = await resolveTaskContext({
      taskDescription,
      ...(dateLimit ? { dateLimit } : {}),
      internalHits,
    });
    return NextResponse.json({ success: true, resolution });
  } catch {
    const resolution = await resolveTaskContext({
      taskDescription,
      ...(dateLimit ? { dateLimit } : {}),
      internalHits: [],
    }).catch(() => null);
    if (!resolution) {
      return NextResponse.json(
        { success: false, error: "RESOLUTION_FAILED" },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true, resolution });
  }
}
