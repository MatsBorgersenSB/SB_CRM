import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";
import { canCreateOpportunity } from "@/lib/permissions";
import { promoteTenderToOpportunity } from "@/lib/tenders/promote";

export const dynamic = "force-dynamic";

type PromoteBody = {
  tenderId?: string;
};

export async function POST(request: Request) {
  const role = await resolveRequestRole(request);
  if (!canCreateOpportunity(role)) {
    return NextResponse.json(
      { error: "Insufficient role to promote tenders" },
      { status: 403 },
    );
  }

  let body: PromoteBody;
  try {
    body = (await request.json()) as PromoteBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const tenderId = body.tenderId?.trim();
  if (!tenderId) {
    return NextResponse.json({ error: "tenderId is required" }, { status: 400 });
  }

  const actor = resolveAuditActor(request, role);

  try {
    const promoted = await promoteTenderToOpportunity({
      tenderId,
      ownerId: actor.userId || "system",
    });

    await logAuditEvent({
      ...actor,
      action: "DEAL_CREATED",
      entityType: "Opportunity",
      entityId: promoted.opportunityId,
      ipAddress: clientIpFromRequest(request),
      metadata: {
        origin: "thermal_tender",
        tenderId: promoted.tenderId,
        companyId: promoted.companyId,
        stage: promoted.stageLabel,
      },
    });

    return NextResponse.json({ ok: true, ...promoted });
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status?: number }).status)
        : 500;
    const message = error instanceof Error ? error.message : "Promotion failed";
    return NextResponse.json({ error: message }, { status: Number.isFinite(status) ? status : 500 });
  }
}
