/**
 * Development checklist (FS-005B) — what belongs under each "Secure …" step.
 *
 * Rule: a step only lists things about OUR plant for THAT step. Facts about the host's own
 * biogas plant (its site, gas, outputs, permit) and work that belongs to another step never
 * appear under it. Nothing is deleted; it is simply not shown as evidence for the wrong step.
 */

import type { ProjectDecision, ProjectMilestone } from "@/types/project";
import type { UnderstandingFieldId } from "@/types/opportunity-understanding";

export type DevelopmentPillar = {
  fieldId: UnderstandingFieldId;
  /** Plain name shown on the checklist. */
  title: string;
  /** Words that tie a milestone or decision to this step. */
  keywords: RegExp;
};

/** The seven things to secure, in FEL 1 → Realisation order. */
export const DEVELOPMENT_PILLARS: readonly DevelopmentPillar[] = [
  {
    fieldId: "site_readiness",
    title: "Land plot",
    keywords: /\b(plot|land ?owner|landowner|land|lease|rent|purchase|footprint|site visit|tomt)\b/i,
  },
  {
    fieldId: "feedstock_agreement",
    title: "Feedstock",
    keywords: /\b(wood ?chips?|feedstock|g30|moisture|tipping|allskog|treflis|flis)\b/i,
  },
  {
    fieldId: "utilities",
    title: "Required utilities",
    keywords: /\b(utilit(y|ies)|tie-?ins?|ducts?|piping|power|water|capacity data|heat exchange)\b/i,
  },
  {
    fieldId: "offtake_strategy",
    title: "Energy offtake",
    keywords: /\b(thermal|heat price|tariff|energy offtake|gwh|steam)\b/i,
  },
  {
    fieldId: "end_product",
    title: "Product offtake (biochar)",
    keywords: /\b(biochar|terra ?marine|carbon (credit|removal)|activated)\b/i,
  },
  {
    fieldId: "public_funding",
    title: "Subsidies",
    keywords: /\b(subsid(y|ies)|grants?|enova|innovation norway)\b/i,
  },
  {
    fieldId: "permitting",
    title: "Permitting",
    keywords: /\b(permits?|permitting|licen[sc]e|tillatelse|authorit(y|ies)|environmental approval)\b/i,
  },
];

/** Needed for the plant too, but not one of the seven. Shown right after them. */
export const DEVELOPMENT_ALSO_NEEDED: readonly UnderstandingFieldId[] = [
  "funding_source",
  "decision_maker",
];

const PILLAR_FIELD_IDS = new Set<UnderstandingFieldId>(DEVELOPMENT_PILLARS.map((p) => p.fieldId));
const ALSO_NEEDED_IDS = new Set<UnderstandingFieldId>(DEVELOPMENT_ALSO_NEEDED);

export function isDevelopmentPillarField(fieldId: UnderstandingFieldId): boolean {
  return PILLAR_FIELD_IDS.has(fieldId);
}

export function isDevelopmentAlsoNeededField(fieldId: UnderstandingFieldId): boolean {
  return ALSO_NEEDED_IDS.has(fieldId);
}

/**
 * Findings that describe the HOST's own plant (Vest Biogass), not our plant. They are read from
 * web pages and permits with sale-style wording and used to land on our steps by mistake
 * (e.g. "The site is named in the source" under Land plot).
 */
const HOST_PLANT_CLAIM =
  /^(?:Reported plant volume|Reported feedstock mix|Reported outputs|Reported start of sales)|^The site is named in the source|^The source describes plant buildings|^The source indicates gas offtake|^The source reports an environmental approval|^Permit \/ certificate filed on record|^The permit requires a closed process|^The source describes Antec ownership/i;

export function isHostPlantClaim(statement: string): boolean {
  return HOST_PLANT_CLAIM.test(statement.trim());
}

export type LinkedWorkItem = {
  id: string;
  kind: "planned" | "decided";
  text: string;
  /** Person responsible, when known. */
  owner: string;
  /** ISO date, when known. */
  date: string;
  /** Milestone status, for planned work. */
  status?: string;
};

/** The one step a piece of text belongs to, or null when it fits none (never guessed). */
export function pillarForText(text: string): UnderstandingFieldId | null {
  const matches = DEVELOPMENT_PILLARS.filter((pillar) => pillar.keywords.test(text));
  // A text that touches several steps is not evidence for any one of them.
  return matches.length === 1 ? matches[0].fieldId : null;
}

/** Project milestones and decisions grouped under the step they are about. */
export function linkedWorkByPillar(
  milestones: readonly ProjectMilestone[],
  decisions: readonly ProjectDecision[],
): Partial<Record<UnderstandingFieldId, LinkedWorkItem[]>> {
  const out: Partial<Record<UnderstandingFieldId, LinkedWorkItem[]>> = {};
  const push = (fieldId: UnderstandingFieldId | null, item: LinkedWorkItem) => {
    if (!fieldId) return;
    (out[fieldId] ??= []).push(item);
  };
  for (const milestone of milestones) {
    push(pillarForText(milestone.title), {
      id: milestone.id,
      kind: "planned",
      text: milestone.title,
      owner: milestone.owner,
      date: milestone.targetDate,
      status: milestone.status,
    });
  }
  for (const decision of decisions) {
    push(pillarForText(decision.decision), {
      id: decision.id,
      kind: "decided",
      text: decision.decision,
      owner: decision.owner,
      date: decision.date,
    });
  }
  return out;
}
