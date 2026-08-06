"use client";

import type { Project } from "@/types/project";

export function ProjectCommandUrgentBanner({
  project,
  hasAccount,
  onLinkAccount,
  onReviewRisks,
  onOpenStageGates,
}: {
  project: Project;
  hasAccount: boolean;
  onLinkAccount: () => void;
  onReviewRisks: () => void;
  onOpenStageGates: () => void;
}) {
  const needsHealth =
    project.health === "Needs Attention" || project.health === "At Risk";
  const missingAccount = !hasAccount;

  if (!needsHealth && !missingAccount) return null;

  const title = missingAccount
    ? "Account missing — project cannot progress cleanly"
    : `Project health: ${project.health}`;

  const detail = missingAccount
    ? "Link the primary customer organization so stakeholders, quality gates, and decisions have a real account context."
    : project.risks[0]?.risk ||
      "Review open risks and stage-gates, then decide the next commercial or delivery action.";

  return (
    <div
      className="border border-thermal-red/30 bg-thermal-red/5 px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-thermal-red">
        Needs attention
      </p>
      <p className="mt-1 text-[15px] font-semibold text-carbon-blue">{title}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-carbon-blue/65">{detail}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {missingAccount ? (
          <button
            type="button"
            onClick={onLinkAccount}
            className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-xs font-semibold text-white hover:bg-upcycle-orange/90"
          >
            Link account
          </button>
        ) : null}
        {needsHealth ? (
          <button
            type="button"
            onClick={onReviewRisks}
            className="border border-carbon-blue/20 bg-white px-3 py-1.5 text-xs font-semibold text-carbon-blue hover:border-carbon-blue/40"
          >
            Review risks &amp; actions
          </button>
        ) : null}
        <button
          type="button"
          onClick={onOpenStageGates}
          className="border border-carbon-blue/20 bg-white px-3 py-1.5 text-xs font-semibold text-carbon-blue hover:border-carbon-blue/40"
        >
          Open Stage-Gates &amp; QA
        </button>
      </div>
    </div>
  );
}
