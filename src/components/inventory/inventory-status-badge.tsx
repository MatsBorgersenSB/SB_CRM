import type { CriticalStatus } from "@/lib/inventory-data";

const statusLabels: Record<CriticalStatus, string> = {
  stable: "Stable",
  operational: "Operational",
  high_temp: "High Temp",
  warning: "Warning",
  critical: "Critical",
  offline: "Offline",
};

const statusStyles: Record<CriticalStatus, string> = {
  stable: "border-upcycle-orange/30 bg-upcycle-orange/15 text-upcycle-orange",
  operational: "border-upcycle-orange/30 bg-upcycle-orange/15 text-upcycle-orange",
  high_temp: "border-flame bg-flame/35 text-carbon-blue",
  warning: "border-flame/60 bg-flame/25 text-carbon-blue",
  critical: "border-carbon-blue/20 bg-carbon-blue/5 text-carbon-blue/60",
  offline: "border-carbon-blue/20 bg-carbon-blue/5 text-carbon-blue/60",
};

export function InventoryStatusBadge({ status }: { status: CriticalStatus }) {
  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${statusStyles[status]}`}
    >
      {statusLabels[status]}
    </span>
  );
}
