import { NextResponse } from "next/server";
import { updateActivityRecord } from "@/lib/activity-store";
import {
  createConfirmedTeamsMeetingWithToken,
  deleteTentativeHoldEvents,
  findActivityByProposalToken,
  formatSlotLabelCet,
  resolveOrganizerAccessToken,
} from "@/lib/m365/meeting-slot-scheduler";
import { getPrisma } from "@/lib/prisma";

function sanitizePublicPayload(activity: NonNullable<Awaited<ReturnType<typeof findActivityByProposalToken>>>) {
  const proposal = activity.SlotProposal!;
  return {
    activityId: activity.ActivityID,
    subject: activity.Subject || "Standard Bio Meeting",
    companyName: activity.Company?.Title ?? activity.ProjectName ?? null,
    organizerName: proposal.organizerName || "Standard Bio",
    durationMinutes: proposal.durationMinutes || activity.DurationMinutes || 45,
    status: proposal.status,
    confirmedSlotId: proposal.confirmedSlotId ?? null,
    confirmedAt: proposal.confirmedAt ?? null,
    alternativeNote: proposal.alternativeNote ?? null,
    teamsJoinUrl: activity.TeamsJoinUrl ?? null,
    slots: proposal.slots.map((slot) => ({
      id: slot.id,
      startIso: slot.startIso,
      endIso: slot.endIso,
      labelCet: formatSlotLabelCet(slot),
    })),
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const activity = await findActivityByProposalToken(token);
  if (!activity?.SlotProposal) {
    return NextResponse.json(
      { error: "This meeting link was not found or has expired." },
      { status: 404 },
    );
  }

  return NextResponse.json(sanitizePublicPayload(activity));
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const activity = await findActivityByProposalToken(token);
  if (!activity?.SlotProposal) {
    return NextResponse.json(
      { error: "This meeting link was not found or has expired." },
      { status: 404 },
    );
  }

  const proposal = activity.SlotProposal;
  if (proposal.status === "confirmed") {
    return NextResponse.json({
      alreadyConfirmed: true,
      ...sanitizePublicPayload(activity),
    });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: "confirm" | "request_alternative";
    slotId?: string;
    name?: string;
    email?: string;
    note?: string;
  };

  if (body.action === "request_alternative") {
    const note = body.note?.trim() || "Client requested alternative meeting times.";
    const updatedProposal = {
      ...proposal,
      status: "alternative_requested" as const,
      confirmedByName: body.name?.trim() || null,
      confirmedByEmail: body.email?.trim() || null,
      alternativeNote: note,
    };

    const updated = await updateActivityRecord(activity.ActivityID, {
      SlotProposal: updatedProposal,
      ActionRequired: true,
      NextAction: `Propose new times — client note: ${note}`,
    });

    return NextResponse.json(sanitizePublicPayload(updated));
  }

  const selectedSlot = proposal.slots.find((s) => s.id === body.slotId);
  if (!selectedSlot) {
    return NextResponse.json(
      { error: "Please select one of the available time slots." },
      { status: 400 },
    );
  }

  const organizerAuth = await resolveOrganizerAccessToken(proposal.integrationId);
  const allAttendees = Array.from(
    new Set(
      [
        ...(proposal.attendeeEmails ?? []),
        ...(proposal.internalColleagueEmails ?? []),
        ...(body.email?.trim() ? [body.email.trim()] : []),
      ]
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@")),
    ),
  );

  let createdTeams: {
    eventId: string;
    webLink: string | null;
    joinUrl: string | null;
  } | null = null;

  if (organizerAuth?.accessToken) {
    createdTeams = await createConfirmedTeamsMeetingWithToken({
      accessToken: organizerAuth.accessToken,
      subject: activity.Subject || "Standard Bio Meeting",
      bodyHtml: `<p>Confirmed via SmartCRM scheduling link (${formatSlotLabelCet(selectedSlot)}).</p>`,
      startIso: selectedSlot.startIso,
      endIso: selectedSlot.endIso,
      attendeeEmails: allAttendees,
    });

    const holdIds = proposal.slots.map((s) => s.holdEventId);
    await deleteTentativeHoldEvents(organizerAuth.accessToken, holdIds);
  }

  const confirmedAt = new Date().toISOString();
  const updatedProposal = {
    ...proposal,
    status: "confirmed" as const,
    confirmedAt,
    confirmedSlotId: selectedSlot.id,
    confirmedByName: body.name?.trim() || null,
    confirmedByEmail: body.email?.trim() || null,
  };

  const updated = await updateActivityRecord(activity.ActivityID, {
    ActivityType: "Teams Meeting",
    ActivityDate: selectedSlot.startIso,
    ActionStatus: "Planned",
    NextAction: `Confirmed for ${formatSlotLabelCet(selectedSlot)}`,
    TeamsScheduled: Boolean(createdTeams?.eventId) || activity.TeamsScheduled,
    TeamsEventId: createdTeams?.eventId ?? activity.TeamsEventId,
    TeamsJoinUrl: createdTeams?.joinUrl ?? activity.TeamsJoinUrl,
    TeamsWebLink: createdTeams?.webLink ?? activity.TeamsWebLink,
    SlotProposal: updatedProposal,
  });

  // Notify organizer in SmartCRM Notification inbox when Prisma is available
  try {
    const prisma = getPrisma();
    const organizerUser = proposal.organizerEmail
      ? await prisma.user.findFirst({
          where: { email: { equals: proposal.organizerEmail, mode: "insensitive" } },
          select: { id: true },
        })
      : await prisma.user.findFirst({
          where: { name: { equals: proposal.organizerName, mode: "insensitive" } },
          select: { id: true },
        });
    if (organizerUser?.id) {
      await prisma.notification.create({
        data: {
          userId: organizerUser.id,
          type: "INFO",
          title: `Meeting confirmed: ${activity.Subject}`,
          message: `${body.name?.trim() || body.email?.trim() || "Client"} selected ${formatSlotLabelCet(selectedSlot)}.`,
          link: `/activities`,
        },
      });
    }
  } catch {
    // Non-blocking notification
  }

  return NextResponse.json(sanitizePublicPayload(updated));
}
