import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { calculateDealRiskScore } from "@/lib/ai/deal-velocity";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";
import { isFollowUpOpen, isFollowUpOverdue } from "@/lib/activity-utils";
import { readLiveActivities } from "@/lib/prisma-data";
import { getServerSharePointServices } from "@/services/sharepoint/factory";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";

/**
 * GET /api/ai/deal-insights/[id]
 * Real-time velocity scoring + next-best-action recommendations.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const role = getRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  try {
    const { deals } = getServerSharePointServices();
    const deal = await deals.getById(id);
    const activities = await readLiveActivities().catch(() => []);

    const dealActivities = activities.filter((activity) => {
      const deal = activity.Deal;
      if (!deal) return false;
      if ("DealID" in deal && deal.DealID === id) return true;
      if ("Title" in deal && deal.Title === id) return true;
      return false;
    });

    const now = Date.now();
    const activityCount30d = dealActivities.filter((activity) => {
      const ts = new Date(activity.ActivityDate).getTime();
      return Number.isFinite(ts) && now - ts <= 30 * 24 * 60 * 60 * 1000;
    }).length;

    const lastActivityAt =
      dealActivities
        .map((activity) => activity.ActivityDate)
        .filter(Boolean)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;

    const velocity = calculateDealRiskScore({
      id: deal.id,
      assetName: deal.assetName,
      status: deal.status,
      salesValue: deal.salesValue,
      probability: deal.probability,
      expectedCloseDate: deal.expectedCloseDate,
      lastActivityAt,
      activityCount30d,
      openCommitments: dealActivities.filter(isFollowUpOpen).length,
      overdueActions: dealActivities.filter(isFollowUpOverdue).length,
      hasOwner: Boolean(deal.opportunityOwner),
      offeringCount: deal.offeringIds?.length ?? 0,
    });

    const actor = resolveAuditActor(request, role);
    await logAuditEvent({
      ...actor,
      action: "DEAL_INSIGHTS_VIEWED",
      entityType: "Deal",
      entityId: id,
      ipAddress: clientIpFromRequest(request),
      metadata: {
        riskLevel: velocity.riskLevel,
        velocityScore: velocity.velocityScore,
      },
    });

    return NextResponse.json({
      success: true,
      dealId: id,
      dealName: deal.assetName,
      stage: deal.status,
      ...velocity,
    });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
