/**
 * FS-022 — Sales pipelines (Project Sales & Offer Sales).
 *
 * Pipeline templates are data: adding a pipeline is configuration, not a change
 * to a shared enum. A deal's stage is an attribute of the deal (`salesStageId`);
 * there is no parallel stage store. Stage ids are neutral and shared by both
 * pipelines — only labels and the columns shown differ.
 */
import { resolveSalesMotion } from "@/lib/sales-motion";
import type { PipelineRow, PipelineStatus, SalesStageId } from "@/types/pipeline";

export type SalesPipelineId = "project-sales" | "offer-sales";

export type SalesStageKind = "open" | "won" | "lost";

export type SalesStageTemplate = {
  id: SalesStageId;
  label: string;
  kind: SalesStageKind;
  /**
   * Other stage ids this column also holds (e.g. a deal that moved from Project to
   * Offer Sales while in Qualified still needs a home). Never invented evidence — only placement.
   */
  alsoHolds?: SalesStageId[];
  /** Typical duration for stall detection. Unknown until measured (Reality First). */
  typicalDays?: number;
};

export type SalesPipelineTemplate = {
  id: SalesPipelineId;
  label: string;
  /** One line: what this pipeline is for. */
  description: string;
  stages: SalesStageTemplate[];
};

export const SALES_PIPELINES: Record<SalesPipelineId, SalesPipelineTemplate> = {
  "project-sales": {
    id: "project-sales",
    label: "Project sales",
    description: "Plants and development projects",
    stages: [
      { id: "prospecting", label: "Identified", kind: "open" },
      { id: "qualification", label: "Qualified", kind: "open" },
      { id: "discovery", label: "Validation", kind: "open" },
      { id: "proposal", label: "Proposal", kind: "open" },
      { id: "negotiation", label: "Negotiation", kind: "open" },
      { id: "won", label: "Won", kind: "won" },
      { id: "lost", label: "Lost", kind: "lost" },
    ],
  },
  "offer-sales": {
    id: "offer-sales",
    label: "Offer sales",
    description: "Products and consultancy",
    stages: [
      { id: "prospecting", label: "Interest", kind: "open" },
      { id: "discovery", label: "Needs understood", kind: "open", alsoHolds: ["qualification"] },
      { id: "proposal", label: "Quote / proposal", kind: "open" },
      { id: "negotiation", label: "Negotiation", kind: "open" },
      { id: "won", label: "Won", kind: "won" },
      { id: "lost", label: "Lost", kind: "lost" },
    ],
  },
};

export const SALES_PIPELINE_ORDER: SalesPipelineId[] = ["project-sales", "offer-sales"];

/** Delivery statuses belong to the Project, not the sale — on the board they are simply Won. */
const WON_STATUSES: ReadonlySet<PipelineStatus> = new Set<PipelineStatus>([
  "Won",
  "Reactor Manufacturing",
  "Site Installation",
  "Commissioning Phase",
  "Live Production",
  "Scheduled Maintenance",
]);

const LEGACY_STATUS_TO_STAGE: Partial<Record<PipelineStatus, SalesStageId>> = {
  Prospecting: "prospecting",
  "Feedstock Analysis": "discovery",
  "Contract Negotiation": "negotiation",
};

/** Keeps `status` consistent for every consumer that still reads the legacy field. */
const STAGE_TO_LEGACY_STATUS: Record<Exclude<SalesStageId, "lost">, PipelineStatus> = {
  prospecting: "Prospecting",
  qualification: "Prospecting",
  discovery: "Feedstock Analysis",
  proposal: "Contract Negotiation",
  negotiation: "Contract Negotiation",
  won: "Won",
};

/** The deal's sales stage: the stored stage, else derived from the legacy status. */
export function salesStageOf(deal: Pick<PipelineRow, "salesStageId" | "status">): SalesStageId {
  if (deal.salesStageId) return deal.salesStageId;
  if (WON_STATUSES.has(deal.status)) return "won";
  return LEGACY_STATUS_TO_STAGE[deal.status] ?? "prospecting";
}

/**
 * Pipeline follows the sales motion (FS-022 §4.3). Unclassified deals stay on
 * Project Sales for investigation; nothing is invented about them.
 */
