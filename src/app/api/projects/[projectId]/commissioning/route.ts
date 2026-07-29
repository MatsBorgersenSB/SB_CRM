import { NextResponse } from "next/server";
import {
  getCommissioningSummary,
  recordCommissioningLog,
  type CommissioningPhase,
} from "@/lib/execution/site-commissioning";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

type CommissioningBody = {
  phase?: CommissioningPhase;
  safetyCheckPassed?: boolean;
  atexZoningVerified?: boolean;
  logTitle?: string;
  operationalNotes?: string | null;
  issuesEncountered?: string | null;
  loggedBy?: string | null;
};

const ALLOWED_PHASES = new Set<CommissioningPhase>([
  "COLD_COMMISSIONING",
  "HOT_COMMISSIONING",
  "SYNGAS_TESTING",
  "PERFORMANCE_RUN",
]);

/**
 * GET /api/projects/[projectId]/commissioning
 */
export async function GET(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  if (!projectId?.trim()) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  try {
    const summary = await getCommissioningSummary(projectId.trim());
    return NextResponse.json({ summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load commissioning logs";
    const status = message === "Project not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/projects/[projectId]/commissioning
 */
export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  if (!projectId?.trim()) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  let body: CommissioningBody;
  try {
    body = (await request.json()) as CommissioningBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.logTitle?.trim()) {
    return NextResponse.json({ error: "logTitle is required" }, { status: 400 });
  }
  if (!body.phase || !ALLOWED_PHASES.has(body.phase)) {
    return NextResponse.json(
      {
        error:
          "phase must be COLD_COMMISSIONING | HOT_COMMISSIONING | SYNGAS_TESTING | PERFORMANCE_RUN",
      },
      { status: 400 },
    );
  }

  try {
    const result = await recordCommissioningLog({
      projectId: projectId.trim(),
      phase: body.phase,
      safetyCheckPassed: Boolean(body.safetyCheckPassed),
      atexZoningVerified: Boolean(body.atexZoningVerified),
      logTitle: body.logTitle,
      operationalNotes: body.operationalNotes,
      issuesEncountered: body.issuesEncountered,
      loggedBy: body.loggedBy,
    });
    const summary = await getCommissioningSummary(projectId.trim());
    return NextResponse.json(
      {
        commissioningLog: result.commissioningLog,
        projectHealthStatus: result.projectHealthStatus,
        safetyItemId: result.safetyItemId,
        summary,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to record commissioning log";
    const status = message === "Project not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
