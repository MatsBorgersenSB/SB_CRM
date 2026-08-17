import { ConversionBatchTable } from "@/components/conversions/conversion-batch-table";
import { ConversionGrid } from "@/components/conversions/conversion-grid";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import {
  conversionBatches,
  conversionMetrics,
  emptyConversionMetrics,
  monthlyConversions,
} from "@/lib/conversions-data";
import { shouldFallbackToJsonPortfolio } from "@/lib/prisma-data";

export default function ConversionsPage() {
  const useSeed = shouldFallbackToJsonPortfolio();
  const metrics = useSeed ? conversionMetrics : emptyConversionMetrics;
  const batches = useSeed ? conversionBatches : [];
  const monthly = useSeed ? monthlyConversions : [];

  const metricCards = [
    {
      label: "Total Polymer Processed",
      value: metrics.totalPolymerProcessed,
    },
    {
      label: "Total Oil/Char Yield %",
      value: metrics.oilCharYield,
    },
    {
      label: "System Uptime",
      value: metrics.systemUptime,
    },
  ] as const;
  return (
    <WorkspaceChrome>
        <header className="flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/15 bg-white px-4">
          <h1 className="text-sm font-semibold text-carbon-blue">Conversions</h1>
          <span className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums text-upcycle-orange">
            {batches.length}
          </span>
        </header>

        <main className="flex-1 overflow-auto p-3">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-3">
              {metricCards.map((metric) => (
                <div
                  key={metric.label}
                  className="border border-carbon-blue/15 bg-white px-3 py-2.5"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                    {metric.label}
                  </p>
                  <p className="mt-1 text-xs font-semibold tabular-nums text-carbon-blue">
                    {metric.value}
                  </p>
                </div>
              ))}
            </div>

            <ConversionGrid data={monthly} />

            <ConversionBatchTable batches={batches} />
          </div>
        </main>
    </WorkspaceChrome>
  );
}
