/**
 * FS-021 FR-005 — record the user's decision on one proposal.
 *
 * "accept" / "edit" / "dismiss" only records the review. It never creates or
 * modifies a Contact, Company, Relationship or Stakeholder (those need their
 * own explicit approval flows).
 */

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { resolveRequestRole } from "@/lib/api-auth";
import type { ReviewDecision } from "@/lib/ai/approval-policy";
import { decideProposal } from "@/lib/ai/knowledge-proposal-store";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";

const DECISIONS: readonly ReviewDecision[] = ["accept", "edit", "dismiss"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const role = await resolveRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  let body: { decision?: unknown; editedStatement?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const decision = DECISIONS.find((d) => d === body?.decision);
  if (!decision) {
    return NextResponse.json(
      { error: `decision must be one of: ${DECISIONS.join(", ")}` },
      { status: 400 },
    );
  }
  const editedStatement =
    typeof body.editedStatement === "string" ? body.editedStatement : null;

  const session = await auth().catch(() => null);
  const decidedBy =
    session?.user?.name?.trim() || session?.user?.email?.trim() || `role:${role}`;

  let result;
  try {
    result = await decideProposal(id, decision, decidedBy, editedStatement);
  } catch {
    return NextResponse.json(
      { error: "Proposals are not available yet." },
      { status: 503 },
    );
  }

  if (!result.ok) {
    const status =
      result.reason === "Proposal not found."
        ? 404
        : result.reason === "An edit needs the new wording."
          ? 400
          : 409;
    return NextResponse.json({ error: result.reason }, { status });
  }

  const actor = resolveAuditActor(request, role);
  await logAuditEvent({
    ...actor,
    action: "KNOWLEDGE_PROPOSAL_REVIEWED",
    entityType: "KnowledgeProposal",
    entityId: id,
    ipAddress: clientIpFromRequest(request),
    metadata: { decision, type: result.proposal.type },
  });

  return NextResponse.json({ proposal: result.proposal });
}
