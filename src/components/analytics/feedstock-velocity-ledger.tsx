import type { FeedstockStream } from "@/lib/analytics-data";

function stabilityTone(index: number): string {
  if (index >= 0.92) return "bg-upcycle-orange/70";
  if (index >= 0.88) return "bg-flame";
  return "bg-carbon-blue/25";
}

export function FeedstockVelocityLedger({
  streams,
}: {
  streams: FeedstockStream[];
}) {
  return (
    <section className="border border-carbon-blue/15 bg-white">
      <header className="border-b border-carbon-blue/10 px-3 py-2">
        <h2 className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
          Feedstock Processing Velocity
        </h2>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col />
            <col style={{ width: 112 }} />
            <col style={{ width: 120 }} />
          </colgroup>
          <thead>
            <tr className="border-b border-carbon-blue/15 bg-carbon-blue/[0.03]">
              {["Material Stream", "Tracking Volume", "Stability Index"].map(
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
            {streams.map((stream) => (
              <tr
                key={stream.material}
                className="border-b border-carbon-blue/10 last:border-b-0"
              >
                <td className="px-2 py-1.5 text-xs font-medium text-carbon-blue">
                  {stream.material}
                </td>
                <td className="px-2 py-1.5 font-mono text-[11px] tabular-nums text-carbon-blue">
                  {stream.trackingVolume}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 min-w-0 flex-1 bg-carbon-blue/10">
                      <div
                        className={`h-full ${stabilityTone(stream.stabilityIndex)}`}
                        style={{
                          width: `${Math.round(stream.stabilityIndex * 100)}%`,
                        }}
                      />
                    </div>
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-carbon-blue/70">
                      {stream.stabilityIndex.toFixed(2)}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
