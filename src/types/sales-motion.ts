/**
 * Sales motion — how Standard Bio sells, which decides how much investigation an
 * opportunity needs. Derived from the offerings in scope (single source of truth).
 *
 * - system     Pyrolysis system sale: long, project-driven, full investigation.
 * - product    Product / equipment / material sale (e.g. biochar, a dryer): quote → order.
 * - consulting Paid consulting / service sale: scope → fee → deliver.
 */

import type {
  CommercialViabilityDimensionId,
  FatalFlawId,
} from "@/types/commercial-viability";
import type {
  UnderstandingFieldDefinition,
  UnderstandingFieldId,
} from "@/types/opportunity-understanding";

export type SalesMotion = "system" | "product" | "consulting";

export const SALES_MOTIONS: SalesMotion[] = ["system", "product", "consulting"];

/** How deep SmartAssist investigates before recommending a next step. */
export type InvestigationDepth = "full" | "minimal";

export type UnderstandingFieldOverride = Partial<
  Pick<
    UnderstandingFieldDefinition,
    | "label"
    | "prompt"
    | "placeholder"
    | "gapLabel"
    | "whyItMatters"
    | "recommendedAction"
    | "priority"
  >
>;

export type SalesMotionProfile = {
  motion: SalesMotion;
  label: string;
  /** One line — what the selling process looks like. */
  process: string;
  depth: InvestigationDepth;
  /** Understanding fields that matter for this motion. */
  understandingFieldIds: UnderstandingFieldId[];
  /** Motion-specific wording for shared understanding fields. */
  fieldOverrides: Partial<Record<UnderstandingFieldId, UnderstandingFieldOverride>>;
  /** Commercial viability dimensions that apply. */
  viabilityDimensionIds: CommercialViabilityDimensionId[];
  /** Fatal-flaw checks that apply. */
  fatalFlawIds: FatalFlawId[];
  /** Raise "no customer dialogue logged" as a gap. */
  engagementGap: boolean;
  /** Max offering-specific discovery questions to surface. */
  offeringQuestionLimit: number;
  /** Project-development views (maturity, feedstock/site/permit checks) apply. */
  projectInvestigation: boolean;
};

export type ResolvedSalesMotion = {
  /** `null` — offerings unknown, so motion stays unclassified (full investigation). */
  motion: SalesMotion | null;
  label: string;
  /** Why this motion was chosen — for transparency. */
  reason: string;
};
