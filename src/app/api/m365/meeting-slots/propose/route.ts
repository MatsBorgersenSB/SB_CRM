import { NextResponse } from "next/server";
import { createActivityRecord } from "@/lib/activity-store";
import {
  createM365DraftEmail,
  generateOutlookDeepLink,
  outlookDraftComposeHref,
} from "@/lib/m365-client";
import {
  buildSlotProposalEmailHtml,
  createTentativeHoldEvent,
  formatSlotLabelCet,
  generateProposalToken,
  resolveOrganizerAccessToken,
} from "@/lib/m365/meeting-slot-scheduler";
import type {
  CreateActivityInput,
  MeetingSlotOption,
  MeetingSlotProposal,
} from "@/types/activity";

function htmlToPlain(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&rarr;/g, "->")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * POST /api/m365/meeting-slots/propose
 * Creates the SmartCRM Activity with `SlotProposal`, places optional tentative
 * Outlook calendar holds, and prepares an Outlook draft with interactive slot links.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      activityInput: CreateActivityInput;
      slots: Array<{ id?: string; startIso: string; endIso: string; confidence?: number }>;
      holdOnCalendar?: boolean;
      toEmail?: string;
      recipientName?: string;
      organizerName?: string;
      organizerEmail?: string;
      attendeeEmails?: string[];
      internalColleagueEmails?: string[];
    };

    const rawSlots = (body.slots ?? []).filter(
      (s) => s?.startIso && s?.endIso && !Number.isNaN(new Date(s.startIso).getTime()),
    );
    if (rawSlots.length === 0) {
      return NextResponse.json(
        { error: "At least one valid meeting time slot is required." },
        { status: 400 },
      );
    }

    const token = generateProposalToken();
    const holdOnCalendar = body.holdOnCalendar !== false;
    const durationMinutes = body.activityInput?.DurationMinutes ?? 45;
    const subject = body.activityInput?.Subject?.trim() || "Standard Bio Meeting";
    const organizerName =
      body.organizerName?.trim() ||
      body.activityInput?.ActivityOwner?.Title?.trim() ||
      "Standard Bio";

    const origin =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
      new URL(request.url).origin;

    const organizerAuth = await resolveOrganizerAccessToken();

    const preparedSlots: MeetingSlotOption[] = [];
    for (let idx = 0; idx < rawSlots.length; idx += 1) {
      const candidate = rawSlots[idx]!;
      let holdEventId: string | null = null;
      if (holdOnCalendar && organizerAuth?.accessToken) {
        holdEventId = await createTentativeHoldEvent({
          accessToken: organizerAuth.accessToken,
          subject,
          startIso: candidate.startIso,
          endIso: candidate.endIso,
          bodyText: `Tentative hold while awaiting client slot selection in SmartCRM.\nBooking page: ${origin}/meet/${token}`,
        });
      }
      preparedSlots.push({
        id: candidate.id?.trim() || `slot-${idx + 1}`,
        startIso: candidate.startIso,
        endIso: candidate.endIso,
        confidence: candidate.confidence,
        holdEventId,
      });
    }

    const attendeeEmails = Array.from(
      new Set(
        [
          ...(body.attendeeEmails ?? []),
          ...(body.toEmail ? [body.toEmail] : []),
        ]
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.includes("@")),
      ),
    );

    const emailHtml = buildSlotProposalEmailHtml({
      recipientName: body.recipientName,
      subject,
      agendaText: body.activityInput?.ActivityDescription,
      organizerName,
      durationMinutes,
      baseUrl: origin,
      token,
      slots: preparedSlots,
    });

    const primaryRecipient =
      body.toEmail?.trim() || attendeeEmails[0] || "";

    let draftWebLink: string | null = null;
    let draftMode: "graph_draft" | "deep_link" = "deep_link";

    if (organizerAuth?.integrationId && primaryRecipient) {
      try {
        const draft = await createM365DraftEmail({
          integrationId: organizerAuth.integrationId,
          toEmail: primaryRecipient,
          subject: `Meeting times: ${subject}`,
          bodyHtml: emailHtml,
        });
        draftWebLink = outlookDraftComposeHref(draft.draftId);
        draftMode = "graph_draft";
      } catch (error) {
        console.warn(
          "[meeting-slots/propose] Graph draft creation failed, using deeplink:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    if (!draftWebLink) {
      draftWebLink = generateOutlookDeepLink({
        toEmail: primaryRecipient,
        subject: `Meeting times: ${subject}`,
        body: htmlToPlain(emailHtml),
      });
    }

    const slotProposal: MeetingSlotProposal = {
      token,
      status: "pending_client_choice",
      createdAt: new Date().toISOString(),
      holdOnCalendar,
      durationMinutes,
      organizerName,
      organizerEmail: body.organizerEmail?.trim() || null,
      integrationId: organizerAuth?.integrationId ?? null,
      attendeeEmails,
      internalColleagueEmails: body.internalColleagueEmails ?? [],
      slots: preparedSlots,
      draftWebLink,
    };

    const firstSlot = preparedSlots[0]!;
    const slotSummaryLines = preparedSlots
      .map((s) => `• ${formatSlotLabelCet(s)}`)
      .join("\n");

    const createdActivity = await createActivityRecord({
      ...body.activityInput,
      ActivityDate: firstSlot.startIso,
      DurationMinutes: durationMinutes,
      NextAction:
        body.activityInput.NextAction?.trim() ||
        "Awaiting client selection from proposed meeting times",
      SlotProposal: slotProposal,
      ActivityDescription: [
        body.activityInput.ActivityDescription?.trim() || "",
        `Proposed slots (${holdOnCalendar ? "held tentatively on Outlook" : "awaiting confirmation"}):\n${slotSummaryLines}`,
      ]
        .filter(Boolean)
        .join("\n\n"),
    });

    return NextResponse.json({
      activity: createdActivity,
      proposal: slotProposal,
      bookingPageUrl: `${origin}/meet/${token}`,
      openUrl: draftWebLink,
      draftMode,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not create meeting slot proposal.",
      },
      { status: 500 },
    );
  }
}
