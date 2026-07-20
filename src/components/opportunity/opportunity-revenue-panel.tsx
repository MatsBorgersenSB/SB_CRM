"use client";

import Link from "next/link";
import { formatDealValue } from "@/types/pipeline";
import type { PipelineRow } from "@/types/pipeline";
import type { OpportunityRevenueAssessment } from "@/types/revenue-intelligence";
import { FORECAST_BUCKET_LABELS } from "@/types/revenue-intelligence";
import { SalesPathStrip } from "@/components/revenue-intelligence/revenue-opportunity-card";

export function OpportunityRevenuePanel({
  assessment,
}: {
  assessment: OpportunityRevenueAssessment;
}) {
  return (
    <section className="dashboard-card p-4 sm:p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
            Revenue Intelligence
          </p>
          <h2 className="mt-1 text-sm font-semibold text-carbon-blue">{assessment.dealName}</h2>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums text-carbon-blue">
            {assessment.probabilityOfSuccess}%
          </p>
          <p className="text-[10px] text-carbon-blue/45">Success probability</p>
        </div>
      </header>

      <div className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Metric
          label="Revenue potential"
          value={formatDealValue(
            assessment.currency as PipelineRow["currency"],
            assessment.revenuePotential,
          )}
        />
        <Metric
          label="Services"
          value={formatDealValue(
            assessment.currency as PipelineRow["currency"],
            assessment.professionalServicePotential,
          )}
        />
        <Metric
          label="Machinery"
          value={formatDealValue(
            assessment.currency as PipelineRow["currency"],
            assessment.machineryPotential,
          )}
        />
        <Metric
          label="Partnership"
          value={formatDealValue(
            assessment.currency as PipelineRow["currency"],
            assessment.partnershipValue,
          )}
        />
        <Metric label="Revenue window" value={assessment.expectedRevenueWindow} />
        <Metric label="Sales cycle" value={`${assessment.expectedSalesCycleMonths} mo`} />
      </div>

      <p className="mt-2 text-[10px] text-carbon-blue/45">
        {FORECAST_BUCKET_LABELS[assessment.forecastBucket]} · {assessment.primaryServiceCategory}
      </p>

      <div className="mt-4">
        <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/35">
          Sales path
        </p>
        <div className="mt-2">
          <SalesPathStrip path={assessment.salesPath} />
        </div>
      </div>

      {assessment.revenueAtRisk ? (
        <p className="mt-3 rounded-lg border border-red-500/25 bg-red-500/[0.04] px-3 py-2 text-[11px] text-red-800">
          Revenue at risk — stalled momentum or overdue commitments threaten forecast.
        </p>
      ) : null}

      <Link
        href="/revenue"
        className="mt-3 inline-block text-[10px] font-semibold text-upcycle-orange hover:underline"
      >
        Open Revenue Intelligence dashboard →
      </Link>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-carbon-blue/8 px-2.5 py-2">
      <p className="text-[8px] font-bold uppercase tracking-wider text-carbon-blue/35">{label}</p>
      <p className="mt-0.5 text-[11px] font-semibold text-carbon-blue">{value}</p>
    </div>
  );
}
