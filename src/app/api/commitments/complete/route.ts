import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveRequestRole } from "@/lib/api-auth";
import {
  buildCompleteCommitmentPatch,
  resolveCommitmentActivityId,
  type CompleteCommitmentMode,
  type CompleteCommitmentRequest,
} from "@/lib/complete-commitment";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { getServerSharePointServices } from "@/services/sharepoint/factory";
import type { Activity } from "@/types/activity";

function parseMode(value: unknown): CompleteCommitmentMode {
  return value === "reschedule" ? "reschedule" : "complete";
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export async function POST(request: Request) {
  const role = await resolveRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: CompleteCommitmentRequest;
  try {
    body = (await request.json()) as CompleteCommitmentRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const activityId = resolveCommitmentActivityId(body);
  if (!activityId) {
    return NextResponse.json(
      { error: "activityId or commitmentId is required." },
      { status: 400 },
    );
  }

  const mode = parseMode(body.mode);
  const nextActionDate = body.nextActionDate?.trim() ?? "";
  if (mode === "reschedule" && !isIsoDate(nextActionDate)) {
    return NextResponse.json(
      { error: "Reschedule needs a valid due date (YYYY-MM-DD)." },
      { status: 400 },
    );
  }

  try {
    const { activities } = getServerSharePointServices();
    const existing = (await activities.getById(activityId)) as Activity;

    if (existing.ActionStatus === "Cancelled") {
      throw SharePointServiceError.conflict(
        "That commitment was cancelled — nothing to complete.",
      );
    }

    if (mode === "complete" && existing.ActionStatus === "Completed") {
      return NextResponse.json({ activity: existing, mode });
    }

    const session = await auth().catch(() => null);
    const actorLabel =
      session?.user?.name?.trim() ||
      session?.user?.email?.trim() ||
      undefined;

    const patch = buildCompleteCommitmentPatch(existing, {
      mode,
      outcomeNote: body.outcomeNote,
      nextActionDate,
      actorLabel,
    });

    const updated = await activities.update(activityId, patch);

    const actor = resolveAuditActor(request, role);
    await logAuditEvent({
      ...actor,
      action: mode === "reschedule" ? "COMMITMENT_RESCHEDULED" : "COMMITMENT_COMPLETED",
      entityType: "Activity",
      entityId: activityId,
      ipAddress: clientIpFromRequest(request),
      metadata: {
        mode,
        hasOutcomeNote: Boolean(body.outcomeNote?.trim()),
        nextActionDate: mode === "reschedule" ? nextActionDate : null,
      },
    });

    return NextResponse.json({ activity: updated, mode });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
