import { NextResponse } from "next/server";
import {
  createAtexInterlock,
  getAtexPlcSummary,
  logInterlockVerification,
  recordPlcRelease,
  type AtexZone,
} from "@/lib/execution/atex-plc";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

type AtexPlcBody = {
  action?: "createInterlock" | "verifyInterlock" | "plcRelease";
  // Interlock create
  loopName?: string;
  atexZone?: AtexZone;
  causeDescription?: string;
  effectDescription?: string;
  // Interlock verify
  interlockId?: string;
  field?: "isDryTested" | "isWetTested";
  value?: boolean;
  verifiedBy?: string | null;
  // PLC release
  plcTargetName?: string;
  codeVersion?: string;
  backupChecksum?: string | null;
  notes?: string | null;
  totalLoopsCount?: number;
  verifiedLoopsCount?: number;
  deployedBy?: string | null;
};

const ALLOWED_ZONES = new Set<AtexZone>([
  "ZONE_0",
  "ZONE_1",
  "ZONE_2",
  "SAFE_AREA",
]);

/**
 * GET /api/projects/[projectId]/atex-plc
 */
export async function GET(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  if (!projectId?.trim()) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  try {
    const summary = await getAtexPlcSummary(projectId.trim());
    return NextResponse.json({ summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load ATEX/PLC data";
    const status = message === "Project not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/projects/[projectId]/atex-plc
 */
export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  if (!projectId?.trim()) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  let body: AtexPlcBody;
  try {
    body = (await request.json()) as AtexPlcBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const action = body.action ?? "createInterlock";

  try {
    if (action === "verifyInterlock") {
      if (!body.interlockId?.trim()) {
        return NextResponse.json(
          { error: "interlockId is required" },
          { status: 400 },
        );
      }
      if (body.field !== "isDryTested" && body.field !== "isWetTested") {
        return NextResponse.json(
          { error: "field must be isDryTested | isWetTested" },
          { status: 400 },
        );
      }
      if (typeof body.value !== "boolean") {
        return NextResponse.json({ error: "value must be boolean" }, { status: 400 });
      }

      const interlock = await logInterlockVerification(body.interlockId.trim(), {
        projectId: projectId.trim(),
        field: body.field,
        value: body.value,
        verifiedBy: body.verifiedBy,
      });
      const summary = await getAtexPlcSummary(projectId.trim());
      return NextResponse.json({ interlock, summary });
    }

    if (action === "plcRelease") {
      if (!body.plcTargetName?.trim() || !body.codeVersion?.trim()) {
        return NextResponse.json(
          { error: "plcTargetName and codeVersion are required" },
          { status: 400 },
        );
      }
      const release = await recordPlcRelease({
        projectId: projectId.trim(),
        plcTargetName: body.plcTargetName,
        codeVersion: body.codeVersion,
        backupChecksum: body.backupChecksum,
        notes: body.notes,
        totalLoopsCount: body.totalLoopsCount,
        verifiedLoopsCount: body.verifiedLoopsCount,
        deployedBy: body.deployedBy,
      });
      const summary = await getAtexPlcSummary(projectId.trim());
      return NextResponse.json({ release, summary }, { status: 201 });
    }

    // createInterlock
    if (!body.loopName?.trim()) {
      return NextResponse.json({ error: "loopName is required" }, { status: 400 });
    }
    if (!body.causeDescription?.trim() || !body.effectDescription?.trim()) {
      return NextResponse.json(
        { error: "causeDescription and effectDescription are required" },
        { status: 400 },
      );
    }
    if (!body.atexZone || !ALLOWED_ZONES.has(body.atexZone)) {
      return NextResponse.json(
        { error: "atexZone must be ZONE_0 | ZONE_1 | ZONE_2 | SAFE_AREA" },
        { status: 400 },
      );
    }

    const interlock = await createAtexInterlock({
      projectId: projectId.trim(),
      loopName: body.loopName,
      atexZone: body.atexZone,
      causeDescription: body.causeDescription,
      effectDescription: body.effectDescription,
    });
    const summary = await getAtexPlcSummary(projectId.trim());
    return NextResponse.json({ interlock, summary }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update ATEX/PLC data";
    const status =
      message === "Project not found" || message === "Interlock not found"
        ? 404
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
