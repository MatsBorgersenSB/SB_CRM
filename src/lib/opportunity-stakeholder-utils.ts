import type { Contact } from "@/types/contact";
import { getContactDisplayName } from "@/types/contact";
import { DEFAULT_PROJECT_STAKEHOLDER_ROLES } from "@/types/project-relationships";

export const OPPORTUNITY_STAKEHOLDER_ROLES = [
  "Decision Maker",
  "Executive Sponsor",
  "Technical Lead",
  "Commercial Lead",
  "Procurement",
  "Influencer",
  ...DEFAULT_PROJECT_STAKEHOLDER_ROLES.filter(
    (role) =>
      ![
        "Decision Maker",
        "Executive Sponsor",
        "Technical Lead",
        "Commercial Lead",
        "Procurement",
      ].includes(role),
  ),
] as const;

export function suggestOpportunityRoleForContact(contact: Contact): string {
  const corpus = `${contact.JobTitle ?? ""} ${contact.Role ?? ""}`.toLowerCase();
  if (/ceo|chief|president|executive sponsor|managing director/.test(corpus)) {
    return "Executive Sponsor";
  }
  if (/procurement|buyer|purchasing/.test(corpus)) return "Procurement";
  if (/plant|operations|technical|engineer|manager/.test(corpus)) return "Technical Lead";
  if (/commercial|sales|business development/.test(corpus)) return "Commercial Lead";
  if (/legal|counsel/.test(corpus)) return "Legal";
  if (/decision|director|vp|head/.test(corpus)) return "Decision Maker";
  return "Influencer";
}

export function buildOpportunityStakeholderRoleOptions(customRoles: string[]): string[] {
  const roles = new Set<string>(OPPORTUNITY_STAKEHOLDER_ROLES);
  for (const role of customRoles) {
    const trimmed = role.trim();
    if (trimmed) roles.add(trimmed);
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
  return team.some((member) => /decision maker/i.test(member.projectRole));
}
