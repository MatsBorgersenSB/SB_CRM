import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import {
  findSavedMeetingActivity,
  resolveMeetingEventForMessage,
  saveOutlookMeetingAsActivity,
  toSavedMeetingSummary,
} from "@/lib/m365/outlook-meeting-capture";
import { resolveM365PaneCompany } from "@/lib/m365/pane-context";
import { getPrisma } from "@/lib/prisma";

/**
 * Outlook add-in: is this mail (and the meeting behind it) already in SmartCRM — and save it.
 *
 * GET  ?externalMessageId=&subject=&conversationId=
 *   → { mailSaved, isMeeting, meeting: {activityId, subject, startDate} | null, event: {...} | null }
 * POST { contactId?, email?, seed: { externalMessageId, conversationId, subject } }
 *   → { ok, created, meeting }
 */
export async function GET(request: Request) {
  const role = await resolveRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const externalMessageId = searchParams.get("externalMessageId")?.trim() ?? "";
  if (!externalMessageId) {
    return NextResponse.json({ error: "externalMessageId is required" }, { status: 400 });
  }

  try {
    const prisma = getPrisma();
    const stored = await prisma.emailMessageRecord.findFirst({
      where: { externalMessageId },
      select: { id: true },
    });

    const { isMeeting, event } = await resolveMeetingEventForMessage({
      externalMessageId,
      subject: searchParams.get("subject") ?? undefined,
      conversationId: searchParams.get("conversationId") ?? undefined,
    });

    const saved = isMeeting
      ? await findSavedMeetingActivity({ eventId: event?.id, externalMessageId })
      : null;

    return NextResponse.json({
      mailSaved: Boolean(stored),
      isMeeting,
      eventSubject: event?.subject ?? null,
      eventStart: event?.start?.dateTime ?? null,
      meeting: saved ? toSavedMeetingSummary(saved) : null,
    });
  } catch (error) {
    console.error("[m365 outlook save-meeting GET]", error);
    return NextResponse.json(
      {
        error: "Failed to check SmartCRM",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const role = await resolveRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      contactId?: string;
      email?: string;
      seed?: { externalMessageId?: string; conversationId?: string; subject?: string };
    };
    const externalMessageId = body.seed?.externalMessageId?.trim();
    if (!externalMessageId) {
      return NextResponse.json(
        { error: "Open the meeting mail in Outlook and try again." },
        { status: 400 },
      );
    }

    const resolved = await resolveM365PaneCompany({
      email: body.email || undefined,
      contactId: body.contactId || undefined,
    });
    if (!resolved?.company) {
      return NextResponse.json(
        { error: "No matching company in SmartCRM for this meeting." },
        { status: 404 },
      );
    }

    const seed = {
      externalMessageId,
      conversationId: body.seed?.conversationId?.trim() || undefined,
      subject: body.seed?.subject?.trim() || undefined,
    };
    const { isMeeting, event } = await resolveMeetingEventForMessage(seed);
    if (!event) {
      return NextResponse.json(
        {
          error: isMeeting
            ? "Could not find this meeting in your Outlook calendar. Open it from your calendar and try again."
            : "This mail is not a meeting invitation or response.",
        },
        { status: 404 },
      );
    }

    const { activity, created } = await saveOutlookMeetingAsActivity({
      seed,
      event,
      companyId: resolved.company.CompanyID,
      contactId: resolved.contact?.ContactID,
    });

    return NextResponse.json({
      ok: true,
      created,
      companyName: resolved.company.Title,
      meeting: toSavedMeetingSummary(activity),
    });
  } catch (error) {
    console.error("[m365 outlook save-meeting POST]", error);
    return NextResponse.json(
      {
        error: "Could not save the meeting in SmartCRM",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
