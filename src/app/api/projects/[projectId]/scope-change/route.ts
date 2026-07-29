import { NextResponse } from "next/server";
import {
  listProjectScopeChanges,
  logEngineeringChangeOrder,
  type ScopeChangeRequestSource,
  type ScopeChangeStatus,
} from "@/lib/execution/scope-change";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

type ScopeChangeBody = {
  changeTitle?: string;
  requestedBy?: ScopeChangeRequestSource | string;
  description?: string;
  costImpactEur?: number;
  scheduleImpactDays?: number;
  status?: ScopeChangeStatus;
  approvedBy?: string | null;
};

/**
 * GET /api/projects/[projectId]/scope-change
 * Returns change orders with cumulative cost/schedule deltas.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  if (!projectId?.trim()) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  try {
    const summary = await listProjectScopeChanges(projectId.trim());
    return NextResponse.json({ summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load scope changes";
    const status = message === "Project not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/projects/[projectId]/scope-change
 * Logs a new Engineering Change Order and Decision Journal entry.
 */
export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  if (!projectId?.trim()) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  let body: ScopeChangeBody;
  try {
    body = (await request.json()) as ScopeChangeBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.changeTitle?.trim()) {
    return NextResponse.json({ error: "changeTitle is required" }, { status: 400 });
  }
  if (!body.description?.trim()) {
    return NextResponse.json({ error: "description is required" }, { status: 400 });
  }
  if (!body.requestedBy?.trim()) {
    return NextResponse.json({ error: "requestedBy is required" }, { status: 400 });
  }
  if (typeof body.costImpactEur !== "number" || !Number.isFinite(body.costImpactEur)) {
    return NextResponse.json(
      { error: "costImpactEur must be a number" },
      { status: 400 },
    );
  }
  if (
    typeof body.scheduleImpactDays !== "number" ||
    !Number.isFinite(body.scheduleImpactDays)
  ) {
    return NextResponse.json(
      { error: "scheduleImpactDays must be a number" },
      { status: 400 },
    );
  }

  try {
    const result = await logEngineeringChangeOrder({
      projectId: projectId.trim(),
      changeTitle: body.changeTitle,
      requestedBy: body.requestedBy,
      description: body.description,
      costImpactEur: body.costImpactEur,
      scheduleImpactDays: body.scheduleImpactDays,
      status: body.status,
      approvedBy: body.approvedBy,
    });
    const summary = await listProjectScopeChanges(projectId.trim());
    return NextResponse.json(
      {
        scopeChange: result.scopeChange,
        decisionJournalId: result.decisionJournalId,
        summary,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to log scope change";
    const status = message === "Project not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
