import { NextResponse } from "next/server";
import { evaluateCriticalPath } from "@/lib/execution/critical-path";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

/**
 * GET /api/projects/[projectId]/bottlenecks
 * Returns critical-path bottleneck and COD delay analysis.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  if (!projectId?.trim()) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  try {
    const analysis = await evaluateCriticalPath(projectId.trim());
    return NextResponse.json({ analysis });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to evaluate critical path";
    const status = message === "Project not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
