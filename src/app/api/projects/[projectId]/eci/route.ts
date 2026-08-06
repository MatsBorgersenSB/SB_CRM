import { NextResponse } from "next/server";
import {
  getEciProjectSummary,
  logEciInstrumentTag,
  toggleEciSignOff,
  type EciInstrumentType,
  type EciIoType,
} from "@/lib/execution/eci-traceability";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

type EciPostBody = {
  action?: "upsert" | "toggle";
  id?: string;
  tagId?: string;
  field?: "isCalibrated" | "loopChecked";
  value?: boolean;
  tagNumber?: string;
  description?: string;
  instrumentType?: EciInstrumentType;
  ioType?: EciIoType;
  exRating?: string | null;
  isCalibrated?: boolean;
  loopChecked?: boolean;
  locationZone?: string | null;
};

const ALLOWED_INSTRUMENT = new Set<EciInstrumentType>([
  "TEMPERATURE",
  "PRESSURE",
  "GAS_ANALYZER",
  "VALVE_ACTUATOR",
  "LEVEL_SENSOR",
  "FLOW_METER",
  "SAFETY_SWITCH",
]);

const ALLOWED_IO = new Set<EciIoType>([
  "DIGITAL_INPUT",
  "DIGITAL_OUTPUT",
  "ANALOG_INPUT",
  "ANALOG_OUTPUT",
  "MODBUS_RS485",
  "PROFINET",
]);

/**
 * GET /api/projects/[projectId]/eci
 */
export async function GET(_request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  if (!projectId?.trim()) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  try {
    const summary = await getEciProjectSummary(projectId.trim());
    return NextResponse.json({ summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load EC&I tags";
    const status = message === "Project not found" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/**
 * POST /api/projects/[projectId]/eci
 * action=upsert (default): create/update tag
 * action=toggle: flip calibration or loop check
 */
export async function POST(request: Request, context: RouteContext) {
  const { projectId } = await context.params;
  if (!projectId?.trim()) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  let body: EciPostBody;
  try {
    body = (await request.json()) as EciPostBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const action = body.action ?? "upsert";

  try {
    if (action === "toggle") {
      if (!body.tagId?.trim()) {
        return NextResponse.json({ error: "tagId is required" }, { status: 400 });
      }
      if (body.field !== "isCalibrated" && body.field !== "loopChecked") {
        return NextResponse.json(
          { error: "field must be isCalibrated | loopChecked" },
          { status: 400 },
        );
      }
      if (typeof body.value !== "boolean") {
        return NextResponse.json({ error: "value must be boolean" }, { status: 400 });
      }

      const tag = await toggleEciSignOff({
        projectId: projectId.trim(),
        tagId: body.tagId.trim(),
        field: body.field,
        value: body.value,
      });
      const summary = await getEciProjectSummary(projectId.trim());
      return NextResponse.json({ tag, summary });
    }

    if (!body.tagNumber?.trim()) {
      return NextResponse.json({ error: "tagNumber is required" }, { status: 400 });
    }
    if (!body.description?.trim()) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }
    if (!body.instrumentType || !ALLOWED_INSTRUMENT.has(body.instrumentType)) {
      return NextResponse.json(
        { error: "instrumentType is invalid" },
        { status: 400 },
      );
    }
    if (!body.ioType || !ALLOWED_IO.has(body.ioType)) {
      return NextResponse.json({ error: "ioType is invalid" }, { status: 400 });
    }

    const tag = await logEciInstrumentTag({
      projectId: projectId.trim(),
      id: body.id,
      tagNumber: body.tagNumber,
      description: body.description,
      instrumentType: body.instrumentType,
      ioType: body.ioType,
      exRating: body.exRating,
      isCalibrated: body.isCalibrated,
      loopChecked: body.loopChecked,
      locationZone: body.locationZone,
    });
    const summary = await getEciProjectSummary(projectId.trim());
    return NextResponse.json({ tag, summary }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update EC&I tag";
    const status =
      message === "Project not found" || message === "Instrument tag not found"
        ? 404
        : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
