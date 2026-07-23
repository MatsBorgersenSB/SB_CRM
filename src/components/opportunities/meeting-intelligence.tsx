"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { FilterTransparencyBar } from "@/components/ui/filter-transparency-bar";
import { DraftInOutlookButton } from "@/components/opportunities/draft-in-outlook-button";
import { MeetingNotesAnalyzer } from "@/components/ai/meeting-notes-analyzer";
import { ATTIO_GROUP_ACTIONS } from "@/lib/attio-workspace-surfaces";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { UserRole } from "@/types/auth";
import type { FilterSummaryChip } from "@/types/workspace-filters";
import type { CommitmentState, SyncStatus } from "@/generated/prisma";

export type MeetingIntelligenceItem = {
  id: string;
  opportunityId: string | null;
  subject: string;
  startTime: string;
  endTime: string;
  location: string | null;
  webLink: string | null;
  organizerEmail: string;
  aiSummary: string | null;
  syncStatus: SyncStatus;
  provider: string;
  participants: Array<{
    id: string;
    email: string;
    name: string | null;
    contactId: string | null;
    isExternal: boolean;
    responseStatus: string;
    resolved: boolean;
    contactName: string | null;
    contactJobTitle: string | null;
  }>;
  commitments: Array<{
    id: string;
    description: string;
    ownerEmail: string;
    dueDate: string | null;
    status: CommitmentState;
    confirmedByUserId: string | null;
    confirmedAt: string | null;
  }>;
};

function formatMeetingWhen(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime())) return "Time unknown";
  const dateLabel = start.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  const startTime = start.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTime = Number.isNaN(end.getTime())
    ? ""
    : end.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return endTime ? `${dateLabel} · ${startTime} – ${endTime}` : `${dateLabel} · ${startTime}`;
}

