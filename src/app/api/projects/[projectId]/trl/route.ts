import { NextResponse } from "next/server";
import {
  getTrlProgressionSummary,
  logRdExperiment,
  type IpFilingStatus,
} from "@/lib/execution/trl-tracker";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

type TrlBody = {
  experimentTitle?: string;
  trlStage?: number;
  feedstockType?: string | null;
  reactorTempCelsius?: number | null;
  residenceTimeMinutes?: number | null;
  yieldPercentage?: number | null;
  ipFilingStatus?: IpFilingStatus;
  keyFindings?: string;
  loggedBy?: string | null;
  validatesTargetCriteria?: boolean;
};

const ALLOWED_IP = new Set<IpFilingStatus>([
  "NONE",
  "PROVISIONAL_FILED",
  "PATENT_GRANTED",
  "TRADE_SECRET",
]);

/**
 * GET /api/projects/[projectId]/trl
 */
export async function GET(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  if (!projectId?.trim()) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  try {
    const summary = await getTrlProgressionSummary(projectId.trim());
    return NextResponse.json({ summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load TRL history";
    const status = message === "Project not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/projects/[projectId]/trl
 */
export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  if (!projectId?.trim()) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  let body: TrlBody;
  try {
    body = (await request.json()) as TrlBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.experimentTitle?.trim()) {
    return NextResponse.json(
      { error: "experimentTitle is required" },
      { status: 400 },
    );
  }
  if (!body.keyFindings?.trim()) {
    return NextResponse.json({ error: "keyFindings is required" }, { status: 400 });
  }
  if (typeof body.trlStage !== "number") {
    return NextResponse.json({ error: "trlStage is required" }, { status: 400 });
  }
  if (body.ipFilingStatus && !ALLOWED_IP.has(body.ipFilingStatus)) {
    return NextResponse.json(
      {
        error:
          "ipFilingStatus must be NONE | PROVISIONAL_FILED | PATENT_GRANTED | TRADE_SECRET",
      },
      { status: 400 },
    );
  }

  try {
    const result = await logRdExperiment({
      projectId: projectId.trim(),
      experimentTitle: body.experimentTitle,
      trlStage: body.trlStage,
      feedstockType: body.feedstockType,
      reactorTempCelsius: body.reactorTempCelsius,
      residenceTimeMinutes: body.residenceTimeMinutes,
      yieldPercentage: body.yieldPercentage,
      ipFilingStatus: body.ipFilingStatus,
      keyFindings: body.keyFindings,
      loggedBy: body.loggedBy,
      validatesTargetCriteria: body.validatesTargetCriteria,
    });
    const summary = await getTrlProgressionSummary(projectId.trim());
    return NextResponse.json(
      {
        experimentLog: result.experimentLog,
        updatedTrlLevel: result.updatedTrlLevel,
        summary,
      },
      { status: 201 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to log R&D experiment";
    const status =
      message === "Project not found"
        ? 404
        : message.includes("INTERNAL_RD") || message.includes("trlStage")
          ? 400
          : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
