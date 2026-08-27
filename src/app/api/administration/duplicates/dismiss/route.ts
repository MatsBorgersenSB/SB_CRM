import { NextResponse } from "next/server";
import { dismissCompanyCluster } from "@/lib/duplicate-management";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";
import { requireAdminRole } from "@/lib/security/require-admin";

export const dynamic = "force-dynamic";

/**
 * FS-020 — suppress a company duplicate cluster ("Not a duplicate").
 * POST { memberIds: string[], note?: string }
 */
export async function POST(request: Request) {
  const gate = requireAdminRole(request);
  if ("error" in gate) return gate.error;
  const { role } = gate;

  let body: { memberIds?: string[]; note?: string; companyId?: string };
  try {
    body = (await request.json()) as {
      memberIds?: string[];
      note?: string;
      companyId?: string;
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const memberIds = Array.isArray(body.memberIds)
    ? body.memberIds.map((id) => String(id).trim()).filter(Boolean)
    : [];

  if (memberIds.length < 2) {
    return NextResponse.json(
      { error: "memberIds must include at least two company ids" },
      { status: 400 },
    );
  }

  try {
    const actor = resolveAuditActor(request, role);
    const result = await dismissCompanyCluster({
      memberIds,
      note: body.note,
      companyId: body.companyId,
      userEmail: actor.userEmail,
      userDisplayName: actor.userName,
    });

    await logAuditEvent({
      ...actor,
      action: "COMPANY_DUPLICATE_DISMISSED",
      entityType: "Company",
      entityId: memberIds[0]!,
      ipAddress: clientIpFromRequest(request),
      metadata: {
        privileged: true,
        suggestionKey: result.suggestionKey,
        memberIds,
        note: body.note?.trim() || "Not the same company",
      },
    });

    return NextResponse.json({ ok: true, suggestionKey: result.suggestionKey });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Dismiss failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
