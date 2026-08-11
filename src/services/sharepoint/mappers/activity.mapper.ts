import type { Activity, CreateActivityInput, M365ActivityTargets, SmartAssistAssessment } from "@/types/activity";
import type { SharePointPerson } from "@/types/company";
import type { GraphListItem, ListItemMapper } from "@/services/sharepoint/client/types";

type ActivityFields = {
  ActivityID: string;
  ActivityType: string;
  ActivityDate: string;
  Subject: string;
  ActivityDescription: string;
  Summary?: string;
  KeyDecisionsJson?: string;
  AgreedActionsJson?: string;
  RisksJson?: string;
  LinkedDocumentsJson?: string;
  StakeholdersJson?: string;
  SharedWithJson?: string;
  SmartAssistAssessmentJson?: string;
  CompanyLookupId?: number;
  Company?: { LookupValue?: string };
  ContactLookupId?: number;
  Contact?: { LookupValue?: string };
  DealLookupId?: number;
  Deal?: { LookupValue?: string };
  ProjectId?: string;
  ProjectName?: string;
  LinkedDealsJson?: string;
  LinkedContactsJson?: string;
  ActivityOwnerLookupId?: number;
  ActivityOwner?: { LookupValue?: string };
  ActionRequired: boolean;
  NextAction: string;
  NextActionDate: string;
  ActionStatus: string;
  ActionOutcome: string;
  DurationMinutes?: number;
  Priority?: string;
  M365TargetsJson?: string;
};

function parseJsonArray<T>(value: string | undefined, fallback: T[] = []): T[] {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value) as T[];
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function parseJsonObject<T extends object>(value: string | undefined): T | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as T;
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function stringifyJson(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value) && value.length === 0) return undefined;
  return JSON.stringify(value);
}

export const activityMapper: ListItemMapper<ActivityFields, Activity> = {
  toDomain(item: GraphListItem<ActivityFields>): Activity {
    const fields = item.fields;
    return {
      id: Number(item.id),
      ActivityID: fields.ActivityID,
      ActivityType: fields.ActivityType as Activity["ActivityType"],
      ActivityDate: fields.ActivityDate,
      Subject: fields.Subject ?? "",
      ActivityDescription: fields.ActivityDescription ?? "",
      Summary: fields.Summary,
      KeyDecisions: parseJsonArray<string>(fields.KeyDecisionsJson),
      AgreedActions: parseJsonArray(fields.AgreedActionsJson),
      Risks: parseJsonArray<string>(fields.RisksJson),
      LinkedDocuments: parseJsonArray(fields.LinkedDocumentsJson),
      LinkedDeals: parseJsonArray(fields.LinkedDealsJson),
      LinkedContacts: parseJsonArray(fields.LinkedContactsJson),
      Stakeholders: parseJsonArray(fields.StakeholdersJson),
      SharedWith: parseJsonArray<SharePointPerson>(fields.SharedWithJson),
      SmartAssistAssessment: parseJsonObject<SmartAssistAssessment>(
        fields.SmartAssistAssessmentJson,
      ),
      Company: fields.CompanyLookupId
        ? { Id: fields.CompanyLookupId, Title: fields.Company?.LookupValue ?? "" }
        : null,
      Contact: fields.ContactLookupId
        ? { Id: fields.ContactLookupId, Title: fields.Contact?.LookupValue ?? "" }
        : null,
      Deal: fields.Deal?.LookupValue
        ? { Id: fields.DealLookupId ?? 0, Title: fields.Deal.LookupValue }
        : null,
      ProjectId: fields.ProjectId?.trim() || null,
      ProjectName: fields.ProjectName?.trim() || null,
      ActivityOwner: fields.ActivityOwnerLookupId
        ? {
            Id: fields.ActivityOwnerLookupId,
            Title: fields.ActivityOwner?.LookupValue ?? "",
          }
        : null,
      ActionRequired: Boolean(fields.ActionRequired),
      NextAction: fields.NextAction ?? "",
      NextActionDate: fields.NextActionDate ?? "",
      ActionStatus: fields.ActionStatus as Activity["ActionStatus"],
      ActionOutcome: (fields.ActionOutcome ?? "") as Activity["ActionOutcome"],
      DurationMinutes: fields.DurationMinutes,
      Priority: fields.Priority as Activity["Priority"],
      M365Targets: parseJsonObject<M365ActivityTargets>(fields.M365TargetsJson),
    };
  },

  toFields(input: Partial<Activity> | CreateActivityInput): Record<string, unknown> {
    const fields: Record<string, unknown> = {};
    const row = input as Partial<Activity>;

    if (row.ActivityID !== undefined) fields.ActivityID = row.ActivityID;
    if (row.ActivityType !== undefined) fields.ActivityType = row.ActivityType;
    if (row.ActivityDate !== undefined) fields.ActivityDate = row.ActivityDate;
    if (row.Subject !== undefined) fields.Subject = row.Subject;
    if (row.ActivityDescription !== undefined) {
      fields.ActivityDescription = row.ActivityDescription;
    }
    if (row.Summary !== undefined) fields.Summary = row.Summary;
    if (row.KeyDecisions !== undefined) {
      fields.KeyDecisionsJson = stringifyJson(row.KeyDecisions);
    }
    if (row.AgreedActions !== undefined) {
      fields.AgreedActionsJson = stringifyJson(row.AgreedActions);
    }
    if (row.Risks !== undefined) fields.RisksJson = stringifyJson(row.Risks);
    if (row.LinkedDocuments !== undefined) {
      fields.LinkedDocumentsJson = stringifyJson(row.LinkedDocuments);
    }
    if (row.LinkedDeals !== undefined) {
      fields.LinkedDealsJson = stringifyJson(row.LinkedDeals);
    }
    if (row.LinkedContacts !== undefined) {
      fields.LinkedContactsJson = stringifyJson(row.LinkedContacts);
    }
    if (row.Stakeholders !== undefined) {
      fields.StakeholdersJson = stringifyJson(row.Stakeholders);
    }
    if (row.SharedWith !== undefined) {
      fields.SharedWithJson = stringifyJson(row.SharedWith);
    }
    if (row.SmartAssistAssessment !== undefined) {
      fields.SmartAssistAssessmentJson = stringifyJson(row.SmartAssistAssessment);
    }
    if (row.Company) fields.CompanyLookupId = row.Company.Id;
    if (row.Contact) fields.ContactLookupId = row.Contact.Id;
    if (row.Deal) fields.DealLookupId = row.Deal.Id;
    if (row.ProjectId !== undefined) fields.ProjectId = row.ProjectId ?? "";
    if (row.ProjectName !== undefined) fields.ProjectName = row.ProjectName ?? "";
    if (row.ActivityOwner) fields.ActivityOwnerLookupId = row.ActivityOwner.Id;
    if (row.ActionRequired !== undefined) fields.ActionRequired = row.ActionRequired;
    if (row.NextAction !== undefined) fields.NextAction = row.NextAction;
    if (row.NextActionDate !== undefined) fields.NextActionDate = row.NextActionDate;
    if (row.ActionStatus !== undefined) fields.ActionStatus = row.ActionStatus;
    if (row.ActionOutcome !== undefined) fields.ActionOutcome = row.ActionOutcome;
    if (row.DurationMinutes !== undefined) fields.DurationMinutes = row.DurationMinutes;
    if (row.Priority !== undefined) fields.Priority = row.Priority;
    if (row.M365Targets !== undefined) {
      fields.M365TargetsJson = stringifyJson(row.M365Targets);
    }

    return fields;
  },
};
