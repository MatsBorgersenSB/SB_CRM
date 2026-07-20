import type { Interaction } from "@/lib/interactions-data";
import type { Activity, ActivityType } from "@/types/activity";

const LEGACY_TYPE_MAP: Record<string, ActivityType> = {
  "Deal Assignment": "Meeting",
  "SmartDocs Upload": "Proposal Sent",
  "Audit Note": "Technical Review",
};

export function migrateLegacyInteraction(
  raw: Interaction,
  sharePointId: number,
): Activity {
  return {
    id: sharePointId,
    ActivityID: raw.interactionId.replace("INT-", "ACT-"),
    ActivityType: LEGACY_TYPE_MAP[raw.type] ?? "Other",
    ActivityDate: raw.timestamp.replace(" ", "T") + ":00",
    Subject: raw.type,
    ActivityDescription: raw.summary,
    Summary: raw.summary.split(/[.!?]/)[0]?.trim() || raw.summary,
    Company: null,
    Contact: { Id: 0, Title: raw.contactId },
    Deal: raw.pipelineId ? { Id: 0, Title: raw.pipelineId } : null,
    ActivityOwner: null,
    ActionRequired: false,
    NextAction: "",
    NextActionDate: "",
    ActionStatus: "Completed",
    ActionOutcome: "",
    KeyDecisions: [],
    AgreedActions: [],
    Risks: [],
    LinkedDocuments: [],
    LinkedDeals: raw.pipelineId ? [{ Id: 0, Title: raw.pipelineId }] : [],
    LinkedContacts: [{ Id: 0, Title: raw.contactId }],
  };
}

export function isLegacyInteraction(raw: unknown): raw is Interaction {
  return (
    typeof raw === "object" &&
    raw !== null &&
    "interactionId" in raw &&
    !("ActivityID" in raw)
  );
}

export function activitiesNeedMigration(items: unknown[]): boolean {
  return items.some(isLegacyInteraction);
}
