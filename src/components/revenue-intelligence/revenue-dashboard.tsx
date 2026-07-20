"use client";

import { useMemo } from "react";
import { IntelligenceLead } from "@/components/ui/intelligence-lead";
import { WorkspaceStack } from "@/components/ui/workspace-main";
import { buildRevenueIntelligence } from "@/lib/revenue-intelligence-engine";
import {
  RevenueForecastPanel,
  RevenueOpportunityCard,
  SalesPathStrip,
} from "@/components/revenue-intelligence/revenue-opportunity-card";
import { formatDealValue } from "@/types/pipeline";
import type { PipelineRow } from "@/types/pipeline";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import { useAuth } from "@/context/auth-context";
import { filterCompaniesForUser, filterPipelinesForUser } from "@/lib/permissions";

export function RevenueIntelligenceDashboard({
  companies,
  pipelines,
  activities,
  commercialPackages,
}: {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  commercialPackages: CommercialPackage[];
}) {
  const { user } = useAuth();

  const scopedCompanies = useMemo(
    () => filterCompaniesForUser(companies, user),
    [companies, user],
  );
  const scopedPipelines = useMemo(
    () => filterPipelinesForUser(pipelines, user, companies),
    [pipelines, user, companies],
  );

  const snapshot = useMemo(
    () =>
      buildRevenueIntelligence(
        scopedPipelines,
        scopedCompanies,
        activities,
        commercialPackages,
      ),
    [scopedPipelines, scopedCompanies, activities, commercialPackages],
  );

  const topDeal = snapshot.topRevenueOpportunities[0];

  return (
    <WorkspaceStack>
      <IntelligenceLead
        eyebrow="Revenue Intelligence · StandardBio"
        title="Forecast and prioritize profitable growth"
        summary="Every opportunity evaluated for machinery, professional services and recurring revenue potential — connected to realistic commercial paths."
        vitals={[
          { label: "Pipeline value", value: snapshot.metrics.totalPipelineLabel },
          {
            label: "Weighted forecast",
            value: snapshot.metrics.weightedForecastLabel,
            highlight: true,
          },
          { label: "Revenue at risk", value: snapshot.metrics.atRiskLabel },
          { label: "12-month forecast", value: snapshot.metrics.committedHorizon12mLabel },
        ]}
      />

      <section className="grid gap-3 lg:grid-cols-2">
        {snapshot.forecasts.map((forecast) => (
          <RevenueForecastPanel key={forecast.horizon} forecast={forecast} />
        ))}
      </section>

      <p className="text-[11px] font-medium text-upcycle-orange">{snapshot.pipelineGrowthLabel}</p>

      <div className="grid gap-3 lg:grid-cols-2">
        <section className="dashboard-card p-4 sm:p-5">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
            Top Revenue Opportunities
          </h2>
          <ul className="mt-3 space-y-2">
            {snapshot.topRevenueOpportunities.map((opp) => (
              <li key={opp.dealId}>
                <RevenueOpportunityCard opp={opp} />
              </li>
            ))}
          </ul>
        </section>

        <section className="dashboard-card p-4 sm:p-5">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
            Highest Value Consulting Opportunities
          </h2>
          <ul className="mt-3 space-y-2">
            {snapshot.topConsultingOpportunities.map((opp) => (
              <li key={opp.dealId}>
                <RevenueOpportunityCard opp={opp} />
                <p className="mt-0.5 pl-3 text-[9px] text-carbon-blue/45">
                  {opp.primaryServiceCategory} ·{" "}
                  {formatDealValue(
                    opp.currency as PipelineRow["currency"],
                    opp.professionalServicePotential,
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="dashboard-card p-4 sm:p-5">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
            Highest Value Machinery Opportunities
          </h2>
          <ul className="mt-3 space-y-2">
            {snapshot.topMachineryOpportunities.map((opp) => (
              <li key={opp.dealId}>
                <RevenueOpportunityCard opp={opp} />
                <p className="mt-0.5 pl-3 text-[9px] text-carbon-blue/45">
                  Machinery ·{" "}
                  {formatDealValue(
                    opp.currency as PipelineRow["currency"],
                    opp.machineryPotential,
                  )}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <section className="dashboard-card p-4 sm:p-5">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
            Revenue At Risk
          </h2>
          {snapshot.revenueAtRisk.length === 0 ? (
            <p className="mt-3 text-[11px] text-carbon-blue/45">No revenue flagged at risk.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {snapshot.revenueAtRisk.map((opp) => (
                <li key={opp.dealId}>
                  <RevenueOpportunityCard opp={opp} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {topDeal ? (
        <section className="dashboard-card p-4 sm:p-5">
          <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
            Sales Path Model · {topDeal.dealName}
          </h2>
          <p className="mt-2 text-[11px] text-carbon-blue/55">
            Relationship → Consulting → Engineering → Proposal → Machinery Contract
          </p>
          <div className="mt-3">
            <SalesPathStrip path={topDeal.salesPath} />
          </div>
          <dl className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <EconomicsField
              label="Project value"
              value={formatDealValue(
                topDeal.currency as PipelineRow["currency"],
                topDeal.economics.estimatedProjectValue,
              )}
            />
            <EconomicsField
              label="Service value"
              value={formatDealValue(
                topDeal.currency as PipelineRow["currency"],
                topDeal.economics.estimatedServiceValue,
              )}
            />
            <EconomicsField
              label="Machinery value"
              value={formatDealValue(
                topDeal.currency as PipelineRow["currency"],
                topDeal.economics.expectedMachineryValue,
              )}
            />
            <EconomicsField
              label="Lifetime value"
              value={formatDealValue(
                topDeal.currency as PipelineRow["currency"],
                topDeal.economics.expectedLifetimeValue,
              )}
            />
            <EconomicsField
              label="Partnership value"
              value={formatDealValue(
                topDeal.currency as PipelineRow["currency"],
                topDeal.economics.expectedPartnershipValue,
              )}
            />
          </dl>
        </section>
      ) : null}

      <section className="dashboard-card p-4 sm:p-5">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
          Market Returns
        </h2>
        <ul className="mt-3 space-y-2">
          {snapshot.marketReturns.map((market) => (
            <li
              key={market.market}
              className="flex items-center justify-between rounded-lg border border-carbon-blue/8 px-3 py-2"
            >
              <div>
                <p className="text-[11px] font-semibold text-carbon-blue">{market.market}</p>
                <p className="text-[10px] text-carbon-blue/45">
                  {market.opportunityCount} opportunities · {market.averageProbability}% avg
                  probability
                </p>
              </div>
              <span className="text-[11px] font-bold tabular-nums text-carbon-blue">
                {market.totalPotentialLabel}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="dashboard-card p-4 sm:p-5">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
          Revenue Intelligence Answers
        </h2>
        <ul className="mt-3 space-y-3">
          {snapshot.aiInsights.map((insight) => (
            <li key={insight.question} className="border-l-2 border-upcycle-orange/30 pl-3">
              <p className="text-[10px] font-semibold text-carbon-blue">{insight.question}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-carbon-blue/60">
                {insight.answer}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </WorkspaceStack>
  );
}

function EconomicsField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/35">
        {label}
      </dt>
      <dd className="mt-0.5 text-[12px] font-semibold tabular-nums text-carbon-blue">{value}</dd>
    </div>
  );
}
