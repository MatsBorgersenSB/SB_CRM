"use client";

import { useCallback, useEffect, useState } from "react";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { StoredProposal } from "@/lib/ai/knowledge-proposal-store";
import type { UserRole } from "@/types/auth";
import {
  EDITORIAL_BODY_MUTED,
  EDITORIAL_LABEL,
} from "@/lib/editorial-design-system";

/**
 * FS-021 FR-005 — "Needs your review". One shared list used on the meeting
 * surface (full) and the opportunity Overview (collapsed to a single line).
 *
 * SmartAssist proposes; the user decides. Accept / Edit / Dismiss only records
 * the review — it never creates or changes a Contact, Company, Relationship or
 * Stakeholder. Renders nothing when there is nothing to review.
 */

type Scope = {
  meetingId?: string | null;
  opportunityId?: string | null;
  companyId?: string | null;
  all?: boolean;
};

const TYPE_LABEL: Record<StoredProposal["type"], string> = {
  fact: "Something we learned",
  decision: "A decision",
  risk: "A risk",
  commitment: "A commitment",
  relationship: "A relationship signal",
  unknown: "Still unknown",
};

function scopeQuery(scope: Scope): string {
  const q = new URLSearchParams();
  if (scope.meetingId) q.set("meetingId", scope.meetingId);
  if (scope.opportunityId) q.set("opportunityId", scope.opportunityId);
  if (scope.companyId) q.set("companyId", scope.companyId);
  if (scope.all) q.set("all", "1");
  return q.toString();
}

export function KnowledgeProposalReview({
  scope,
  role = "superuser",
  variant = "full",
  refreshKey = 0,
  onChanged,
}: {
  scope: Scope;
  role?: UserRole;
  /** "collapsed" shows one summary line until opened (opportunity Overview). */
  variant?: "full" | "collapsed";
  /** Bump to refetch, e.g. after a transcript import. */
  refreshKey?: number;
  onChanged?: () => void;
}) {
  const [items, setItems] = useState<StoredProposal[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const query = scopeQuery(scope);

  useEffect(() => {
    if (!query || role === "client_lead") return;
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`/api/ai/proposals?${query}`, {
          headers: { [AUTH_ROLE_HEADER]: role },
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as {
          proposals?: StoredProposal[];
        };
        if (!cancelled) setItems(payload.proposals ?? []);
      } catch {
        /* Nothing to show is the honest state when the list can't load. */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [query, role, refreshKey]);

  const decide = useCallback(
    async (
      id: string,
      decision: "accept" | "edit" | "dismiss",
      editedStatement?: string,
    ) => {
      setBusyId(id);
      setError(null);
      try {
        const response = await fetch(
          `/api/ai/proposals/${encodeURIComponent(id)}/decision`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              [AUTH_ROLE_HEADER]: role,
            },
            body: JSON.stringify({ decision, editedStatement }),
          },
        );
        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as {
            error?: string;
          };
          // Already reviewed elsewhere: it no longer needs review here either.
          if (response.status === 409) {
            setItems((prev) => prev.filter((p) => p.id !== id));
            return;
          }
          throw new Error(payload.error || "Could not save your decision");
        }
        setItems((prev) => prev.filter((p) => p.id !== id));
        setEditingId(null);
        onChanged?.();
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Could not save your decision",
        );
      } finally {
        setBusyId(null);
      }
    },
    [role, onChanged],
  );

  if (role === "client_lead" || items.length === 0) return null;

  const list = (
    <ul className="space-y-4">
      {items.map((item) => {
        const editing = editingId === item.id;
        const busy = busyId === item.id;
        return (
          <li
            key={item.id}
            className="border-l-2 border-upcycle-orange/40 pl-3"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/50">
              {TYPE_LABEL[item.type]} · {item.source.label}
            </p>

            {editing ? (
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={2}
                aria-label="Your wording"
                className="mt-1 w-full resize-y border border-carbon-blue/15 px-2 py-1.5 text-[13px] text-carbon-blue outline-none focus:border-upcycle-orange"
              />
            ) : (
              <p className="mt-1 text-[14px] leading-snug text-carbon-blue/90">
                {item.statement}
              </p>
            )}

            <p className="mt-1 text-[12px] leading-snug text-carbon-blue/65">
              <span className="font-semibold">Why it matters: </span>
              {item.impact}
            </p>
            <p className="mt-1 text-[12px] italic leading-snug text-carbon-blue/50">
              &ldquo;{item.evidence}&rdquo;
            </p>
            {item.type === "relationship" ? (
              <p className="mt-1 text-[11px] text-carbon-blue/50">
                Accepting records your review only — no one is added to
                Contacts.
              </p>
            ) : null}

            <div className="mt-2 flex flex-wrap gap-2">
              {editing ? (
                <>
                  <button
                    type="button"
                    disabled={busy || !draft.trim()}
                    onClick={() => void decide(item.id, "edit", draft)}
                    className="border border-upcycle-orange bg-upcycle-orange px-3 py-1 text-[12px] font-semibold text-white hover:brightness-105 disabled:opacity-50"
                  >
                    Save my wording
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setEditingId(null)}
                    className="border border-carbon-blue/15 bg-white px-3 py-1 text-[12px] font-semibold text-carbon-blue/70 hover:border-carbon-blue/30"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decide(item.id, "accept")}
                    className="border border-upcycle-orange bg-upcycle-orange px-3 py-1 text-[12px] font-semibold text-white hover:brightness-105 disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setEditingId(item.id);
                      setDraft(item.statement);
                    }}
                    className="border border-carbon-blue/15 bg-white px-3 py-1 text-[12px] font-semibold text-carbon-blue/70 hover:border-carbon-blue/30 disabled:opacity-50"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void decide(item.id, "dismiss")}
                    className="px-2 py-1 text-[12px] font-semibold text-carbon-blue/50 hover:text-carbon-blue/80 disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );

  const summary =
    items.length === 1
      ? "1 thing from your meetings needs a quick review"
      : `${items.length} things from your meetings need a quick review`;

  if (variant === "collapsed") {
    return (
      <details className="border border-carbon-blue/10 bg-white px-3 py-2.5">
        <summary className="cursor-pointer text-[13px] font-semibold text-carbon-blue">
          {summary}
        </summary>
        <div className="mt-3">
          {list}
          {error ? (
            <p className="mt-2 text-[12px] text-thermal-red">{error}</p>
          ) : null}
        </div>
      </details>
    );
  }

  return (
    <section
      aria-label="Needs your review"
      className="border border-carbon-blue/10 bg-white px-3 py-3"
    >
      <p className={EDITORIAL_LABEL}>Needs your review</p>
      <p className={`${EDITORIAL_BODY_MUTED} mb-3 mt-0.5 text-[12px]`}>
        SmartAssist noticed these in the meeting. You decide what is true.
      </p>
      {list}
      {error ? (
        <p className="mt-2 text-[12px] text-thermal-red">{error}</p>
      ) : null}
    </section>
  );
}
