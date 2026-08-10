import "server-only";

import { getServerSharePointServices } from "@/services/sharepoint/factory";
import type { CreateActivityInput } from "@/types/activity";
import type {
  CoPilotActionProposal,
  CoPilotExecuteResult,
} from "@/types/smartassist-copilot";

function defaultActivityDate(): string {
  return new Date().toISOString();
}

function normalizeCreateInput(
  partial: Partial<CreateActivityInput>,
): CreateActivityInput {
  return {
    ActivityType: partial.ActivityType ?? "Task",
    ActivityDate: partial.ActivityDate ?? defaultActivityDate(),
    Subject: partial.Subject ?? "CRM update",
    Summary: partial.Summary ?? partial.Subject ?? "CRM update",
    ActionRequired: partial.ActionRequired ?? false,
    NextAction: partial.NextAction ?? "",
    NextActionDate: partial.NextActionDate ?? "",
    ActionStatus: partial.ActionStatus ?? "Planned",
    ActionOutcome: partial.ActionOutcome ?? "",
    ActivityDescription:
      partial.ActivityDescription ??
      partial.Summary ??
      partial.Subject ??
      "CRM update",
    Company: partial.Company ?? null,
    Contact: partial.Contact ?? null,
    Deal: partial.Deal ?? null,
    M365Targets: partial.M365Targets,
    KeyDecisions: partial.KeyDecisions,
    AgreedActions: partial.AgreedActions,
    Risks: partial.Risks,
    DurationMinutes: partial.DurationMinutes,
    Priority: partial.Priority,
    ActivityOwner: partial.ActivityOwner,
    LinkedDeals: partial.LinkedDeals,
    LinkedContacts: partial.LinkedContacts,
    LinkedDocuments: partial.LinkedDocuments,
  };
}

/**
 * Apply a Co-Pilot proposal against live CRM entities.
 * Server-only — never import from Client Components.
 */
export async function executeCoPilotProposal(
  proposal: CoPilotActionProposal,
): Promise<CoPilotExecuteResult> {
  const { kind, payload } = proposal;
  const { activities } = getServerSharePointServices();

  if (kind === "complete_commitment" && payload.activityId && payload.activityUpdate) {
    const { getActivityById } = await import("@/lib/pipeline-db");
    const { readLiveCompanies } = await import("@/lib/prisma-data");
    const { resolveActivityCompany } = await import("@/lib/activity-utils");

    const existing = await getActivityById(payload.activityId);
    if (!existing) {
      throw new Error("That activity no longer exists — suggestion dismissed.");
    }
    const companies = await readLiveCompanies();
    if (existing.Company && !resolveActivityCompany(existing, companies)) {
      throw new Error(
        "That activity references a company that no longer exists — suggestion dismissed.",
      );
    }

    await activities.update(payload.activityId, payload.activityUpdate);
    return {
      mode: "applied",
      message: `Marked "${proposal.objectName ?? "commitment"}" complete in CRM.`,
    };
  }

  if (
    (kind === "create_activity" ||
      kind === "schedule_follow_up" ||
      kind === "draft_email") &&
    payload.createActivity
  ) {
    const createInput = normalizeCreateInput(payload.createActivity);
    if (createInput.Company) {
      const { readLiveCompanies } = await import("@/lib/prisma-data");
      const companies = await readLiveCompanies();
      const companyRef = createInput.Company;
      const resolved = companies.find((record) => {
        if ("CompanyID" in companyRef && companyRef.CompanyID) {
          return record.CompanyID === companyRef.CompanyID;
        }
        if ("Id" in companyRef) {
          return record.id === companyRef.Id || record.Title === companyRef.Title;
        }
        return false;
      });
      if (!resolved) {
        throw new Error(
          "Cannot create activity for a company that no longer exists.",
        );
      }
    }

    await activities.create(createInput);
    return {
      mode: "applied",
      message: `Created activity "${payload.createActivity.Subject ?? proposal.title}" in CRM.`,
    };
  }

  if (
    (kind === "create_opportunity" ||
      kind === "review_opportunity" ||
      kind === "review_document" ||
      kind === "log_meeting_outcome") &&
    proposal.href
  ) {
    return {
      mode: "navigate",
      href: proposal.href,
      message: `Opening ${proposal.objectName ?? "record"} for review.`,
      prefill: payload.prefill,
    };
  }

  if (proposal.href) {
    return {
      mode: "navigate",
      href: proposal.href,
      message: "Opening record for manual review.",
      prefill: payload.prefill,
    };
  }

  throw new Error("This recommendation cannot be applied automatically.");
}
