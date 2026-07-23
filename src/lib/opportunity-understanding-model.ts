import type { PipelineRow } from "@/types/pipeline";
import type {
  OpportunityUnderstandingCapture,
  UnderstandingFieldDefinition,
  UnderstandingFieldId,
} from "@/types/opportunity-understanding";
import {
  UNDERSTANDING_FIELDS,
  UNDERSTANDING_FIELD_BY_ID,
} from "@/types/opportunity-understanding";

export type ResolvedUnderstandingField = {
  definition: UnderstandingFieldDefinition;
  /** Captured or derived answer — empty means Unknown */
  value: string;
  source: "captured" | "derived" | "empty";
};

export type UnderstandingGap = {
  id: UnderstandingFieldId;
  fieldId: UnderstandingFieldId;
  priority: "high" | "medium" | "low";
  missingInformation: string;
  whyItMatters: string;
  recommendedAction: string;
};

export type UnderstandingConfirmedRow = {
  id: UnderstandingFieldId;
  topic: string;
  answer: string;
  fieldId: UnderstandingFieldId;
  source: "captured" | "derived";
};

/**
 * Derive a starting answer from existing opportunity reality so users
 * do not re-enter facts already known on the deal.
 */
function deriveFieldValue(
  pipeline: PipelineRow,
  fieldId: UnderstandingFieldId,
): string | null {
  const team = pipeline.team ?? [];

  switch (fieldId) {
    case "decision_maker": {
      const member = team.find((entry) => /decision maker/i.test(entry.projectRole));
      if (member) return `${member.projectRole} assigned on opportunity roster`;
      return null;
    }
    case "economic_buyer": {
      const member = team.find((entry) =>
        /economic buyer|budget|cfo|sponsor/i.test(entry.projectRole),
      );
      if (member) return `${member.projectRole} assigned on opportunity roster`;
      return null;
    }
    case "stakeholder_map": {
      if (team.length >= 2) {
        return `${team.length} stakeholders recorded on this opportunity`;
      }
      return null;
    }
    case "feedstock_quality": {
      if (pipeline.targetFeedstock?.trim()) {
        return `Feedstock type on record: ${pipeline.targetFeedstock.trim()}`;
      }
      return null;
    }
    case "capacity": {
      if (pipeline.reactorDesignCapacity > 0) {
        return `${pipeline.reactorDesignCapacity.toLocaleString("en-US")} kg/h design capacity on record`;
      }
      return null;
    }
    case "budget": {
      if (pipeline.salesValue > 0) {
        return `Opportunity value on record: ${pipeline.salesValue.toLocaleString("en-US")} ${pipeline.currency}`;
      }
      return null;
    }
    case "timeline": {
      if (pipeline.expectedCloseDate?.trim()) {
        return `Expected decision / close date: ${pipeline.expectedCloseDate.trim()}`;
      }
      return null;
    }
    default:
      return null;
  }
}

export function resolveUnderstandingField(
  pipeline: PipelineRow,
  fieldId: UnderstandingFieldId,
): ResolvedUnderstandingField {
  const definition = UNDERSTANDING_FIELD_BY_ID[fieldId];
  const captured = pipeline.understanding?.fields?.[fieldId]?.trim() ?? "";
  if (captured) {
    return { definition, value: captured, source: "captured" };
  }
  const derived = deriveFieldValue(pipeline, fieldId)?.trim() ?? "";
  if (derived) {
    return { definition, value: derived, source: "derived" };
  }
  return { definition, value: "", source: "empty" };
}

export function resolveAllUnderstandingFields(
  pipeline: PipelineRow,
): ResolvedUnderstandingField[] {
  return UNDERSTANDING_FIELDS.map((field) => resolveUnderstandingField(pipeline, field.id));
}

/**
 * Gaps are generated only from empty understanding fields.
 * No duplicate gap entry — the field itself is the capture surface.
 */
export function buildGapsFromUnderstandingModel(
  pipeline: PipelineRow,
): UnderstandingGap[] {
  const priorityRank = { high: 0, medium: 1, low: 2 };

  return resolveAllUnderstandingFields(pipeline)
    .filter((entry) => entry.source === "empty")
    .map((entry) => ({
      id: entry.definition.id,
      fieldId: entry.definition.id,
      priority: entry.definition.priority,
      missingInformation: entry.definition.gapLabel,
      whyItMatters: entry.definition.whyItMatters,
      recommendedAction: entry.definition.recommendedAction,
    }))
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
    .slice(0, 10);
}

/**
 * Confirmed understanding rows from captured or derived answers.
 */
export function buildConfirmedFromUnderstandingModel(
  pipeline: PipelineRow,
): UnderstandingConfirmedRow[] {
  return resolveAllUnderstandingFields(pipeline)
    .filter(
      (entry): entry is ResolvedUnderstandingField & { source: "captured" | "derived" } =>
        entry.source === "captured" || entry.source === "derived",
    )
    .map((entry): UnderstandingConfirmedRow => ({
      id: entry.definition.id,
      topic: entry.definition.label,
      answer:
        entry.source === "derived"
          ? `${entry.value} (from opportunity record — confirm or refine)`
          : entry.value,
      fieldId: entry.definition.id,
      source: entry.source,
    }));
}

export function patchUnderstandingCapture(
  current: OpportunityUnderstandingCapture | undefined,
  fieldId: UnderstandingFieldId,
  value: string,
): OpportunityUnderstandingCapture {
  const fields = { ...(current?.fields ?? {}) };
  const trimmed = value.trim();
  if (trimmed) {
    fields[fieldId] = trimmed;
  } else {
    delete fields[fieldId];
  }
  return {
    fields,
    updatedAt: new Date().toISOString(),
  };
}
