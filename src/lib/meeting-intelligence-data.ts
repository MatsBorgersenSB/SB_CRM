import { getPrisma } from "@/lib/prisma";
import type { CommitmentState, SyncStatus } from "@/generated/prisma";

export type MeetingIntelligenceDto = {
  id: string;
  opportunityId: string | null;
  subject: string;
  startTime: string;
  endTime: string;
  location: string | null;
  webLink: string | null;
  organizerEmail: string;
  aiSummary: string | null;
  syncStatus: SyncStatus;
  provider: string;
  participants: Array<{
    id: string;
    email: string;
    name: string | null;
    contactId: string | null;
    isExternal: boolean;
    responseStatus: string;
    resolved: boolean;
    contactName: string | null;
    contactJobTitle: string | null;
  }>;
  commitments: Array<{
    id: string;
    description: string;
    ownerEmail: string;
    dueDate: string | null;
    status: CommitmentState;
    confirmedByUserId: string | null;
    confirmedAt: string | null;
  }>;
};

function primaryEmail(emails: unknown): string {
  if (!Array.isArray(emails) || emails.length === 0) return "";
  const primary = emails.find(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      "isPrimary" in entry &&
      (entry as { isPrimary?: boolean }).isPrimary,
  ) as { address?: string } | undefined;
  const first = emails[0] as { address?: string } | undefined;
  return primary?.address ?? first?.address ?? "";
}

function toMeetingDto(meeting: {
  id: string;
  opportunityId: string | null;
  subject: string;
  startTime: Date;
  endTime: Date;
  location: string | null;
  webLink: string | null;
  organizerEmail: string;
  aiSummary: string | null;
  syncStatus: SyncStatus;
  provider: string;
  participants: Array<{
    id: string;
    email: string;
    name: string | null;
    contactId: string | null;
    isExternal: boolean;
    responseStatus: string;
    contact: {
      fullName: string | null;
      firstName: string | null;
      lastName: string | null;
      jobTitle: string | null;
      emails: unknown;
    } | null;
  }>;
  commitments: Array<{
    id: string;
    description: string;
    ownerEmail: string;
    dueDate: Date | null;
    status: CommitmentState;
    confirmedByUserId: string | null;
    confirmedAt: Date | null;
  }>;
}): MeetingIntelligenceDto {
  const participants = [...meeting.participants].sort((a, b) =>
    a.email.localeCompare(b.email),
  );
  const commitments = [...meeting.commitments].sort((a, b) => {
    const statusRank = a.status.localeCompare(b.status);
    if (statusRank !== 0) return statusRank;
    const aDue = a.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
    const bDue = b.dueDate?.getTime() ?? Number.POSITIVE_INFINITY;
    return aDue - bDue;
  });

  return {
    id: meeting.id,
    opportunityId: meeting.opportunityId,
    subject: meeting.subject,
    startTime: meeting.startTime.toISOString(),
    endTime: meeting.endTime.toISOString(),
    location: meeting.location,
    webLink: meeting.webLink,
    organizerEmail: meeting.organizerEmail,
    aiSummary: meeting.aiSummary,
    syncStatus: meeting.syncStatus,
    provider: meeting.provider,
    participants: participants.map((participant) => {
      const resolved = Boolean(participant.contactId && participant.contact);
      const contactName = participant.contact
        ? participant.contact.fullName?.trim() ||
          `${participant.contact.firstName ?? ""} ${participant.contact.lastName ?? ""}`.trim() ||
          primaryEmail(participant.contact.emails) ||
          null
        : null;
      return {
        id: participant.id,
        email: participant.email,
        name: participant.name,
        contactId: participant.contactId,
        isExternal: participant.isExternal,
        responseStatus: participant.responseStatus,
        resolved,
        contactName,
        contactJobTitle: participant.contact?.jobTitle ?? null,
      };
    }),
    commitments: commitments.map((commitment) => ({
      id: commitment.id,
      description: commitment.description,
      ownerEmail: commitment.ownerEmail,
      dueDate: commitment.dueDate?.toISOString() ?? null,
      status: commitment.status,
      confirmedByUserId: commitment.confirmedByUserId,
      confirmedAt: commitment.confirmedAt?.toISOString() ?? null,
    })),
  };
}

/**
 * Resolve an opportunity by Prisma UUID or by exact opportunity name
 * (helps when stale URLs / labels are used during local demos).
 */
export async function resolveOpportunityId(opportunityKey: string): Promise<string | null> {
  const prisma = getPrisma();
  const byId = await prisma.opportunity.findUnique({
    where: { id: opportunityKey },
    select: { id: true },
  });
  if (byId) return byId.id;

  const byName = await prisma.opportunity.findFirst({
    where: { name: opportunityKey },
    select: { id: true },
  });
  return byName?.id ?? null;
}

/**
 * Load MeetingRecord rows (with participants + commitments) for an opportunity.
 * Never throws for empty results — returns [].
 */
export async function readMeetingsForOpportunity(
  opportunityKey: string,
): Promise<MeetingIntelligenceDto[]> {
  const prisma = getPrisma();
  const opportunityId = await resolveOpportunityId(opportunityKey);
  if (!opportunityId) return [];

  const meetings = await prisma.meetingRecord.findMany({
    where: { opportunityId },
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
    orderBy: { startTime: "desc" },
  });

  return meetings.map(toMeetingDto);
}
