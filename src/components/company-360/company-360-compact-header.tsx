import type { Company360Snapshot } from "@/lib/company-360-data";
import { TREND_STYLES, HEALTH_STATUS_STYLES } from "@/components/relationship/relationship-health-display";
import type { RelationshipHealthStatus } from "@/lib/relationship-health-engine";

const HEALTH_DOT: Record<RelationshipHealthStatus, string> = {
  Strategic: "bg-emerald-500",
  Strong: "bg-emerald-500",
  Healthy: "bg-emerald-500",
  Weak: "bg-upcycle-orange",
  "At Risk": "bg-red-500",
};

/** Compact context strip on non-overview tabs. */
export function Company360CompactHeader({ snapshot }: { snapshot: Company360Snapshot }) {
  const { header } = snapshot;

  return (
    <div className="dashboard-card px-6 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-carbon-blue">{header.companyName}</h1>
        <span
          className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-semibold ${HEALTH_STATUS_STYLES[header.healthStatus]}`}
        >
          <span className={`size-1.5 rounded-full ${HEALTH_DOT[header.healthStatus]}`} aria-hidden />
          {header.healthScore}
        </span>
      </div>
      <p className="mt-1 text-[11px] text-carbon-blue/50">
        <span className={`font-medium ${TREND_STYLES[header.trend]}`}>{header.trend}</span>
        {" · "}
        {header.location !== "—" ? header.location : "No location"}
      </p>
    </div>
  );
}
