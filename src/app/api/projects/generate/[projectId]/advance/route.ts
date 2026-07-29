import { NextResponse } from "next/server";
import { advanceStageGate } from "@/lib/execution/project-generator";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

/**
 * POST /api/projects/generate/[projectId]/advance
 * Completes the current stage-gate and advances to the next.
 */
export async function POST(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  if (!projectId?.trim()) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  try {
    const project = await advanceStageGate(projectId.trim());
    return NextResponse.json({ project });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to advance stage gate";
    const status = message === "Project not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
