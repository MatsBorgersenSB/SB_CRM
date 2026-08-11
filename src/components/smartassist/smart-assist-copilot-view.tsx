"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, X } from "lucide-react";
import { executeCoPilotProposal } from "@/lib/smartassist-copilot-client";
import { dismissCoPilotProposalWithReason } from "@/lib/smartassist-copilot-store";
import { COPILOT_DISMISS_NOTE_MIN } from "@/lib/smartassist-copilot-dismiss-constants";
import { proposalAsBusinessImpact } from "@/lib/smart-assist-conversation-engine";
import { SMARTASSIST_COPILOT } from "@/lib/smart-assist-config";
import { BusinessImpactCard } from "@/components/smartassist/business-impact-card";
import { useAuth } from "@/context/auth-context";
import type {
  CoPilotActionProposal,
  CoPilotExecuteResult,
} from "@/types/smartassist-copilot";

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

function DismissReasonDialog({
  proposalTitle,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  proposalTitle: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (note: string) => void;
}) {
  const [note, setNote] = useState("");
  const trimmed = note.trim();
  const canConfirm = trimmed.length >= COPILOT_DISMISS_NOTE_MIN && !busy;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-blue/40 p-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="copilot-dismiss-title"
        className="w-full max-w-sm border border-carbon-blue/10 bg-white shadow-xl"
      >
        <div className="border-b border-carbon-blue/8 px-4 py-3">
          <p
            id="copilot-dismiss-title"
            className="text-sm font-semibold text-carbon-blue"
          >
            Dismiss recommendation
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/55">
            Why should SmartCRM stop suggesting this? Your note is saved so we
            do not ask again.
          </p>
        </div>

        <div className="space-y-3 px-4 py-4">
          <p className="text-[10px] font-medium text-carbon-blue/70">
            {proposalTitle}
          </p>
          <label className="block">
            <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
              Reason
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              autoFocus
              placeholder='e.g. "This is just a supplier"'
              className="mt-1.5 w-full resize-none border border-carbon-blue/12 bg-white px-2.5 py-2 text-[12px] text-carbon-blue placeholder:text-carbon-blue/35 focus:border-upcycle-orange/50 focus:outline-none"
            />
            <span className="mt-1 block text-[9px] text-carbon-blue/40">
              At least {COPILOT_DISMISS_NOTE_MIN} characters
              {trimmed.length > 0 ? ` · ${trimmed.length}` : ""}
            </span>
          </label>

          {error ? <p className="text-[10px] text-red-600">{error}</p> : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-carbon-blue/8 px-4 py-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-md border border-carbon-blue/12 px-2.5 py-1 text-[10px] font-semibold text-carbon-blue/55 transition-colors hover:bg-carbon-blue/[0.03] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={() => onConfirm(trimmed)}
            className="rounded-md bg-carbon-blue px-2.5 py-1 text-[10px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Confirm dismiss"}
          </button>
        </div>
      </div>
    </div>
  );
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
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<CoPilotExecuteResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dismissOpen, setDismissOpen] = useState(false);
  const [dismissError, setDismissError] = useState<string | null>(null);
  const [dismissBusy, setDismissBusy] = useState(false);
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

  const handleConfirmDismiss = useCallback(
    async (note: string) => {
      setDismissBusy(true);
      setDismissError(null);
      try {
        await dismissCoPilotProposalWithReason({
          proposal,
          note,
          userEmail: user.email,
          userDisplayName: user.displayName,
        });
        setDismissOpen(false);
        onHandled(proposal.id);
      } catch (err) {
        setDismissError(
          err instanceof Error ? err.message : "Could not save dismissal.",
        );
      } finally {
        setDismissBusy(false);
      }
    },
    [proposal, onHandled, user.email, user.displayName],
  );

  if (feedback?.mode === "applied") {
    return (
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] px-3 py-2.5">
        <p className="text-[10px] font-semibold text-emerald-700">Applied</p>
        <p className="mt-0.5 text-[10px] text-carbon-blue/55">{businessImpact.expectedOutcome}</p>
      </div>
    );
  }

  return (
    <>
      <article
        className={`rounded-lg border px-3 py-2.5 ${severityBorder(proposal.severity)}`}
      >
        <BusinessImpactCard recommendation={businessImpact} compact />

        {error ? (
          <p className="mt-2 text-[10px] text-red-600">{error}</p>
        ) : null}

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || dismissBusy}
            onClick={() => void handleApprove()}
            className="inline-flex items-center gap-1 rounded-md bg-upcycle-orange px-2.5 py-1 text-[10px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Check className="size-3" strokeWidth={2.5} />
            {busy ? "Applying…" : "Approve"}
          </button>
          <button
            type="button"
            disabled={busy || dismissBusy}
            onClick={() => {
              setDismissError(null);
              setDismissOpen(true);
            }}
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

      {dismissOpen ? (
        <DismissReasonDialog
          proposalTitle={proposal.title}
          busy={dismissBusy}
          error={dismissError}
          onCancel={() => setDismissOpen(false)}
          onConfirm={(note) => void handleConfirmDismiss(note)}
        />
      ) : null}
    </>
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
