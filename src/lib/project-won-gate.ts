import { NextResponse } from "next/server";
import { projectWonGateBlockers } from "@/lib/project-conditions";
import type { PipelineRow } from "@/types/pipeline";

/**
 * FS-022 Won gate for deal PATCH routes. Returns a 422 response naming each
 * unconfirmed project condition (with why it matters), or null when allowed.
 */
export function projectWonGateResponse(
  before: PipelineRow | null,
  patch: Partial<PipelineRow>,
): NextResponse | null {
  if (!before) return null;
  const blockers = projectWonGateBlockers(before, patch);
  if (blockers.length === 0) return null;

  return NextResponse.json(
    {
      code: "PROJECT_CONDITIONS_UNCONFIRMED",
      error: `Not ready for Won — ${blockers.map((b) => b.label.toLowerCase()).join(", ")} not confirmed. No project without all eight conditions.`,
      blockers: blockers.map((b) => ({
        id: b.id,
        label: b.label,
        status: b.status,
        missing: b.missingLabels,
        whyItMatters: b.whyItMatters,
        recommendedAction: b.recommendedAction,
      })),
    },
    { status: 422 },
  );
}