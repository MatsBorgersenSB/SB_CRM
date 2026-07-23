import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { getPrisma } from "@/lib/prisma";
import {
  readMeetingsForOpportunity,
  resolveOpportunityId,
} from "@/lib/meeting-intelligence-data";
import type { CommitmentState } from "@/generated/prisma";

const COMMITMENT_STATES: CommitmentState[] = [
  "proposed",
  "confirmed",
  "completed",
  "dismissed",
];

function isCommitmentState(value: unknown): value is CommitmentState {
  return typeof value === "string" && COMMITMENT_STATES.includes(value as CommitmentState);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: opportunityKey } = await params;

  try {
    const opportunityId = await resolveOpportunityId(opportunityKey);
    if (!opportunityId) {
      return NextResponse.json(
        { error: "Opportunity not found", opportunityKey, meetings: [] },
        { status: 404 },
      );
    }

    const meetings = await readMeetingsForOpportunity(opportunityId);
    return NextResponse.json({
      opportunityId,
      meetings,
    });
  } catch (error) {
    console.error("[meetings GET]", error);
    // Prefer empty payload over a hard UI failure when the DB is briefly unavailable.
    return NextResponse.json(
      {
        error: "Failed to load meetings",
        detail: error instanceof Error ? error.message : "Unknown error",
        meetings: [],
      },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: opportunityKey } = await params;
  const role = getRequestRole(request);

  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      commitmentId?: string;
      status?: unknown;
      confirmedByUserId?: string | null;
    };

    if (!body.commitmentId || typeof body.commitmentId !== "string") {
      return NextResponse.json({ error: "commitmentId is required" }, { status: 400 });
    }
    if (!isCommitmentState(body.status)) {
      return NextResponse.json({ error: "Invalid commitment status" }, { status: 400 });
    }

    const prisma = getPrisma();
    const opportunityId = await resolveOpportunityId(opportunityKey);
    if (!opportunityId) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    const commitment = await prisma.meetingCommitmentRecord.findFirst({
      where: {
        id: body.commitmentId,
        meeting: { opportunityId },
      },
    });

    if (!commitment) {
      return NextResponse.json({ error: "Commitment not found" }, { status: 404 });
    }

    const nextStatus = body.status;
    const updated = await prisma.meetingCommitmentRecord.update({
      where: { id: commitment.id },
      data: {
        status: nextStatus,
        confirmedByUserId:
          nextStatus === "confirmed"
            ? body.confirmedByUserId ?? role
            : nextStatus === "proposed"
              ? null
              : commitment.confirmedByUserId,
        confirmedAt: nextStatus === "confirmed" ? new Date() : null,
      },
    });

    return NextResponse.json({
      commitment: {
        id: updated.id,
        description: updated.description,
        ownerEmail: updated.ownerEmail,
        dueDate: updated.dueDate?.toISOString() ?? null,
        status: updated.status,
        confirmedByUserId: updated.confirmedByUserId,
        confirmedAt: updated.confirmedAt?.toISOString() ?? null,
      },
    });
  } catch (error) {
    console.error("[meetings PATCH]", error);
    return NextResponse.json(
      {
        error: "Failed to update commitment",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
