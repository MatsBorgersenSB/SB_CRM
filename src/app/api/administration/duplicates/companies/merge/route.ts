import { NextResponse } from "next/server";
import { mergeCompanies } from "@/lib/duplicate-management";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";
import { requireAdminRole } from "@/lib/security/require-admin";

export const dynamic = "force-dynamic";

/**
 * FS-020 — merge secondary company into primary (ADMIN).
 * POST { primaryId, secondaryId }
 */
export async function POST(request: Request) {
  const gate = requireAdminRole(request);
  if ("error" in gate) return gate.error;
  const { role } = gate;

  let body: { primaryId?: string; secondaryId?: string };
  try {
    body = (await request.json()) as { primaryId?: string; secondaryId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const primaryId = body.primaryId?.trim();
  const secondaryId = body.secondaryId?.trim();
  if (!primaryId || !secondaryId) {
    return NextResponse.json(
      { error: "primaryId and secondaryId are required" },
      { status: 400 },
    );
  }

  try {
    const result = await mergeCompanies(primaryId, secondaryId);
    const actor = resolveAuditActor(request, role);
    await logAuditEvent({
      ...actor,
      action: "COMPANY_MERGED",
      entityType: "Company",
      entityId: result.primaryCode,
      ipAddress: clientIpFromRequest(request),
      metadata: {
        privileged: true,
        primaryId: result.primaryId,
        primaryCode: result.primaryCode,
        secondaryId: result.secondaryId,
        secondaryCode: result.secondaryCode,
        remapped: result.remapped,
      },
    });
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Merge failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
