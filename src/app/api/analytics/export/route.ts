import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import {
  dealsToCsv,
  filterAnalyticsDeals,
} from "@/lib/analytics/pipeline-analytics";
import { loadAnalyticsDeals } from "@/lib/analytics/load-analytics-deals";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";
import { canExportAnalytics } from "@/lib/security/rbac";

/**
 * GET /api/analytics/export
 * Query: from, to, stage, owner
 * CSV export — ADMIN / MANAGER only.
 */
export async function GET(request: Request) {
  const role = getRequestRole(request);

  if (!canExportAnalytics({ role })) {
    return NextResponse.json(
      { error: "Forbidden — analytics export requires ADMIN or MANAGER" },
      { status: 403 },
    );
  }

  try {
    const url = new URL(request.url);
    const filters = {
      from: url.searchParams.get("from"),
      to: url.searchParams.get("to"),
      stage: url.searchParams.get("stage"),
      owner: url.searchParams.get("owner"),
    };

    const { deals, source } = await loadAnalyticsDeals();
    const filtered = filterAnalyticsDeals(deals, filters);
    const csv = dealsToCsv(filtered);
    const stamp = new Date().toISOString().slice(0, 10);
    const filename = `smartcrm-pipeline-report-${stamp}.csv`;

    const actor = resolveAuditActor(request, role);
    await logAuditEvent({
      ...actor,
      action: "ANALYTICS_REPORT_EXPORTED",
      entityType: "Analytics",
      entityId: "export",
      ipAddress: clientIpFromRequest(request),
      metadata: {
        rowCount: filtered.length,
        source,
        filters,
      },
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[analytics/export]", error);
    return NextResponse.json(
      { error: "Failed to export analytics report" },
      { status: 500 },
    );
  }
}
