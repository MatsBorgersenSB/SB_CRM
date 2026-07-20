import type { OutlookEvidenceRecord } from "@/types/outlook-reconciliation";

/** Seed Outlook mailbox evidence — simulates connected M365 when Graph mail is unavailable. */
export const defaultOutlookEvidence: OutlookEvidenceRecord[] = [
  {
    id: "oe-julian-tessarzik",
    entityType: "contact",
    entityId: "CT-10053",
    contactEmail: "julian.tessarzik@smartgas.eu",
    companyId: "CO-1006",
    emails: [
      {
        id: "msg-jt-001",
        subject: "Re: smartGAS facility qualification timeline",
        receivedDateTime: "2026-07-10T14:22:00",
        direction: "received",
        preview: "Thanks for the update on the qualification steps…",
        conversationId: "conv-jt-qual",
      },
      {
        id: "msg-jt-002",
        subject: "smartGAS facility qualification timeline",
        receivedDateTime: "2026-07-08T09:15:00",
        direction: "sent",
        conversationId: "conv-jt-qual",
      },
      {
        id: "msg-jt-003",
        subject: "Introduction — polymer processing partnership",
        receivedDateTime: "2026-07-05T11:40:00",
        direction: "received",
        conversationId: "conv-jt-intro",
      },
      {
        id: "msg-jt-004",
        subject: "Re: Introduction — polymer processing partnership",
        receivedDateTime: "2026-07-04T16:05:00",
        direction: "sent",
        conversationId: "conv-jt-intro",
      },
      {
        id: "msg-jt-005",
        subject: "Site visit availability — July",
        receivedDateTime: "2026-07-02T08:30:00",
        direction: "received",
        conversationId: "conv-jt-site",
      },
      {
        id: "msg-jt-006",
        subject: "Re: Site visit availability — July",
        receivedDateTime: "2026-07-01T13:10:00",
        direction: "sent",
        conversationId: "conv-jt-site",
      },
    ],
    teamsMeetings: [
      {
        id: "teams-jt-001",
        subject: "smartGAS intro call",
        startDateTime: "2026-06-28T10:00:00",
        endDateTime: "2026-06-28T10:45:00",
        isTeamsMeeting: true,
      },
    ],
    calendarEvents: [],
    connectedAt: "2026-06-25T08:00:00",
  },
  {
    id: "oe-smartgas-company",
    entityType: "company",
    entityId: "CO-1006",
    companyId: "CO-1006",
    contactEmail: "julian.tessarzik@smartgas.eu",
    emails: [
      {
        id: "msg-sg-001",
        subject: "smartGAS — partnership follow-up",
        receivedDateTime: "2026-07-10T14:22:00",
        direction: "received",
      },
      {
        id: "msg-sg-002",
        subject: "Re: smartGAS — partnership follow-up",
        receivedDateTime: "2026-07-09T10:00:00",
        direction: "sent",
      },
    ],
    teamsMeetings: [
      {
        id: "teams-sg-001",
        subject: "smartGAS intro call",
        startDateTime: "2026-06-28T10:00:00",
        isTeamsMeeting: true,
      },
    ],
    calendarEvents: [
      {
        id: "cal-sg-001",
        subject: "smartGAS site visit planning",
        startDateTime: "2026-07-15T09:00:00",
      },
    ],
    connectedAt: "2026-06-25T08:00:00",
  },
  {
    id: "oe-elena-lindstrom",
    entityType: "contact",
    entityId: "CT-10011",
    contactEmail: "elena.lindstrom@nordicrecycling.se",
    companyId: "CO-1001",
    emails: [
      {
        id: "msg-el-001",
        subject: "Q3 yield review — action items",
        receivedDateTime: "2026-07-12T07:45:00",
        direction: "received",
      },
      {
        id: "msg-el-002",
        subject: "Re: Q3 yield review — action items",
        receivedDateTime: "2026-07-11T15:20:00",
        direction: "sent",
      },
    ],
    teamsMeetings: [],
    calendarEvents: [],
    connectedAt: "2026-06-20T08:00:00",
  },
];
