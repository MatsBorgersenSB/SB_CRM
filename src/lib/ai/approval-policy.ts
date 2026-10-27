/**
 * FS-021 FR-003 — Confidence and approval policy. Pure; no I/O.
 *
 * The system proposes; the user decides. Nothing here applies anything.
 * Callers use `decideApproval` to learn whether an action may ever be applied
 * without a click, and `reviewTransition` to move a proposal through review.
 */

import type { KnowledgeProposal, KnowledgeType } from "@/lib/ai/knowledge-proposal";

/** What the caller wants to do with a proposal. */
export type ProposalAction =
  | "store_note" // attach prose to an existing record
  | "log_activity" // log a past event on an existing record
  | "create_entity" // new Contact / Company / Relationship / Stakeholder
  | "modify_entity"; // change an existing Contact / Company / Relationship / Stakeholder

export type ApprovalMode =
  | "auto_apply_undoable" // may apply now; must be listed as "applied" with undo
  | "suggest" // show it; the user accepts
  | "requires_approval"; // never automatic, whatever the confidence

export type ApprovalDecision = { mode: ApprovalMode; reason: string };

const LOW_RISK_ACTIONS: ReadonlySet<ProposalAction> = new Set([
  "store_note",
  "log_activity",
]);

export function decideApproval(
  proposal: Pick<KnowledgeProposal, "type" | "confidence">,
  action: ProposalAction,
): ApprovalDecision {
  if (action === "create_entity" || action === "modify_entity") {
    return {
      mode: "requires_approval",
      reason:
        "Contacts, companies, relationships and stakeholders always need the user's approval.",
    };
  }
  // A relationship statement is a claim about people/companies; never self-apply.
  if (proposal.type === "relationship") {
    return {
      mode: "requires_approval",
      reason: "Relationship knowledge always needs the user's approval.",
    };
  }
  if (proposal.confidence === "high" && LOW_RISK_ACTIONS.has(action)) {
    return {
      mode: "auto_apply_undoable",
      reason: "High confidence and low risk; applied with undo.",
    };
  }
  return { mode: "suggest", reason: "Shown for the user to accept, edit or dismiss." };
}

/**
 * Types that have no owning record yet and so are held as proposals.
 * Commitments are excluded on purpose: they live in MeetingCommitmentRecord
 * (FS-014), and FS-021 forbids duplicating knowledge across stores.
 */
export const PROPOSAL_STORE_TYPES: readonly KnowledgeType[] = [
  "fact",
  "decision",
  "risk",
  "relationship",
  "unknown",
];

export function selectStorableProposals(
  proposals: readonly KnowledgeProposal[],
): KnowledgeProposal[] {
  return proposals.filter((p) => PROPOSAL_STORE_TYPES.includes(p.type));
}

// ---- Review lifecycle -------------------------------------------------------

export type ProposalStatus = "proposed" | "accepted" | "edited" | "dismissed";
export type ReviewDecision = "accept" | "edit" | "dismiss";

export type ReviewTransition =
  | { ok: true; status: ProposalStatus; statement: string | null }
  | { ok: false; reason: string };

/**
 * Only a pending (`proposed`) item can be decided. An edit must carry new text
 * (the user's wording replaces the model's). Never throws.
 */
export function reviewTransition(
  current: ProposalStatus,
  decision: ReviewDecision,
  editedStatement?: string | null,
): ReviewTransition {
  if (current !== "proposed") {
    return { ok: false, reason: "This proposal has already been reviewed." };
  }
  if (decision === "accept") return { ok: true, status: "accepted", statement: null };
  if (decision === "dismiss") return { ok: true, status: "dismissed", statement: null };

  const text = editedStatement?.trim() ?? "";
  if (!text) return { ok: false, reason: "An edit needs the new wording." };
  return { ok: true, status: "edited", statement: text };
}
