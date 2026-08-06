"use client";

import { useCallback, useEffect, useState } from "react";
import { mailtoHref, m365ComposeHref } from "@/lib/compose-actions";
import type { CriticalPathAnalysis } from "@/lib/execution/critical-path-types";

type CriticalPathPredictorPanelProps = {
  projectId: string;
  projectTitle: string;
};

const RISK_STYLES = {
  HIGH: "border-thermal-red/30 bg-thermal-red/5 text-thermal-red",
  MEDIUM: "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange",
} as const;

export function CriticalPathPredictorPanel({
  projectId,
  projectTitle,
}: CriticalPathPredictorPanelProps) {
  const [analysis, setAnalysis] = useState<CriticalPathAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/bottlenecks`,
      );
      const body = (await response.json()) as {
        analysis?: CriticalPathAnalysis;
        error?: string;
      };
      if (!response.ok || !body.analysis) {
        setError(body.error ?? "Failed to load critical path");
        setAnalysis(null);
        return;
      }
      setAnalysis(body.analysis);
    } catch {
      setError("Critical path predictor unavailable");
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const sendExpediteNudge = (params: {
    vendorName: string | null;
    title: string;
    delayDays: number;
    mitigationSuggestion: string;
  }) => {
    const vendor = params.vendorName?.trim() || "Vendor";
    const subject = `Expedite request — ${projectTitle}: ${params.title}`;
    const body = [
      `Hello ${vendor} team,`,
      ``,
      `We are tracking a critical-path risk on "${params.title}" for project "${projectTitle}".`,
      `Current delay signal: +${params.delayDays} day(s) vs target.`,
      ``,
      `Requested action:`,
      params.mitigationSuggestion,
      ``,
      `Please confirm revised delivery date and recovery plan within 48 hours.`,
      ``,
      `Thank you,`,
      `Standard Bio Project Team`,
    ].join("\n");

    const to = "procurement@standard.bio";
    const href =
      m365ComposeHref(to, subject, body) || mailtoHref(to, subject, body);
    if (href) {
      window.open(href, "_blank", "noopener,noreferrer");
    }
  };

  if (loading) {
    return (
      <p className="border-t border-carbon-blue/8 px-3 py-2 text-[10px] text-carbon-blue/40">
        Evaluating critical path…
      </p>
    );
  }

  if (error) {
    return (
      <p className="border-t border-carbon-blue/8 px-3 py-2 text-[10px] text-thermal-red">
        {error}
      </p>
    );
  }

  if (!analysis) return null;

  const delayed = analysis.estimatedCodDelayDays > 0;

  return (
    <div className="border-t border-carbon-blue/8 bg-carbon-blue/[0.015] px-3 py-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Critical Path & Bottlenecks
          </p>
          <p className="text-[11px] font-semibold text-carbon-blue">
            COD Target & Delay Impact
          </p>
        </div>
        <p className="text-[10px] text-carbon-blue/50">
          Lead time {analysis.totalLeadTimeDays}d ·{" "}
          {analysis.criticalMilestoneCount} critical gates
        </p>
      </div>

      {/* COD delay banner */}
      <div
        className={`mt-2 border px-2.5 py-2 text-[11px] font-semibold ${
          delayed
            ? "border-thermal-red/30 bg-thermal-red/5 text-thermal-red"
            : "border-emerald-600/25 bg-emerald-50 text-emerald-800"
        }`}
      >
        {delayed
          ? `Estimated Plant COD Delayed by +${analysis.estimatedCodDelayDays} Days`
          : "Critical path on track — no COD delay predicted"}
      </div>

      {analysis.bottlenecks.length === 0 ? (
        <p className="mt-2 text-[10px] text-carbon-blue/50">
          No overdue or slipping critical-path milestones (&gt;5 days behind
          target).
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {analysis.bottlenecks.map((bottleneck) => (
            <div
              key={bottleneck.milestoneId}
              className="border border-carbon-blue/10 bg-[var(--dashboard-surface)] px-2.5 py-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-carbon-blue">
                    {bottleneck.title}
                  </p>
                  <p className="text-[9px] text-carbon-blue/50">
                    {bottleneck.stage}
                    {bottleneck.vendorName
                      ? ` · ${bottleneck.vendorName}`
                      : ""}
                    {bottleneck.estimatedLeadDays != null
                      ? ` · ${bottleneck.estimatedLeadDays}d lead`
                      : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 border px-1.5 py-0.5 text-[9px] font-semibold ${RISK_STYLES[bottleneck.riskLevel]}`}
                >
                  {bottleneck.riskLevel} · +{bottleneck.delayDays}d
                </span>
              </div>
              <p className="mt-1.5 text-[10px] leading-relaxed text-carbon-blue/60">
                {bottleneck.mitigationSuggestion}
              </p>
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() =>
                    sendExpediteNudge({
                      vendorName: bottleneck.vendorName,
                      title: bottleneck.title,
                      delayDays: bottleneck.delayDays,
                      mitigationSuggestion: bottleneck.mitigationSuggestion,
                    })
                  }
                  className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-1 text-[9px] font-semibold text-upcycle-orange hover:bg-upcycle-orange/15"
                >
                  Send Vendor Expedite Nudge
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
