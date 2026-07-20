import { CapacityProgressBar } from "@/components/inventory/capacity-progress-bar";
import { InventoryStatusBadge } from "@/components/inventory/inventory-status-badge";
import type { InventoryLedgerRow } from "@/lib/inventory-data";

function flowVelocityTone(flowVelocity: string): string {
  if (flowVelocity.startsWith("+")) return "text-upcycle-orange";
  if (flowVelocity.startsWith("-")) return "text-flame";
  return "text-carbon-blue/60";
}

export function InventoryLedgerTable({ rows }: { rows: InventoryLedgerRow[] }) {
  return (
    <section className="border border-carbon-blue/15 bg-white">
      <header className="border-b border-carbon-blue/10 px-3 py-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
          Capacity &amp; Velocity Ledger
        </h2>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: 112 }} />
            <col />
            <col style={{ width: 148 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 108 }} />
            <col style={{ width: 104 }} />
          </colgroup>
          <thead>
            <tr className="border-b border-carbon-blue/15 bg-carbon-blue/[0.03]">
              {[
                "Location",
                "Material Type",
                "Capacity Utilization",
                "Current Telemetry",
                "Flow Velocity",
                "Critical Status",
              ].map((header) => (
                <th
                  key={header}
                  className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.location}
                className="border-b border-carbon-blue/10 last:border-b-0 hover:bg-flame/10"
              >
                <td className="px-2 py-1 font-mono text-[11px] text-carbon-blue/55">
                  {row.location}
                </td>
                <td className="px-2 py-1 text-xs text-carbon-blue">{row.materialType}</td>
                <td className="px-2 py-1">
                  <CapacityProgressBar value={row.capacityUtilization} />
                </td>
                <td className="px-2 py-1 font-mono text-[11px] text-carbon-blue/70">
                  {row.currentTelemetry}
                </td>
                <td
                  className={`px-2 py-1 font-mono text-[11px] tabular-nums ${flowVelocityTone(row.flowVelocity)}`}
                >
                  {row.flowVelocity}
                </td>
                <td className="px-2 py-1">
                  <InventoryStatusBadge status={row.criticalStatus} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
