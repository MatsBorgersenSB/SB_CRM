import { Layers } from "lucide-react";
import type { Company360MaterialTrack } from "@/lib/company-360-data";
import { formatReactorCapacity } from "@/types/pipeline";
import { DealStageTrack } from "@/components/company-360/deal-stage-track";

export function Company360MaterialsTab({
  materials,
}: {
  materials: Company360MaterialTrack[];
}) {
  if (materials.length === 0) {
    return (
      <section className="dashboard-card flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
        <Layers className="size-8 text-carbon-blue/20" strokeWidth={1.5} />
        <p className="mt-3 text-sm font-medium text-carbon-blue/70">No material tracks</p>
        <p className="mt-1 max-w-sm text-xs text-carbon-blue/45">
          Feedstock and raw material context appears when deals are linked.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {materials.map((track) => (
        <article key={track.dealId} className="dashboard-card overflow-hidden">
          <header className="border-b border-carbon-blue/8 px-5 py-4">
            <p className="font-mono text-[10px] text-carbon-blue/40">{track.dealId}</p>
            <h3 className="mt-1 text-base font-semibold text-carbon-blue">{track.feedstock}</h3>
            <p className="mt-0.5 text-[11px] text-carbon-blue/45">
              {track.dealName} · {track.companyRole}
            </p>
          </header>

          <div className="space-y-4 px-5 py-4">
            <dl className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <dt className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  Design capacity
                </dt>
                <dd className="mt-0.5 font-semibold tabular-nums text-carbon-blue">
                  {formatReactorCapacity(track.capacityKgH)}
                </dd>
              </div>
              {track.utilizationLabel ? (
                <div>
                  <dt className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                    Utilization
                  </dt>
                  <dd className="mt-0.5 font-semibold text-upcycle-orange">
                    {track.utilizationLabel}
                  </dd>
                </div>
              ) : null}
            </dl>

            {track.telemetryLabel ? (
              <p className="border border-carbon-blue/8 bg-carbon-blue/[0.02] px-3 py-2 text-[11px] text-carbon-blue/60">
                Telemetry: {track.telemetryLabel}
              </p>
            ) : null}

            <DealStageTrack status={track.status} />
          </div>
        </article>
      ))}
    </div>
  );
}
