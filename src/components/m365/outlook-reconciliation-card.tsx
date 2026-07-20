"use client";

import { useState } from "react";
import Link from "next/link";
import type { MissingTouchpointCandidate, ReconciliationImportMode } from "@/types/outlook-reconciliation";

function formatDate(value: string | null): string {
  if (!value) return "None";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const IMPORT_ACTIONS: { mode: ReconciliationImportMode; label: string }[] = [
  { mode: "email_summary", label: "Import email summary" },
  { mode: "create_activities", label: "Create activities" },
  { mode: "update_last_interaction", label: "Update last interaction" },
  { mode: "build_timeline", label: "Build relationship timeline" },
];

export function OutlookReconciliationCard({
  candidate,
  compact = false,
  onImported,
}: {
  candidate: MissingTouchpointCandidate;
  compact?: boolean;
  onImported?: () => void;
}) {
  const [busy, setBusy] = useState<ReconciliationImportMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleImport(mode: ReconciliationImportMode) {
    setBusy(mode);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch(
        `/api/m365/reconciliation/${encodeURIComponent(candidate.evidenceId)}/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        },
      );

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Import failed");
      }

      const body = (await response.json()) as {
        result: { activitiesCreated: number };
      };
      setSuccess(
        `${body.result.activitiesCreated} activit${body.result.activitiesCreated === 1 ? "y" : "ies"} imported into CRM.`,
      );
      onImported?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <article className="border border-carbon-blue/10 bg-white">
      <header className="border-b border-carbon-blue/10 px-3 py-2.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-upcycle-orange">
              Outlook activity found
            </p>
            <h3 className="text-sm font-semibold text-carbon-blue">{candidate.entityLabel}</h3>
            {candidate.companyName ? (
              <p className="mt-0.5 text-[10px] text-carbon-blue/50">{candidate.companyName}</p>
            ) : null}
          </div>
          {!compact ? (
            <Link
              href={candidate.resolutionHref}
              className="text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange hover:underline"
            >
              Open →
            </Link>
          ) : null}
        </div>
      </header>

      <dl className="grid gap-2 px-3 py-3 sm:grid-cols-2">
        <div>
          <dt className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/35">
            Emails
          </dt>
          <dd className="mt-0.5 text-xs font-semibold text-carbon-blue">
            {candidate.outlookEmailCount}
          </dd>
        </div>
        <div>
          <dt className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/35">
            Last email
          </dt>
          <dd className="mt-0.5 text-xs text-carbon-blue/70">
            {formatDate(candidate.lastOutlookEmailDate)}
          </dd>
        </div>
        {candidate.outlookTeamsMeetingCount > 0 ? (
          <div>
            <dt className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/35">
              Teams meetings
            </dt>
            <dd className="mt-0.5 text-xs text-carbon-blue/70">
              {candidate.outlookTeamsMeetingCount}
            </dd>
          </div>
        ) : null}
        {candidate.outlookCalendarEventCount > 0 ? (
          <div>
            <dt className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/35">
              Calendar events
            </dt>
            <dd className="mt-0.5 text-xs text-carbon-blue/70">
              {candidate.outlookCalendarEventCount}
            </dd>
          </div>
        ) : null}
        <div className="sm:col-span-2">
          <dt className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/35">
            CRM activity
          </dt>
          <dd className="mt-0.5 text-xs text-carbon-blue/70">
            {candidate.crmActivityCount === 0
              ? "None"
              : `${candidate.crmActivityCount} logged · last ${formatDate(candidate.crmLastActivityDate)}`}
          </dd>
        </div>
      </dl>

      <div className="border-t border-carbon-blue/8 bg-upcycle-orange/[0.03] px-3 py-2.5">
        <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/35">
          Recommendation
        </p>
        <p className="mt-0.5 text-[11px] text-carbon-blue/70">{candidate.recommendedAction}</p>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {IMPORT_ACTIONS.map((action) => (
            <button
              key={action.mode}
              type="button"
              disabled={busy !== null}
              onClick={() => void handleImport(action.mode)}
              className="border border-upcycle-orange/30 bg-white px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-upcycle-orange transition-colors hover:bg-upcycle-orange/10 disabled:opacity-50"
            >
              {busy === action.mode ? "Importing…" : action.label}
            </button>
          ))}
        </div>

        {error ? <p className="mt-2 text-[11px] text-thermal-red">{error}</p> : null}
        {success ? <p className="mt-2 text-[11px] text-upcycle-orange">{success}</p> : null}
      </div>
    </article>
  );
}
