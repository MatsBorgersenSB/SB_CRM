/**
 * FS-014 — Apply post-meeting transcript notes onto FS-008 MeetingRecord.
 * Propose only — never auto-confirm commitments.
 */

import "server-only";

import { extractMeetingInsights } from "@/lib/ai/meeting-intelligence";
import { parseMeetingTranscript } from "@/lib/m365/meeting-transcript";
import { getPrisma } from "@/lib/prisma";
import {
  readMeetingsForOpportunity,
  resolveOpportunityId,
  type MeetingIntelligenceDto,
} from "@/lib/meeting-intelligence-data";

export type ApplyMeetingTranscriptInput = {
  transcript: string;
  opportunityId?: string;
  companyId?: string;
  meetingId?: string;
  subject?: string;
  organizerEmail?: string;
  startTime?: string;
  endTime?: string;
};

export type ApplyMeetingTranscriptResult = {
  meeting: MeetingIntelligenceDto;
  insights: ReturnType<typeof extractMeetingInsights>;
  createdMeeting: boolean;
  proposedCommitmentCount: number;
  speakersObserved: string[];
};

function parseOptionalDate(value: string | undefined, fallback: Date): Date {
  if (!value?.trim()) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

/**
 * Parse transcript → extract insights → upsert MeetingRecord with proposed commitments.
 */
export async function applyMeetingTranscriptNotes(
  input: ApplyMeetingTranscriptInput,
): Promise<ApplyMeetingTranscriptResult> {
  const parsed = parseMeetingTranscript(input.transcript);
  if (!parsed.plainText.trim()) {
    throw new Error("Transcript is empty.");
  }

  const insights = extractMeetingInsights(parsed.plainText);
  const prisma = getPrisma();

  const opportunityId = input.opportunityId?.trim()
    ? await resolveOpportunityId(input.opportunityId.trim())
    : null;

  let meetingId = input.meetingId?.trim() || null;
  let createdMeeting = false;

  if (meetingId) {
    const existing = await prisma.meetingRecord.findUnique({
      where: { id: meetingId },
      select: { id: true, opportunityId: true },
    });
    if (!existing) {
      throw new Error("Meeting not found.");
    }
    if (
      opportunityId &&
      existing.opportunityId &&
      existing.opportunityId !== opportunityId
    ) {
      throw new Error("Meeting does not belong to this opportunity.");
    }
  } else {
    if (!opportunityId && !input.companyId?.trim()) {
      throw new Error("Provide opportunityId, companyId, or meetingId.");
    }

    const now = new Date();
    const startTime = parseOptionalDate(input.startTime, now);
    const endTime = parseOptionalDate(
      input.endTime,
      new Date(startTime.getTime() + 60 * 60 * 1000),
    );
    const subject =
      input.subject?.trim() ||
      `Teams meeting notes · ${startTime.toISOString().slice(0, 10)}`;
    const externalEventId = `manual-transcript-${opportunityId ?? input.companyId}-${startTime.toISOString()}`;

    const created = await prisma.meetingRecord.create({
      data: {
        externalEventId,
        provider: "manual",
        subject,
        startTime,
        endTime,
        organizerEmail: input.organizerEmail?.trim() || "unknown@local",
        aiSummary: insights.summary,
        syncStatus: "pending_review",
        opportunityId: opportunityId,
        companyId: input.companyId?.trim() || null,
      },
      select: { id: true },
    });
    meetingId = created.id;
    createdMeeting = true;
  }

  const summaryLine = [
    insights.summary,
    insights.keyCommitments.length > 0
      ? `Commitments: ${insights.keyCommitments.join("; ")}`
      : null,
  ]
    .filter(Boolean)
    .join(" · ");

  await prisma.meetingRecord.update({
    where: { id: meetingId },
    data: {
      aiSummary: summaryLine,
      syncStatus: "pending_review",
    },
  });

  // Replace only previously proposed (not confirmed) commitments from this import wave.
  await prisma.meetingCommitmentRecord.deleteMany({
    where: {
      meetingId,
      status: "proposed",
    },
  });

  const actionTexts =
    insights.actionItems.length > 0
      ? insights.actionItems.map((item) => item.action)
      : insights.keyCommitments;

  const uniqueActions = [...new Set(actionTexts.map((text) => text.trim()).filter(Boolean))];

  if (uniqueActions.length > 0) {
    await prisma.meetingCommitmentRecord.createMany({
      data: uniqueActions.slice(0, 12).map((description) => ({
        meetingId: meetingId!,
        description,
        ownerEmail: "unassigned",
        dueDate: null,
        status: "proposed" as const,
      })),
    });
  }

  const row = await prisma.meetingRecord.findUniqueOrThrow({
    where: { id: meetingId },
    include: {
      participants: {
        include: {
          contact: {
            select: {
              fullName: true,
              firstName: true,
              lastName: true,
              jobTitle: true,
              emails: true,
            },
          },
        },
      },
      commitments: true,
    },
  });

  const meetings = row.opportunityId
    ? await readMeetingsForOpportunity(row.opportunityId)
    : [];
  const meeting =
    meetings.find((item) => item.id === meetingId) ??
    ({
      id: row.id,
      opportunityId: row.opportunityId,
      subject: row.subject,
      startTime: row.startTime.toISOString(),
      endTime: row.endTime.toISOString(),
      location: row.location,
      webLink: row.webLink,
      organizerEmail: row.organizerEmail,
      aiSummary: row.aiSummary,
      syncStatus: row.syncStatus,
      provider: row.provider,
      participants: [],
      commitments: row.commitments.map((commitment) => ({
        id: commitment.id,
        description: commitment.description,
        ownerEmail: commitment.ownerEmail,
        dueDate: commitment.dueDate?.toISOString() ?? null,
        status: commitment.status,
        confirmedByUserId: commitment.confirmedByUserId,
        confirmedAt: commitment.confirmedAt?.toISOString() ?? null,
      })),
    } satisfies MeetingIntelligenceDto);

  return {
    meeting,
    insights,
    createdMeeting,
    proposedCommitmentCount: uniqueActions.length,
    speakersObserved: parsed.speakers,
  };
}
