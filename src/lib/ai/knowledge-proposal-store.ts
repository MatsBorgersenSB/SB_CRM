/**
 * FS-021 FR-002 / FR-005 — persistence for pending AI-proposed knowledge.
 *
 * Holds proposals only. Accepting one records the user's decision; it never
 * creates or modifies a Contact, Company, Relationship or Stakeholder.
 */

import "server-only";

import {
  reviewTransition,
  selectStorableProposals,
  type ProposalStatus,
  type ReviewDecision,
} from "@/lib/ai/approval-policy";
import type {
  KnowledgeConfidence,
  KnowledgeProposal,
  KnowledgeSourceRef,
  KnowledgeType,
} from "@/lib/ai/knowledge-proposal";
import {
  loadCompanyDocumentKnowledge,
  saveCompanyDocumentKnowledge,
} from "@/lib/company-document-knowledge-data";
import { getPrisma } from "@/lib/prisma";

export type ProposalScope = {
  meetingId?: string | null;
  opportunityId?: string | null;
  companyId?: string | null;
  all?: boolean;
};

export type StoredProposal = {
  id: string;
  type: KnowledgeType;
  /** The user's wording when edited, else the model's. */
  statement: string;
  impact: string;
  evidence: string;
  confidence: KnowledgeConfidence;
  source: KnowledgeSourceRef;
  ownerHint: string | null;
  dueHint: string | null;
  meetingId?: string | null;
  opportunityId?: string | null;
  companyId?: string | null;
  status: ProposalStatus;
  createdAt: string;
};

type Row = {
  id: string;
  type: string;
  statement: string;
  impact: string;
  evidence: string;
  confidence: string;
  sourceKind: string;
  sourceId: string | null;
  sourceLabel: string;
  ownerHint: string | null;
  dueHint: string | null;
  meetingId?: string | null;
  opportunityId?: string | null;
  companyId?: string | null;
  status: string;
  editedStatement: string | null;
  createdAt: Date;
};

function toStored(row: Row): StoredProposal {
  return {
    id: row.id,
    type: row.type as KnowledgeType,
    statement: row.editedStatement ?? row.statement,
    impact: row.impact,
    evidence: row.evidence,
    confidence: row.confidence as KnowledgeConfidence,
    source: {
      kind: row.sourceKind as KnowledgeSourceRef["kind"],
      id: row.sourceId,
      label: row.sourceLabel,
    },
    ownerHint: row.ownerHint,
    dueHint: row.dueHint,
    meetingId: row.meetingId ?? null,
    opportunityId: row.opportunityId ?? null,
    companyId: row.companyId ?? null,
    status: row.status as ProposalStatus,
    createdAt: row.createdAt.toISOString(),
  };
}

function scopeWhere(scope: ProposalScope) {
  const where: Record<string, string> = {};
  if (scope.meetingId) where.meetingId = scope.meetingId;
  if (scope.opportunityId) where.opportunityId = scope.opportunityId;
  if (scope.companyId) where.companyId = scope.companyId;
  return where;
}

/**
 * Replace the still-pending proposals for a meeting with a fresh extraction.
 * Reviewed (accepted / edited / dismissed) items are never touched, so a
 * re-import cannot erase a decision. Returns how many were stored.
 */
