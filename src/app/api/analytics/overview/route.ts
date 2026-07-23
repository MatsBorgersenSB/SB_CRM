import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { buildAnalyticsOverview } from "@/lib/analytics/pipeline-analytics";
import { loadAnalyticsDeals } from "@/lib/analytics/load-analytics-deals";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";

/**
 * GET /api/analytics/overview
 * Aggregates win/loss, velocity, and weighted forecast across active/closed deals.
 */
export async function GET(request: Request) {
  const role = getRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { deals, source } = await loadAnalyticsDeals();
    const overview = buildAnalyticsOverview(deals);

    const actor = resolveAuditActor(request, role);
    await logAuditEvent({
      ...actor,
      action: "ANALYTICS_VIEWED",
      entityType: "Analytics",
      entityId: "overview",
      ipAddress: clientIpFromRequest(request),
      metadata: {
        dealCount: deals.length,
        source,
        winRatePercent: overview.winLoss.winRatePercent,
        weightedPipelineValue: overview.forecast.weightedPipelineValue,
      },
    });

    return NextResponse.json({
      success: true,
      source,
      ...overview,
    });
  } catch (error) {
    console.error("[analytics/overview]", error);
    return NextResponse.json(
      { error: "Failed to load analytics overview" },
      { status: 500 },
    );
  }
}
