import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { extractMeetingInsights } from "@/lib/ai/meeting-intelligence";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";

/**
 * POST /api/ai/meeting-summary
 * Body: { rawNotes, opportunityId?, entityId? }
 */
export async function POST(request: Request) {
  const role = getRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      rawNotes?: string;
      opportunityId?: string;
      entityId?: string;
    };

    const rawNotes = body.rawNotes?.trim() ?? "";
    if (!rawNotes) {
      return NextResponse.json(
        { error: "rawNotes is required" },
        { status: 400 },
      );
    }

    const insights = extractMeetingInsights(rawNotes);

    const entityId =
      body.opportunityId?.trim() ||
      body.entityId?.trim() ||
      "meeting-notes";

    const actor = resolveAuditActor(request, role);
    await logAuditEvent({
      ...actor,
      action: "MEETING_ANALYZED",
      entityType: "Meeting",
      entityId,
      ipAddress: clientIpFromRequest(request),
      metadata: {
        commitmentCount: insights.keyCommitments.length,
        actionItemCount: insights.actionItems.length,
        sentimentLabel: insights.sentimentLabel,
        confidenceScore: insights.confidenceScore,
      },
    });

    return NextResponse.json({ success: true, insights });
  } catch (error) {
    console.error("[ai/meeting-summary]", error);
    return NextResponse.json(
      { error: "Failed to analyze meeting notes" },
      { status: 500 },
    );
  }
}
