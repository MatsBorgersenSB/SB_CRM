"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, X } from "lucide-react";
import {
  executeCoPilotProposal,
  type CoPilotExecuteResult,
} from "@/lib/smartassist-copilot-executor";
import { dismissCoPilotProposal } from "@/lib/smartassist-copilot-store";
import { proposalAsBusinessImpact } from "@/lib/smart-assist-conversation-engine";
import { SMARTASSIST_COPILOT } from "@/lib/smart-assist-config";
import { BusinessImpactCard } from "@/components/smartassist/business-impact-card";
import type { CoPilotActionProposal } from "@/types/smartassist-copilot";

function severityBorder(severity: CoPilotActionProposal["severity"]): string {
  switch (severity) {
    case "urgent":
      return "border-red-500/25 bg-red-500/[0.03]";
    case "needs_attention":
      return "border-upcycle-orange/25 bg-upcycle-orange/[0.03]";
    default:
      return "border-carbon-blue/10 bg-carbon-blue/[0.02]";
  }
}

function CoPilotProposalCard({
  proposal,
  onHandled,
  onNavigate,
}: {
  proposal: CoPilotActionProposal;
  onHandled: (id: string) => void;
  onNavigate: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<CoPilotExecuteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const businessImpact = proposalAsBusinessImpact(
    proposal,
    proposal.severity === "urgent" ? 75 : 55,
  );

  const handleApprove = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await executeCoPilotProposal(proposal);
      setFeedback(result);
      onHandled(proposal.id);
      if (result.mode === "navigate") {
        onNavigate();
        router.push(result.href);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not apply recommendation.");
    } finally {
      setBusy(false);
    }
  }, [proposal, onHandled, onNavigate, router]);

  const handleDismiss = useCallback(() => {
    dismissCoPilotProposal(proposal.id);
    onHandled(proposal.id);
  }, [proposal.id, onHandled]);

  if (feedback?.mode === "applied") {
    return (
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2.5">
        <p className="text-[10px] font-semibold text-emerald-700">Applied</p>
        <p className="mt-0.5 text-[10px] text-carbon-blue/55">{businessImpact.expectedOutcome}</p>
      </div>
    );
  }

  return (
    <article
      className={`rounded-lg border px-3 py-2.5 ${severityBorder(proposal.severity)}`}
    >
      <BusinessImpactCard recommendation={businessImpact} />

      {error ? (
        <p className="mt-2 text-[10px] text-red-600">{error}</p>
      ) : null}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void handleApprove()}
          className="inline-flex items-center gap-1 rounded-md bg-upcycle-orange px-2.5 py-1 text-[10px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          <Check className="size-3" strokeWidth={2.5} />
          {busy ? "Applying…" : "Approve"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={handleDismiss}
          className="inline-flex items-center gap-1 rounded-md border border-carbon-blue/12 px-2.5 py-1 text-[10px] font-semibold text-carbon-blue/55 transition-colors hover:bg-carbon-blue/[0.03] disabled:opacity-50"
        >
          <X className="size-3" strokeWidth={2.5} />
          Dismiss
        </button>
        {proposal.href ? (
          <button
            type="button"
            onClick={() => {
              onNavigate();
              router.push(proposal.href!);
            }}
            className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-carbon-blue/45 hover:text-carbon-blue"
          >
            Review
            <ChevronRight className="size-3" strokeWidth={2} />
          </button>
        ) : null}
      </div>
    </article>
  );
}

export function SmartAssistCopilotPanel({
  proposals,
  onRefresh,
  onNavigate,
}: {
  proposals: CoPilotActionProposal[];
  onRefresh: () => void;
  onNavigate: () => void;
}) {
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const visible = proposals.filter((proposal) => !hiddenIds.has(proposal.id));

  const handleHandled = useCallback(
    (id: string) => {
      setHiddenIds((prev) => new Set(prev).add(id));
      onRefresh();
    },
    [onRefresh],
  );

  if (visible.length === 0) return null;

  return (
    <section className="mb-4">
      <div className="mb-2">
        <p className="text-[9px] font-bold uppercase tracking-wider text-upcycle-orange">
          {SMARTASSIST_COPILOT.title}
        </p>
        <p className="mt-0.5 text-[10px] leading-relaxed text-carbon-blue/50">
          {SMARTASSIST_COPILOT.subtitle}
        </p>
      </div>

      <div className="space-y-2">
        {visible.map((proposal) => (
          <CoPilotProposalCard
            key={proposal.id}
            proposal={proposal}
            onHandled={handleHandled}
            onNavigate={onNavigate}
          />
        ))}
      </div>

      <p className="mt-2 text-[9px] text-carbon-blue/35">{SMARTASSIST_COPILOT.loop}</p>
    </section>
  );
}