function formatDueDate(value: string | null): string {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function commitmentDraftHtml(commitment: {
  description: string;
  ownerEmail: string;
  dueDate: string | null;
}): string {
  return [
    `<p>Hi,</p>`,
    `<p>Following up on our confirmed action:</p>`,
    `<p><strong>${commitment.description}</strong></p>`,
    `<p>Owner: ${commitment.ownerEmail}<br/>Due: ${formatDueDate(commitment.dueDate)}</p>`,
    `<p>Please reply with status or next steps.</p>`,
    `<p>Thanks</p>`,
  ].join("");
}

function labelize(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function commitmentStatusClass(status: CommitmentState): string {
  switch (status) {
    case "confirmed":
      return "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange";
    case "dismissed":
      return "border-carbon-blue/15 bg-carbon-blue/[0.04] text-carbon-blue/45";
    case "completed":
      return "border-carbon-blue/20 bg-white text-carbon-blue/70";
    default:
      return "border-upcycle-orange/20 bg-upcycle-orange/[0.06] text-carbon-blue";
  }
}

export function MeetingIntelligence({
  opportunityId,
  role = "superuser",
  readOnly = false,
}: {
  opportunityId: string;
  role?: UserRole;
  readOnly?: boolean;
}) {
  const [meetings, setMeetings] = useState<MeetingIntelligenceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [syncFilter, setSyncFilter] = useState<"all" | SyncStatus>("all");
  const [commitmentFilter, setCommitmentFilter] = useState<"all" | "proposed" | "open">("all");
  // FS-008 Privacy First — exclude internal-only meetings by default (AD-001 chip visible).
  const [domainFilter, setDomainFilter] = useState<"all" | "external" | "internal_only">(
    "external",
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(opportunityId)}/meetings`,
        {
          headers: { [AUTH_ROLE_HEADER]: role },
          cache: "no-store",
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        meetings?: MeetingIntelligenceItem[];
        error?: string;
        detail?: string;
      };
      if (!response.ok) {
        // Soft-fail: show empty state with detail instead of a hard crash.
        setMeetings(Array.isArray(payload.meetings) ? payload.meetings : []);
        throw new Error(payload.detail || payload.error || "Could not load meetings");
      }
      setMeetings(payload.meetings ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load meetings");
    } finally {
      setLoading(false);
    }
  }, [opportunityId, role]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredMeetings = useMemo(() => {
    return meetings.filter((meeting) => {
      if (syncFilter !== "all" && meeting.syncStatus !== syncFilter) return false;
      if (commitmentFilter === "proposed") {
        if (!meeting.commitments.some((item) => item.status === "proposed")) return false;
      }
      if (commitmentFilter === "open") {
        if (
          !meeting.commitments.some(
            (item) => item.status === "proposed" || item.status === "confirmed",
          )
        ) {
          return false;
        }
      }
      const internalOnly =
        meeting.participants.length > 0 &&
        meeting.participants.every((participant) => !participant.isExternal);
      if (domainFilter === "external" && internalOnly) return false;
      if (domainFilter === "internal_only" && !internalOnly) return false;
      return true;
    });
  }, [meetings, syncFilter, commitmentFilter, domainFilter]);

  const activeFilters = useMemo((): FilterSummaryChip[] => {
    const chips: FilterSummaryChip[] = [];
    if (syncFilter !== "all") {
      chips.push({
        id: "sync",
        label: "Sync",
        value: labelize(syncFilter),
        onRemove: () => setSyncFilter("all"),
      });
    }
    if (commitmentFilter !== "all") {
      chips.push({
        id: "commitments",
        label: "Commitments",
        value: commitmentFilter === "proposed" ? "Proposed only" : "Open only",
        onRemove: () => setCommitmentFilter("all"),
      });
    }
    if (domainFilter !== "all") {
      chips.push({
        id: "domain",
        label: "Domain",
        value: domainFilter === "external" ? "External" : "Internal-only",
        onRemove: () => setDomainFilter("all"),
      });
    }
    return chips;
  }, [syncFilter, commitmentFilter, domainFilter]);

  const updateCommitment = async (
    commitmentId: string,
    status: Extract<CommitmentState, "confirmed" | "dismissed" | "proposed">,
  ) => {
    if (readOnly) return;
    setSavingId(commitmentId);
    setError(null);
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(opportunityId)}/meetings`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            [AUTH_ROLE_HEADER]: role,
          },
          body: JSON.stringify({
            commitmentId,
            status,
            confirmedByUserId: role,
          }),
        },
      );
      if (!response.ok) throw new Error("Could not update commitment");
      const payload = (await response.json()) as {
        commitment: MeetingIntelligenceItem["commitments"][number];
      };
      setMeetings((current) =>
        current.map((meeting) => ({
          ...meeting,
          commitments: meeting.commitments.map((item) =>
            item.id === payload.commitment.id ? payload.commitment : item,
          ),
        })),
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <section aria-label="Meeting intelligence" className="flex flex-col gap-4">
      <div>
        <p className="text-[11px] font-medium text-carbon-blue/45">FS-008 Meeting Intelligence</p>
        <h3 className="mt-1 text-base font-semibold text-carbon-blue">Meetings & commitments</h3>
        <p className="mt-1 text-[13px] text-carbon-blue/55">
          Review synced meetings, resolve attendees against the Contact Registry, and confirm
          SmartAssist commitments — the system proposes; you decide.
        </p>
      </div>

      <MeetingNotesAnalyzer opportunityId={opportunityId} role={role} />

      <div className="flex flex-wrap items-end gap-3 border border-carbon-blue/10 bg-white px-3 py-3">
        <label className="flex min-w-[10rem] flex-col gap-1 text-[11px] font-semibold text-carbon-blue/55">
          Sync status
          <select
            value={syncFilter}
            onChange={(event) => setSyncFilter(event.target.value as "all" | SyncStatus)}
            className="border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-medium text-carbon-blue"
          >
            <option value="all">All meetings</option>
            <option value="pending_review">Pending review</option>
            <option value="processed">Processed</option>
            <option value="ignored">Ignored</option>
          </select>
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1 text-[11px] font-semibold text-carbon-blue/55">
          Commitments
          <select
            value={commitmentFilter}
            onChange={(event) =>
              setCommitmentFilter(event.target.value as "all" | "proposed" | "open")
            }
            className="border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-medium text-carbon-blue"
          >
            <option value="all">Any</option>
            <option value="proposed">Has proposed</option>
            <option value="open">Has open</option>
          </select>
        </label>
        <label className="flex min-w-[10rem] flex-col gap-1 text-[11px] font-semibold text-carbon-blue/55">
          Domains
          <select
            value={domainFilter}
            onChange={(event) =>
              setDomainFilter(event.target.value as "all" | "external" | "internal_only")
            }
            className="border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-medium text-carbon-blue"
          >
            <option value="external">External (default)</option>
            <option value="all">All domains</option>
            <option value="internal_only">Internal-only</option>
          </select>
        </label>
      </div>

      <FilterTransparencyBar
        entityLabel="Meetings"
        filteredCount={filteredMeetings.length}
        totalCount={meetings.length}
        activeFilters={activeFilters}
        onClearAll={
          activeFilters.length >= 2
            ? () => {
                setSyncFilter("all");
                setCommitmentFilter("all");
                setDomainFilter("external");
              }
            : undefined
        }
      />

      {error ? (
        <p className="border border-thermal-red/25 bg-thermal-red/[0.06] px-3 py-2 text-[12px] text-thermal-red">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="text-[13px] text-carbon-blue/45">Loading meetings…</p>
      ) : meetings.length === 0 ? (
        <p className="border border-carbon-blue/10 bg-white px-4 py-6 text-[13px] text-carbon-blue/55">
          No meetings linked to this opportunity yet.
        </p>
      ) : filteredMeetings.length === 0 ? (
        <p className="border border-carbon-blue/10 bg-white px-4 py-6 text-[13px] text-carbon-blue/55">
          No meetings match the active filters.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {filteredMeetings.map((meeting) => (
            <article
              key={meeting.id}
              className="group rounded-lg border border-slate-200/80 bg-white px-4 py-4 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700"
            >
              {/* 1. Meeting Timeline & AI Summary */}
              <header className="border-b border-carbon-blue/8 pb-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-carbon-blue/40">
                      Meeting timeline
                    </p>
                    <h4 className="mt-1 text-[15px] font-semibold text-carbon-blue">
                      {meeting.subject}
                    </h4>
                    <p className="mt-1 text-[12px] text-carbon-blue/60">
                      {formatMeetingWhen(meeting.startTime, meeting.endTime)}
                    </p>
                    <p className="mt-0.5 text-[12px] text-carbon-blue/50">
                      Organizer: {meeting.organizerEmail}
                      {meeting.location ? ` · ${meeting.location}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 border border-carbon-blue/15 bg-carbon-blue/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-carbon-blue/55">
                    {labelize(meeting.syncStatus)}
                  </span>
                </div>
                {meeting.aiSummary ? (
                  <div className="mt-3 border border-upcycle-orange/20 bg-upcycle-orange/[0.04] px-3 py-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-upcycle-orange">
                      AI meeting summary
                    </p>
                    <p className="mt-1 text-[13px] leading-relaxed text-carbon-blue">
                      {meeting.aiSummary}
                    </p>
                  </div>
                ) : (
                  <p className="mt-3 text-[12px] text-carbon-blue/45">
                    No AI summary yet — summary appears after SmartAssist review.
                  </p>
                )}
              </header>

              {/* 2. Attendee Resolution Badges */}
              <section className="border-b border-carbon-blue/8 py-3" aria-label="Attendees">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-carbon-blue/40">
                  Attendee resolution
                </p>
                <ul className="mt-2 flex flex-col gap-2">
                  {meeting.participants.map((participant) => (
                    <li
                      key={participant.id}
                      className="flex flex-wrap items-center justify-between gap-2 border border-carbon-blue/10 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-carbon-blue">
                          {participant.contactName || participant.name || participant.email}
                        </p>
                        <p className="truncate text-[11px] text-carbon-blue/50">
                          {participant.email}
                          {participant.contactJobTitle
                            ? ` · ${participant.contactJobTitle}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1.5">
                        {participant.isExternal ? (
                          <span className="border border-carbon-blue/15 bg-carbon-blue/[0.04] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-carbon-blue/55">
                            External
                          </span>
                        ) : (
                          <span className="border border-carbon-blue/15 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-carbon-blue/50">
                            Internal
                          </span>
                        )}
                        {participant.resolved ? (
                          <span className="border border-emerald-600/30 bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-emerald-700">
                            Resolved Contact
                          </span>
                        ) : participant.isExternal ? (
                          <span className="border border-amber-500/35 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-amber-700">
                            Unresolved External
                          </span>
                        ) : (
                          <span className="border border-carbon-blue/20 bg-carbon-blue/[0.03] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-carbon-blue/55">
                            Internal — Unlinked
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              {/* 3. SmartAssist Action Commitments */}
              <section className="pt-3" aria-label="Commitments">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-carbon-blue/40">
                  SmartAssist action commitments
                </p>
                {meeting.commitments.length === 0 ? (
                  <p className="mt-2 text-[12px] text-carbon-blue/45">
                    No proposed commitments for this meeting.
                  </p>
                ) : (
                  <ul className="mt-2 flex flex-col gap-2">
                    {meeting.commitments.map((commitment) => {
                      const isProposed = commitment.status === "proposed";
                      const busy = savingId === commitment.id;
                      return (
                        <li
                          key={commitment.id}
                          className="border border-carbon-blue/10 bg-carbon-blue/[0.015] px-3 py-2.5"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] font-medium text-carbon-blue">
                                {commitment.description}
                              </p>
                              <p className="mt-1 text-[11px] text-carbon-blue/50">
                                Owner: {commitment.ownerEmail} · Due{" "}
                                {formatDueDate(commitment.dueDate)}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.06em] ${commitmentStatusClass(commitment.status)}`}
                            >
                              {labelize(commitment.status)}
                            </span>
                          </div>
                          {isProposed && !readOnly ? (
                            <div className={`mt-2.5 flex flex-wrap gap-2 ${ATTIO_GROUP_ACTIONS}`}>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void updateCommitment(commitment.id, "confirmed")}
                                className="rounded-md border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
                              >
                                {busy ? "Saving…" : "Confirm"}
                              </button>
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => void updateCommitment(commitment.id, "dismissed")}
                                className="rounded-md border border-slate-200/80 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                              >
                                Dismiss
                              </button>
                            </div>
                          ) : null}
                          {commitment.status === "confirmed" && !readOnly ? (
                            <div className={`mt-2.5 ${ATTIO_GROUP_ACTIONS}`}>
                              <DraftInOutlookButton
                                toEmail={commitment.ownerEmail}
                                subject={`Action follow-up: ${commitment.description.slice(0, 80)}`}
                                bodyHtml={commitmentDraftHtml(commitment)}
                                opportunityId={opportunityId}
                                role={role}
                                disabled={busy}
                              />
                            </div>
                          ) : null}
                          {!isProposed && !readOnly && commitment.status === "dismissed" ? (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void updateCommitment(commitment.id, "proposed")}
                              className="mt-2 text-[11px] font-semibold text-carbon-blue/50 hover:text-upcycle-orange disabled:opacity-50"
                            >
                              Restore as proposed
                            </button>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
