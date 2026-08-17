import { InventoryLedgerTable } from "@/components/inventory/inventory-ledger-table";
import { InventoryMetricCards } from "@/components/inventory/inventory-metric-cards";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { readLiveInventory } from "@/lib/prisma-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InventoryPage() {
  const inventory = await readLiveInventory();

  const metricCards = [
    {
      label: "Bio-Oil Reserves",
      value: inventory.metrics.bioOilReserves.value,
      velocity: inventory.metrics.bioOilReserves.velocity,
    },
    {
      label: "Biochar Silos",
      value: inventory.metrics.biocharSilos.value,
      velocity: inventory.metrics.biocharSilos.velocity,
    },
    {
      label: "Unprocessed Feedstock",
      value: inventory.metrics.unprocessedFeedstock.value,
      velocity: inventory.metrics.unprocessedFeedstock.velocity,
    },
    {
      label: "Global Capacity Utilized",
      value: inventory.metrics.globalCapacityUtilized.value,
      velocity: inventory.metrics.globalCapacityUtilized.velocity,
    },
  ];

  return (
    <WorkspaceChrome>
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/15 bg-white px-4">
          <h1 className="text-sm font-semibold text-carbon-blue">Inventory</h1>
          <div className="flex items-center gap-2">
            <span className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-upcycle-orange">
              {inventory.ledger.length}
            </span>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-auto p-3">
          <div className="flex flex-col gap-3">
            <InventoryMetricCards metrics={metricCards} />
            <InventoryLedgerTable rows={inventory.ledger} />
          </div>
        </main>
    </WorkspaceChrome>
  );
}
