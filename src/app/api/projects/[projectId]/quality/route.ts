import { NextResponse } from "next/server";
import {
  getProjectQualitySummary,
  logQualityInspection,
  resolveQualityNcr,
  type QualityInspectionStatus,
  type QualityInspectionType,
} from "@/lib/execution/quality-guardian";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

type QualityPostBody = {
  action?: "log" | "resolve";
  inspectionId?: string;
  milestoneId?: string | null;
  inspectionType?: QualityInspectionType;
  status?: QualityInspectionStatus;
  title?: string;
  ncrDescription?: string | null;
  remediationPlan?: string | null;
  inspectorName?: string | null;
};

const ALLOWED_TYPES = new Set<QualityInspectionType>([
  "FAT_FACTORY_TEST",
  "SAT_SITE_TEST",
  "ISO_QUALITY_AUDIT",
  "SAFETY_CHECK",
]);

const ALLOWED_STATUSES = new Set<QualityInspectionStatus>([
  "PASSED",
  "FAILED_NCR",
  "PENDING_REMEDIATION",
]);

/**
 * GET /api/projects/[projectId]/quality
 * Returns all quality inspections and open NCRs for a project.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  if (!projectId?.trim()) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  try {
    const summary = await getProjectQualitySummary(projectId.trim());
    return NextResponse.json({ summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load quality data";
    const status = message === "Project not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/projects/[projectId]/quality
 * action=log (default): log a new inspection
 * action=resolve: close an open NCR
 */
export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  if (!projectId?.trim()) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  let body: QualityPostBody;
  try {
    body = (await request.json()) as QualityPostBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const action = body.action ?? "log";

  try {
    if (action === "resolve") {
      if (!body.inspectionId?.trim()) {
        return NextResponse.json(
          { error: "inspectionId is required to resolve an NCR" },
          { status: 400 },
        );
      }
      const inspection = await resolveQualityNcr({
        projectId: projectId.trim(),
        inspectionId: body.inspectionId.trim(),
        remediationPlan: body.remediationPlan,
        inspectorName: body.inspectorName,
      });
      const summary = await getProjectQualitySummary(projectId.trim());
      return NextResponse.json({ inspection, summary });
    }

    if (!body.title?.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (!body.inspectionType || !ALLOWED_TYPES.has(body.inspectionType)) {
      return NextResponse.json(
        {
          error:
            "inspectionType must be FAT_FACTORY_TEST | SAT_SITE_TEST | ISO_QUALITY_AUDIT | SAFETY_CHECK",
        },
        { status: 400 },
      );
    }
    if (!body.status || !ALLOWED_STATUSES.has(body.status)) {
      return NextResponse.json(
        {
          error: "status must be PASSED | FAILED_NCR | PENDING_REMEDIATION",
        },
        { status: 400 },
      );
    }

    const inspection = await logQualityInspection({
      projectId: projectId.trim(),
      milestoneId: body.milestoneId ?? null,
      inspectionType: body.inspectionType,
      status: body.status,
      title: body.title,
      ncrDescription: body.ncrDescription,
      remediationPlan: body.remediationPlan,
      inspectorName: body.inspectorName,
    });
    const summary = await getProjectQualitySummary(projectId.trim());
    return NextResponse.json({ inspection, summary }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update quality record";
    const status =
      message === "Project not found" ||
      message === "Inspection not found" ||
      message === "Milestone not found on this project"
        ? 404
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