export function salesPipelineFor(deal: Pick<PipelineRow, "offeringIds">): SalesPipelineId {
  const { motion } = resolveSalesMotion(deal);
  return motion === "product" || motion === "consulting" ? "offer-sales" : "project-sales";
}

export function salesPipelineUnclassified(deal: Pick<PipelineRow, "offeringIds">): boolean {
  return resolveSalesMotion(deal).motion === null;
}

/** Template column a deal sits in, or null if the pipeline has no home for its stage. */
export function columnFor(
  template: SalesPipelineTemplate,
  stage: SalesStageId,
): SalesStageTemplate | null {
  return (
    template.stages.find((s) => s.id === stage) ??
    template.stages.find((s) => s.alsoHolds?.includes(stage)) ??
    null
  );
}

export type StageMove =
  | { kind: "same" }
  | { kind: "forward" }
  | { kind: "skip"; steps: number }
  | { kind: "back" }
  | { kind: "lost" }
  | { kind: "reopen" };

/** What kind of move is this? Drives reason prompts (FS-022 §4.7). */
export function classifyMove(
  template: SalesPipelineTemplate,
  from: SalesStageId,
  to: SalesStageId,
): StageMove {
  const fromColumn = columnFor(template, from);
  const toColumn = template.stages.find((s) => s.id === to);
  if (!toColumn) return { kind: "same" };
  if (fromColumn?.id === toColumn.id) return { kind: "same" };
  if (toColumn.kind === "lost") return { kind: "lost" };
  if (fromColumn?.kind === "lost") return { kind: "reopen" };

  const ordered = template.stages.filter((s) => s.kind !== "lost");
  const fromIndex = ordered.findIndex((s) => s.id === fromColumn?.id);
  const toIndex = ordered.findIndex((s) => s.id === toColumn.id);
  if (fromIndex < 0 || toIndex < 0) return { kind: "same" };
  if (toIndex < fromIndex) return { kind: "back" };
  const steps = toIndex - fromIndex;
  return steps > 1 ? { kind: "skip", steps } : { kind: "forward" };
}

/** Is a short written reason mandatory for this move? */
export function moveRequiresReason(move: StageMove): boolean {
  return move.kind === "lost" || move.kind === "skip";
}

/** PATCH body for a stage move. `lost` leaves the legacy status as it was. */
export function stagePatch(to: SalesStageId): Partial<PipelineRow> {
  if (to === "lost") return { salesStageId: "lost" };
  return { salesStageId: to, status: STAGE_TO_LEGACY_STATUS[to] };
}

/** Registry (Prisma) stage + status for a sales stage. */
export function registryStageFor(stage: SalesStageId): {
  stage: "prospecting" | "qualification" | "discovery" | "proposal" | "negotiation" | "closed_won" | "closed_lost";
  status: "open" | "closed_won" | "closed_lost";
} {
  if (stage === "won") return { stage: "closed_won", status: "closed_won" };
  if (stage === "lost") return { stage: "closed_lost", status: "closed_lost" };
  return { stage, status: "open" };
}

/** Sales stage from a registry stage + status. `commitment` is Won — selling ends there. */
export function salesStageFromRegistry(
  stage: string,
  status: string,
): SalesStageId {
  if (status === "closed_lost" || stage === "closed_lost") return "lost";
  if (status === "closed_won" || stage === "closed_won" || stage === "commitment") return "won";
  switch (stage) {
    case "qualification":
    case "discovery":
    case "proposal":
    case "negotiation":
      return stage;
    default:
      return "prospecting";
  }
}

export type ColumnValue = {
  count: number;
  /** null when any contributing value is unknown — never a silent partial sum. */
  total: number | null;
  currency: string | null;
};

/** Column header totals (FS-022 §4.6). Unknown if any value is unknown or currencies differ. */
export function columnValue(
  deals: Array<Pick<PipelineRow, "salesValue" | "currency">>,
): ColumnValue {
  if (deals.length === 0) return { count: 0, total: 0, currency: null };
  const currencies = new Set(deals.map((d) => d.currency));
  const anyUnknown = deals.some((d) => !Number.isFinite(d.salesValue) || d.salesValue <= 0);
  if (anyUnknown || currencies.size > 1) {
    return { count: deals.length, total: null, currency: null };
  }
  return {
    count: deals.length,
    total: deals.reduce((sum, d) => sum + d.salesValue, 0),
    currency: deals[0].currency,
  };
}
