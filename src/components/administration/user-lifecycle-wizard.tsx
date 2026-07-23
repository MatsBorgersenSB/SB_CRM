"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { withAuthRoleHeaders } from "@/lib/api-auth";
import type {
  OwnershipTransferPreview,
  StandardBioUserRecord,
  SuccessorRecommendation,
} from "@/types/user-access";

type TransferMode = "transfer" | "replace";

const RISK_STYLES = {
  low: "border-upcycle-orange/25 bg-upcycle-orange/[0.05] text-upcycle-orange",
  medium: "border-carbon-blue/15 bg-carbon-blue/[0.04] text-carbon-blue",
  high: "border-thermal-red/25 bg-thermal-red/[0.04] text-thermal-red",
} as const;

type UserLifecycleWizardProps = {
  open: boolean;
  mode: TransferMode;
  user: StandardBioUserRecord;
  users: StandardBioUserRecord[];
  onClose: () => void;
  onCompleted: () => void;
};

export function UserLifecycleWizard({
  open,
  mode,
  user,
  users,
  onClose,
  onCompleted,
}: UserLifecycleWizardProps) {
  const { user: authUser } = useAuth();
  const [preview, setPreview] = useState<OwnershipTransferPreview | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCandidates = users.filter(
    (candidate) => candidate.status === "active" && candidate.id !== user.id,
  );

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    void fetch(`/api/administration/users/${user.id}/transfer-ownership`, {
      method: "POST",
      headers: withAuthRoleHeaders(authUser.role, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ preview: true }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load transfer preview");
        const body = (await response.json()) as { preview: OwnershipTransferPreview };
        setPreview(body.preview);
        setSelectedUserId(body.preview.suggestedNewOwner?.user.id ?? null);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load preview");
      })
      .finally(() => setLoading(false));
  }, [open, user.id, authUser.role]);

  useEffect(() => {
    if (!open || !selectedUserId) return;
    void fetch(`/api/administration/users/${user.id}/transfer-ownership`, {
      method: "POST",
      headers: withAuthRoleHeaders(authUser.role, {
        "Content-Type": "application/json",
      }),
      body: JSON.stringify({ preview: true, toUserId: selectedUserId }),
    })
      .then(async (response) => {
        if (!response.ok) return;
        const body = (await response.json()) as { preview: OwnershipTransferPreview };
        setPreview(body.preview);
      })
      .catch(() => undefined);
  }, [open, selectedUserId, user.id, authUser.role]);

  if (!open) return null;

  async function handleConfirm() {
    if (!selectedUserId) {
      setError("Select a successor before confirming.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (mode === "replace") {
        const response = await fetch(`/api/administration/users/${user.id}/replace`, {
          method: "POST",
          headers: withAuthRoleHeaders(authUser.role, {
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ toUserId: selectedUserId, archiveDeparting: true }),
        });
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? "Replace failed");
        }
      } else {
        const response = await fetch(`/api/administration/users/${user.id}/transfer-ownership`, {
          method: "POST",
          headers: withAuthRoleHeaders(authUser.role, {
            "Content-Type": "application/json",
          }),
          body: JSON.stringify({ toUserId: selectedUserId }),
        });
        if (!response.ok) {
          const body = (await response.json()) as { error?: string };
          throw new Error(body.error ?? "Transfer failed");
        }
      }
      onCompleted();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Operation failed");
    } finally {
      setSubmitting(false);
    }
  }

  const title = mode === "replace" ? "Replace User" : "Transfer Ownership";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-blue/30 p-4 backdrop-blur-[2px]">
      <div
        className="flex max-h-[90dvh] w-full max-w-2xl flex-col border border-carbon-blue/10 bg-white shadow-lg"
        role="dialog"
        aria-labelledby="lifecycle-wizard-title"
      >
        <div className="border-b border-carbon-blue/8 px-4 py-3">
          <p id="lifecycle-wizard-title" className="text-sm font-semibold text-carbon-blue">
            {title} — SmartAssist
          </p>
          <p className="mt-1 text-[11px] text-carbon-blue/50">
            Current owner: {user.displayName}. SmartAssist recommends successors based on team,
            role, territory, relationships, workload, and opportunity ownership.
          </p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {loading ? (
            <p className="text-[11px] text-carbon-blue/50">Building ownership preview…</p>
          ) : preview ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="border border-carbon-blue/10 p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/40">
                    Current owner
                  </p>
                  <p className="mt-1 text-sm font-semibold text-carbon-blue">
                    {preview.currentOwner.displayName}
                  </p>
                  <p className="text-[10px] text-carbon-blue/45">{preview.currentOwner.userId}</p>
                </div>
                <div className="border border-upcycle-orange/20 bg-upcycle-orange/[0.03] p-3">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-upcycle-orange">
                    Suggested successor
                  </p>
                  <p className="mt-1 text-sm font-semibold text-carbon-blue">
                    {preview.suggestedNewOwner?.user.displayName ?? "—"}
                  </p>
                  {preview.suggestedNewOwner ? (
                    <p className="mt-1 text-[10px] text-carbon-blue/55">
                      {preview.suggestedNewOwner.confidencePercent}% ·{" "}
                      {preview.suggestedNewOwner.rationale}
                    </p>
                  ) : null}
                </div>
              </div>

              <div
                className={`border px-3 py-2 text-[11px] ${RISK_STYLES[preview.riskLevel]}`}
              >
                <span className="font-bold uppercase tracking-wider">{preview.riskLevel} risk</span>
                <span className="ml-2">{preview.riskAssessment}</span>
              </div>

              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/40">
                  Affected records
                </p>
                <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                  {Object.entries(preview.affectedRecords).map(([key, value]) => (
                    <div
                      key={key}
                      className="border border-carbon-blue/8 bg-carbon-blue/[0.02] px-2 py-1.5 text-center"
                    >
                      <p className="text-[8px] font-bold uppercase tracking-wider text-carbon-blue/35">
                        {key}
                      </p>
                      <p className="text-sm font-semibold tabular-nums text-carbon-blue">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
                  New owner
                </span>
                <select
                  value={selectedUserId ?? ""}
                  onChange={(event) =>
                    setSelectedUserId(Number.parseInt(event.target.value, 10) || null)
                  }
                  className="mt-1 w-full border border-carbon-blue/15 px-3 py-2 text-[12px] text-carbon-blue"
                >
                  <option value="">Select successor…</option>
                  {activeCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.displayName} · {candidate.team}
                    </option>
                  ))}
                </select>
              </label>

              {preview.successorRecommendations.length > 0 ? (
                <div>
                  <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-carbon-blue/40">
                    SmartAssist recommendations
                  </p>
                  <div className="space-y-2">
                    {preview.successorRecommendations.slice(0, 3).map((rec: SuccessorRecommendation) => (
                      <button
                        key={rec.user.id}
                        type="button"
                        onClick={() => setSelectedUserId(rec.user.id)}
                        className={`w-full border px-3 py-2 text-left transition-colors ${
                          selectedUserId === rec.user.id
                            ? "border-upcycle-orange bg-upcycle-orange/[0.05]"
                            : "border-carbon-blue/10 hover:border-carbon-blue/20"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] font-medium text-carbon-blue">
                            {rec.user.displayName}
                          </span>
                          <span className="text-[10px] font-bold tabular-nums text-upcycle-orange">
                            {rec.confidencePercent}%
                          </span>
                        </div>
                        <p className="mt-0.5 text-[10px] text-carbon-blue/55">{rec.rationale}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {preview.previewChanges.length > 0 ? (
                <div>
                  <p className="mb-2 text-[9px] font-bold uppercase tracking-wider text-carbon-blue/40">
                    Preview changes
                  </p>
                  <ul className="max-h-40 space-y-1 overflow-y-auto border border-carbon-blue/8 p-2">
                    {preview.previewChanges.slice(0, 12).map((change) => (
                      <li key={`${change.entityType}-${change.entityId}`} className="text-[10px] text-carbon-blue/65">
                        <span className="font-medium text-carbon-blue">{change.entityLabel}</span>
                        {" · "}
                        {change.field}: {change.from} → {change.to}
                      </li>
                    ))}
                    {preview.previewChanges.length > 12 ? (
                      <li className="text-[10px] text-carbon-blue/40">
                        +{preview.previewChanges.length - 12} more changes
                      </li>
                    ) : null}
                  </ul>
                </div>
              ) : null}
            </>
          ) : null}

          {error ? <p className="text-[11px] text-thermal-red">{error}</p> : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-carbon-blue/8 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="border border-carbon-blue/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || loading || !selectedUserId}
            onClick={() => void handleConfirm()}
            className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white disabled:opacity-50"
          >
            {submitting
              ? "Applying…"
              : mode === "replace"
                ? "Replace & archive"
                : "Confirm transfer"}
          </button>
        </div>
      </div>
    </div>
  );
}
