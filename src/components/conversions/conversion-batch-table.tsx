import type { ConversionBatch } from "@/lib/conversions-data";
import { ConversionStatusBadge } from "@/components/conversions/conversion-status-badge";

export function ConversionBatchTable({ batches }: { batches: ConversionBatch[] }) {
  return (
    <section className="border border-carbon-blue/15 bg-white">
      <header className="border-b border-carbon-blue/10 px-3 py-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
          Historical Facility Batches
        </h2>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col style={{ width: 88 }} />
            <col />
            <col style={{ width: 120 }} />
            <col style={{ width: 104 }} />
          </colgroup>
          <thead>
            <tr className="border-b border-carbon-blue/15 bg-carbon-blue/[0.03]">
              {["Batch ID", "Feedstock Source", "Total Throughput", "Final Status"].map(
                (header) => (
                  <th
                    key={header}
                    className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45"
                  >
                    {header}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => (
              <tr
                key={batch.id}
                className="border-b border-carbon-blue/10 last:border-b-0 hover:bg-flame/10"
              >
                <td className="px-2 py-1 font-mono text-[11px] text-carbon-blue/55">
                  {batch.id}
                </td>
                <td className="px-2 py-1 text-xs text-carbon-blue">{batch.feedstock}</td>
                <td className="px-2 py-1 font-mono text-[11px] text-carbon-blue">
                  {batch.throughput}
                </td>
                <td className="px-2 py-1">
                  <ConversionStatusBadge status={batch.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
