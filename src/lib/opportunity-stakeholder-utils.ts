import type { Contact } from "@/types/contact";
import { getContactDisplayName } from "@/types/contact";
import { DEFAULT_PROJECT_STAKEHOLDER_ROLES } from "@/types/project-relationships";

/** Primary Buying Center presets (FS-001 / Mission Control). */
export const BUYING_CENTER_ROLE_PRESETS = [
  "Economic Buyer",
  "Champion",
  "Technical Evaluator",
  "Blocker",
  "End User",
] as const;

export type BuyingCenterRolePreset = (typeof BUYING_CENTER_ROLE_PRESETS)[number];

/** Sentinel value for the “+ Custom Role” select option (never persisted). */
export const BUYING_CENTER_CUSTOM_ROLE_VALUE = "__custom_role__";

/** @deprecated Use BUYING_CENTER_CUSTOM_ROLE_VALUE */
export const CUSTOM_STAKEHOLDER_ROLE_VALUE = BUYING_CENTER_CUSTOM_ROLE_VALUE;

/**
 * Full opportunity stakeholder role catalog — Buying Center presets first,
 * then legacy / project roles for continuity with existing rosters.
 */
export const OPPORTUNITY_STAKEHOLDER_ROLES = [
  ...BUYING_CENTER_ROLE_PRESETS,
  "Decision Maker",
  "Executive Sponsor",
  "Technical Lead",
  "Commercial Lead",
  "Procurement",
  "Influencer",
  ...DEFAULT_PROJECT_STAKEHOLDER_ROLES.filter(
    (role) =>
      !(BUYING_CENTER_ROLE_PRESETS as readonly string[]).includes(role) &&
      ![
        "Decision Maker",
        "Executive Sponsor",
        "Technical Lead",
        "Commercial Lead",
        "Procurement",
      ].includes(role),
  ),
] as const;

export function normalizeStakeholderRole(role: string): string {
  return role.replace(/\s+/g, " ").trim();
}

export function isBuyingCenterPresetRole(role: string): boolean {
  return (BUYING_CENTER_ROLE_PRESETS as readonly string[]).includes(
    normalizeStakeholderRole(role),
  );
}

export function isCustomStakeholderRole(role: string): boolean {
  const normalized = normalizeStakeholderRole(role);
  if (!normalized) return false;
  if (normalized === BUYING_CENTER_CUSTOM_ROLE_VALUE) return true;
  return !(OPPORTUNITY_STAKEHOLDER_ROLES as readonly string[]).includes(normalized);
}

export function suggestOpportunityRoleForContact(contact: Contact): string {
  const corpus = `${contact.JobTitle ?? ""} ${contact.Role ?? ""}`.toLowerCase();
  if (/ceo|chief|president|executive sponsor|managing director|cfo|budget/.test(corpus)) {
    return "Economic Buyer";
  }
  if (/champion|sponsor|advocate/.test(corpus)) return "Champion";
  if (/security|infosec|ciso/.test(corpus)) return "Security Officer";
  if (/legal|counsel|compliance/.test(corpus)) return "Legal Approver";
  if (/procurement|buyer|purchasing/.test(corpus)) return "Procurement";
  if (/plant|operations|technical|engineer|evaluator|architect/.test(corpus)) {
    return "Technical Evaluator";
  }
  if (/blocker|gatekeeper|risk/.test(corpus)) return "Blocker";
  if (/operator|end.?user|technician/.test(corpus)) return "End User";
  if (/commercial|sales|business development/.test(corpus)) return "Champion";
  if (/decision|director|vp|head/.test(corpus)) return "Economic Buyer";
  return "Champion";
}

/**
 * Merge presets with roster / offering-suggested custom strings.
 * Custom roles are plain strings and appear in the selector once used.
 */
export function buildOpportunityStakeholderRoleOptions(customRoles: string[]): string[] {
  const roles = new Set<string>(OPPORTUNITY_STAKEHOLDER_ROLES);
  for (const role of customRoles) {
    const trimmed = normalizeStakeholderRole(role);
    if (
      trimmed &&
      trimmed !== BUYING_CENTER_CUSTOM_ROLE_VALUE &&
      trimmed !== "__custom__"
    ) {
      roles.add(trimmed);
    }
  }
  return [...roles];
}

export function formatSuggestedContactLabel(contact: Contact): string {
  const name = getContactDisplayName(contact);
  const title = contact.JobTitle?.trim() || contact.Role?.trim();
  return title ? `${name} · ${title}` : name;
}

export function hasDecisionMakerOnTeam(
  team: Array<{ projectRole: string }>,
): boolean {
  return team.some((member) =>
    /decision maker|economic buyer/i.test(member.projectRole),
  );
}
