/**
 * FS-021 FR-005 — Proposal Inbox: list AI-proposed knowledge awaiting review.
 *
 * Read-only. Proposals are suggestions; nothing here creates or modifies a
 * Contact, Company, Relationship or Stakeholder.
 */

import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { listPendingProposals } from "@/lib/ai/knowledge-proposal-store";

export const dynamic = "force-dynamic";

function param(url: URL, key: string): string | null {
  const v = url.searchParams.get(key)?.trim();
  return v ? v : null;
}

export async function GET(request: Request) {
  const role = await resolveRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(request.url);
  const scope = {
    meetingId: param(url, "meetingId"),
    opportunityId: param(url, "opportunityId"),
    companyId: param(url, "companyId"),
    all: param(url, "all") === "1",
  };
  if (!scope.all && !scope.meetingId && !scope.opportunityId && !scope.companyId) {
    return NextResponse.json(
      { error: "Provide meetingId, opportunityId, companyId, or all=1." },
      { status: 400 },
    );
  }

  try {
    const proposals = await listPendingProposals(scope);
    return NextResponse.json({ proposals });
  } catch {
    // Table may not exist until the knowledge_proposals migration is applied.
    // Unknown over fiction: report nothing pending rather than an error wall.
    return NextResponse.json({ proposals: [], unavailable: true });
  }
}
