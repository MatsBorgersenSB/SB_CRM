import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { applyMeetingTranscriptNotes } from "@/lib/meeting-transcript-notes";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";

/**
 * FS-014 — POST /api/m365/meeting-notes/from-transcript
 * Body: { transcript, opportunityId?, companyId?, meetingId?, subject? }
 * Propose only — commitments stay `proposed` until user Approves.
 */
export async function POST(request: Request) {
  const role = getRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      transcript?: string;
      opportunityId?: string;
      companyId?: string;
      meetingId?: string;
      subject?: string;
      organizerEmail?: string;
      startTime?: string;
      endTime?: string;
    };

    const transcript = body.transcript?.trim() ?? "";
    if (!transcript) {
      return NextResponse.json({ error: "transcript is required" }, { status: 400 });
    }

    const result = await applyMeetingTranscriptNotes({
      transcript,
      opportunityId: body.opportunityId,
      companyId: body.companyId,
      meetingId: body.meetingId,
      subject: body.subject,
      organizerEmail: body.organizerEmail,
      startTime: body.startTime,
      endTime: body.endTime,
    });

    const actor = resolveAuditActor(request, role);
    await logAuditEvent({
      ...actor,
      action: "MEETING_TRANSCRIPT_IMPORTED",
      entityType: "Meeting",
      entityId: result.meeting.id,
      ipAddress: clientIpFromRequest(request),
      metadata: {
        createdMeeting: result.createdMeeting,
        proposedCommitmentCount: result.proposedCommitmentCount,
        speakerCount: result.speakersObserved.length,
        confidenceScore: result.insights.confidenceScore,
      },
    });

    return NextResponse.json({
      success: true,
      ...result,
      nextStep:
        result.proposedCommitmentCount > 0
          ? "Review proposed commitments and Approve only what is real."
          : "No clear commitments found — summary saved for review.",
    });
  } catch (error) {
    console.error("[meeting-notes/from-transcript]", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to import meeting transcript",
      },
      { status: 500 },
    );
  }
}