export async function replacePendingMeetingProposals(
  meetingId: string,
  scope: Omit<ProposalScope, "meetingId">,
  proposals: readonly KnowledgeProposal[],
): Promise<number> {
  const prisma = getPrisma();
  const storable = selectStorableProposals(proposals);

  await prisma.knowledgeProposalRecord.deleteMany({
    where: { meetingId, status: "proposed" },
  });
  if (storable.length === 0) return 0;

  const reviewed = await prisma.knowledgeProposalRecord.findMany({
    where: { meetingId, status: { not: "proposed" } },
    select: { type: true, statement: true, editedStatement: true },
  });
  const decided = new Set(
    reviewed.flatMap((r) => [
      `${r.type}:${r.statement.toLowerCase()}`,
      ...(r.editedStatement ? [`${r.type}:${r.editedStatement.toLowerCase()}`] : []),
    ]),
  );
  // Do not re-propose something the user already decided on.
  const fresh = storable.filter(
    (p) => !decided.has(`${p.type}:${p.statement.toLowerCase()}`),
  );
  if (fresh.length === 0) return 0;

  const result = await prisma.knowledgeProposalRecord.createMany({
    data: fresh.map((p) => ({
      type: p.type,
      statement: p.statement,
      impact: p.impact,
      evidence: p.evidence,
      confidence: p.confidence,
      sourceKind: p.source.kind,
      sourceId: p.source.id,
      sourceLabel: p.source.label,
      ownerHint: p.ownerHint,
      dueHint: p.dueHint,
      meetingId,
      opportunityId: scope.opportunityId ?? null,
      companyId: scope.companyId ?? null,
    })),
  });
  return result.count;
}

export async function listPendingProposals(scope: ProposalScope): Promise<StoredProposal[]> {
  const where = scopeWhere(scope);
  if (!scope.all && Object.keys(where).length === 0) return [];
  const rows = await getPrisma().knowledgeProposalRecord.findMany({
    where: { ...where, status: "proposed" },
    orderBy: { createdAt: "asc" },
    take: scope.all ? 25 : undefined,
  });
  return rows.map(toStored);
}

export async function countPendingProposals(scope: ProposalScope): Promise<number> {
  const where = scopeWhere(scope);
  if (Object.keys(where).length === 0) return 0;
  return getPrisma().knowledgeProposalRecord.count({
    where: { ...where, status: "proposed" },
  });
}

export type DecideProposalResult =
  | { ok: true; proposal: StoredProposal }
  | { ok: false; reason: string };

/** Record the user's accept / edit / dismiss. Idempotent-safe: a reviewed item is refused. */
export async function decideProposal(
  id: string,
  decision: ReviewDecision,
  decidedBy: string,
  editedStatement?: string | null,
): Promise<DecideProposalResult> {
  const prisma = getPrisma();
  const row = await prisma.knowledgeProposalRecord.findUnique({ where: { id } });
  if (!row) return { ok: false, reason: "Proposal not found." };

  const next = reviewTransition(row.status as ProposalStatus, decision, editedStatement);
  if (!next.ok) return next;

  // Guard on status so two concurrent reviewers cannot both win.
  const updated = await prisma.knowledgeProposalRecord.updateMany({
    where: { id, status: "proposed" },
    data: {
      status: next.status,
      editedStatement: next.statement,
      decidedBy: decidedBy.trim() || "unknown",
      decidedAt: new Date(),
    },
  });
  if (updated.count === 0) {
    return { ok: false, reason: "This proposal has already been reviewed." };
  }

  const fresh = await prisma.knowledgeProposalRecord.findUniqueOrThrow({ where: { id } });
  const stored = toStored(fresh);

  // FS-021 Persistence rule: accepted/edited proposals materialize into the owning
  // company knowledge record as a confirmed finding (never auto-creating contacts/relationships).
  if (
    (stored.status === "accepted" || stored.status === "edited") &&
    stored.companyId &&
    stored.type !== "relationship"
  ) {
    try {
      const currentState = await loadCompanyDocumentKnowledge(stored.companyId);
      const existingFindings = currentState.findings ?? [];
      const findingId = `proposal-${stored.id}`;
      if (!existingFindings.some((f) => f.id === findingId)) {
        await saveCompanyDocumentKnowledge(stored.companyId, {
          ...currentState,
          findings: [
            ...existingFindings,
            {
              id: findingId,
              title: stored.source.label || "Meeting knowledge",
              note: stored.evidence,
              kind: "note",
              addedAt: new Date().toISOString(),
              claims: [
                {
                  id: `${findingId}-claim`,
                  statement: stored.statement,
                  impact: stored.impact,
                  decision: "confirmed",
                },
              ],
            },
          ],
        });
      }
    } catch {
      /* Materialization is best-effort if the company row is not in Prisma. */
    }
  }

  return { ok: true, proposal: stored };
}
