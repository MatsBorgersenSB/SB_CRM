import type { PipelineTeamMember } from "@/types/pipeline";
import type { StandardBioOffering } from "@/types/offering";
import {
  buildOpportunityOfferingSelection,
  resolveOfferings,
} from "@/lib/standard-bio-offerings";

export type OfferingIntelligence = {
  offerings: StandardBioOffering[];
  labels: string[];
  /** What Standard Bio is trying to sell — prose for SmartAssist. */
  commercialIntent: string;
  requiredInformation: string[];
  suggestedStakeholderRoles: string[];
  missingStakeholderRoles: string[];
  discoveryQuestions: string[];
  qualificationSignals: string[];
  nextBestActionHints: string[];
  /** True when no offerings are linked — SmartAssist must not invent scope. */
  offeringsUnknown: boolean;
};

function unique(items: string[]): string[] {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function roleCovered(team: PipelineTeamMember[], role: string): boolean {
  const needle = role.toLowerCase();
  return team.some((member) => member.projectRole.toLowerCase().includes(needle));
}

/**
 * Derives SmartAssist guidance from selected Standard Bio offerings.
 * Reality first: if offerings are missing, say Unknown — do not invent scope.
 */
export function buildOfferingIntelligence(
  offeringIds: string[] | undefined,
  team: PipelineTeamMember[] = [],
): OfferingIntelligence {
  const selection = buildOpportunityOfferingSelection(offeringIds);
  const offerings = selection.offerings;

  if (offerings.length === 0) {
    return {
      offerings: [],
      labels: [],
      commercialIntent: "Unknown — no Standard Bio offerings are linked to this opportunity.",
      requiredInformation: [
        "Which Standard Bio systems, products, or services are in scope?",
      ],
      suggestedStakeholderRoles: ["Decision Maker", "Technical Lead"],
      missingStakeholderRoles: team.length === 0 ? ["Decision Maker", "Technical Lead"] : [],
      discoveryQuestions: [
        "Which Standard Bio offerings are we proposing — systems, products, or services?",
        "Is this primarily an equipment, assessment, or ongoing service engagement?",
      ],
      qualificationSignals: [],
      nextBestActionHints: [
        "Select the Standard Bio offerings in scope so SmartAssist can qualify and recommend next steps",
      ],
      offeringsUnknown: true,
    };
  }

  const requiredInformation = unique(
    offerings.flatMap((offering) => offering.requiredInformation),
  );
  const suggestedStakeholderRoles = unique(
    offerings.flatMap((offering) => offering.suggestedStakeholderRoles),
  );
  const discoveryQuestions = unique(
    offerings.flatMap((offering) => offering.discoveryQuestions),
  );
  const qualificationSignals = unique(
    offerings.flatMap((offering) => offering.qualificationSignals),
  );
  const nextBestActionHints = unique(
    offerings.flatMap((offering) => offering.nextBestActionHints),
  );

  const missingStakeholderRoles = suggestedStakeholderRoles.filter(
    (role) => !roleCovered(team, role),
  );

  const categoryParts: string[] = [];
  if (selection.hasSystems) {
    categoryParts.push(
      `systems (${selection.byCategory.system.map((o) => o.name).join(", ")})`,
    );
  }
  if (selection.hasProducts) {
    categoryParts.push(
      `products (${selection.byCategory.product.map((o) => o.name).join(", ")})`,
    );
  }
  if (selection.hasServices) {
    categoryParts.push(
      `services (${selection.byCategory.service.map((o) => o.name).join(", ")})`,
    );
  }

  return {
    offerings,
    labels: selection.labels,
    commercialIntent: `Standard Bio is pursuing ${categoryParts.join("; ")}.`,
    requiredInformation,
    suggestedStakeholderRoles,
    missingStakeholderRoles,
    discoveryQuestions,
    qualificationSignals,
    nextBestActionHints,
    offeringsUnknown: false,
  };
}

export function offeringIdsFromInput(ids: string[] | undefined): string[] {
  return resolveOfferings(ids).map((offering) => offering.id);
}
