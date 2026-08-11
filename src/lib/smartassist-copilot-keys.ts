import type { CoPilotActionKind } from "@/types/smartassist-copilot";

/** Stable suppress identity — survives proposal id format changes across sessions. */
export function buildCoPilotSuppressionKey(input: {
  id: string;
  kind: CoPilotActionKind;
  companyId?: string;
  ruleId?: string;
  title?: string;
}): string {
  const companyId = input.companyId?.trim();
  const isCreateOpportunity =
    input.kind === "create_opportunity" ||
    input.ruleId === "create_new_opportunity" ||
    input.title === "Create New Opportunity";

  if (isCreateOpportunity && companyId) {
    return `create_opportunity:${companyId}`;
  }

  if (input.ruleId === "assign_account_owner" && companyId) {
    return `propose_record_update:owner:${companyId}`;
  }

  if (
    (input.kind === "classify_company" || input.ruleId === "classify_relationship") &&
    companyId
  ) {
    return `classify_company:${companyId}`;
  }

  if (input.ruleId === "no_activity" && companyId) {
    return `create_activity:first_touch:${companyId}`;
  }

  return input.id;
}
