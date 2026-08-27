"use client";

/**
 * FS-018 Phase 3 — Assign a Teams message to Company / Project / Opportunity.
 * Reuses Outlook mail-tag API. Conversation id = Teams conversation / chat id.
 */

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OutlookNoContactState } from "@/components/m365/outlook-no-contact-state";
import { openOutlookSignInDialog } from "@/components/m365/outlook-auth-gate";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { CompanyRelationshipPosture } from "@/lib/company-classification";
import { useAuth } from "@/context/auth-context";
import type { UserRole } from "@/types/auth";

type LinkOption = { id: string; label: string; name: string };

type TagContextPayload = {
  contactId: string;
  companyId?: string;
  companyName: string;
  contactName?: string;
  currentOpportunityId: string | null;
  currentProjectId: string | null;
  opportunityOptions: LinkOption[];
  projectOptions: LinkOption[];
  relationshipPosture?: CompanyRelationshipPosture;
  opportunityEligible?: boolean;
  error?: string;
};

type AssignLinkKind = "company" | "project" | "opportunity";

type Phase =
  | { status: "loading" }
  | { status: "auth-required" }
  | { status: "need-email" }
  | { status: "unknown"; email: string }
  | { status: "ready"; email: string; context: TagContextPayload }
  | { status: "error"; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function TeamsAssignMessagePane({ role: roleProp }: { role?: UserRole }) {
  const { user } = useAuth();
  const role = roleProp ?? user.role;
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [conversationId, setConversationId] = useState("");
  const [messageId, setMessageId] = useState("");
  const [phase, setPhase] = useState<Phase>({ status: "loading" });
  const [linkKind, setLinkKind] = useState<AssignLinkKind>("company");
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (targetEmail: string, convo: string) => {
      setPhase({ status: "loading" });
      setError(null);
      setStatus(null);
      const params = new URLSearchParams({ email: targetEmail });
      if (convo) params.set("conversationId", convo);
      const response = await fetch(`/api/m365/outlook/mail-tag?${params}`, {
        headers: { [AUTH_ROLE_HEADER]: role },
        credentials: "include",
      });
      if (response.status === 401 || response.status === 403) {
        setPhase({ status: "auth-required" });
        return;
      }
      if (response.status === 404) {
        setPhase({ status: "unknown", email: targetEmail });
        return;
      }
      const payload = (await response.json().catch(() => ({}))) as TagContextPayload & {
        error?: string;
      };
      if (!response.ok) {
        setPhase({
          status: "error",
          message: payload.error || "Unable to load assign options",
        });
        return;
      }
      setPhase({ status: "ready", email: targetEmail, context: payload });
      const eligible = payload.opportunityEligible ?? true;
      if (payload.currentProjectId) {
        setLinkKind("project");
        setSelectedId(payload.currentProjectId);
      } else if (payload.currentOpportunityId && eligible) {
        setLinkKind("opportunity");
        setSelectedId(payload.currentOpportunityId);
      } else {
        setLinkKind("company");
        setSelectedId("");
      }
    },
    [role],
  );

  useEffect(() => {
    const qEmail = searchParams.get("email")?.trim().toLowerCase() || "";
    const qConvo =
      searchParams.get("conversationId")?.trim() ||
      searchParams.get("chatId")?.trim() ||
      `teams-${Date.now()}`;
    const qMsg = searchParams.get("messageId")?.trim() || qConvo;
    setConversationId(qConvo);
    setMessageId(qMsg);
    if (qEmail && EMAIL_RE.test(qEmail)) {
      setEmail(qEmail);
      void load(qEmail, qConvo);
    } else {
      setPhase({ status: "need-email" });
    }
  }, [searchParams, load]);

  async function assign() {
    if (phase.status !== "ready" || busy) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const opportunityEligible = phase.context.opportunityEligible ?? true;
      if (linkKind === "opportunity" && !opportunityEligible) {
        setError("Opportunity assign is only for sell-to relationships.");
        return;
      }
      const body: Record<string, unknown> = {
        contactId: phase.context.contactId,
        conversationId,
        message: {
          externalMessageId: messageId || conversationId,
          subject: "Teams message",
          receivedAt: new Date().toISOString(),
        },
      };
      if (linkKind === "project") body.projectId = selectedId || null;
      if (linkKind === "opportunity") body.opportunityId = selectedId || null;
      if (linkKind === "company") {
        body.projectId = null;
        body.opportunityId = null;
      }

      const response = await fetch("/api/m365/outlook/mail-tag", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          [AUTH_ROLE_HEADER]: role,
        },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(payload.error || "Assign failed");
        return;
      }
      setStatus(
        linkKind === "project"
          ? "Linked to project."
          : linkKind === "opportunity"
            ? "Linked to opportunity."
            : "Saved as relationship message.",
      );
    } catch {
      setError("Assign failed");
    } finally {
      setBusy(false);
    }
  }

  if (phase.status === "loading") {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-white px-6">
        <p className="text-[12px] text-carbon-blue/50">Loading assign options…</p>
      </div>
    );
  }

  if (phase.status === "auth-required") {
    return (
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <p className="text-sm font-semibold text-carbon-blue">Sign In to SmartCRM</p>
        <button
          type="button"
          onClick={() => void openOutlookSignInDialog(() => window.location.reload())}
          className="mt-4 border border-upcycle-orange bg-upcycle-orange px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white"
        >
          Sign In
        </button>
      </div>
    );
  }

  if (phase.status === "need-email") {
    return (
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
          SmartCRM · Assign message
        </p>
        <p className="mt-2 text-sm font-semibold text-carbon-blue">Who is this about?</p>
        <input
          type="email"
          value={manualEmail}
          onChange={(e) => setManualEmail(e.target.value)}
          placeholder="person@company.com"
          className="mt-3 w-full border border-carbon-blue/15 px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            const next = manualEmail.trim().toLowerCase();
            if (!EMAIL_RE.test(next)) {
              setError("Enter a valid email");
              return;
            }
            setEmail(next);
            void load(next, conversationId || `teams-${Date.now()}`);
          }}
          className="mt-3 border border-upcycle-orange bg-upcycle-orange px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white"
        >
          Continue
        </button>
        {error ? <p className="mt-2 text-[11px] text-red-700">{error}</p> : null}
      </div>
    );
  }

  if (phase.status === "unknown") {
    return (
      <div className="min-h-[100dvh] bg-white p-4">
        <OutlookNoContactState
          email={phase.email}
          displayName=""
          onContactCreated={() => void load(phase.email, conversationId)}
        />
      </div>
    );
  }

  if (phase.status === "error") {
    return (
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <p className="text-sm font-semibold text-carbon-blue">Unable to assign</p>
        <p className="mt-1 text-[11px] text-carbon-blue/50">{phase.message}</p>
      </div>
    );
  }

  const ctx = phase.context;
  const opportunityEligible = ctx.opportunityEligible ?? true;

  return (
    <div className="min-h-[100dvh] space-y-4 bg-white px-4 py-5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
        SmartCRM · Assign message
      </p>
      <div>
        <p className="text-sm font-semibold text-carbon-blue">
          {ctx.contactName || email}
        </p>
        <p className="text-[11px] text-carbon-blue/50">
          {ctx.companyName}
          {ctx.relationshipPosture ? ` · ${ctx.relationshipPosture}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(["company", "project", "opportunity"] as AssignLinkKind[]).map((kind) => {
          const disabled = kind === "opportunity" && !opportunityEligible;
          return (
            <button
              key={kind}
              type="button"
              disabled={disabled}
              onClick={() => {
                setLinkKind(kind);
                setSelectedId(
                  kind === "project"
                    ? ctx.currentProjectId || ctx.projectOptions[0]?.id || ""
                    : kind === "opportunity"
                      ? ctx.currentOpportunityId || ctx.opportunityOptions[0]?.id || ""
                      : "",
                );
              }}
              className={`border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                linkKind === kind
                  ? "border-upcycle-orange bg-upcycle-orange text-white"
                  : "border-carbon-blue/15 text-carbon-blue/60"
              } disabled:opacity-40`}
            >
              {kind}
            </button>
          );
        })}
      </div>

      {!opportunityEligible ? (
        <p className="text-[11px] text-carbon-blue/45">
          Not a sell-to relationship — keep on company or project (no opportunity).
        </p>
      ) : null}

      {linkKind === "project" ? (
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full border border-carbon-blue/15 px-3 py-2 text-sm"
        >
          <option value="">Select project…</option>
          {ctx.projectOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : null}

      {linkKind === "opportunity" ? (
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="w-full border border-carbon-blue/15 px-3 py-2 text-sm"
        >
          <option value="">Select opportunity…</option>
          {ctx.opportunityOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : null}

      <button
        type="button"
        disabled={
          busy ||
          (linkKind === "project" && !selectedId) ||
          (linkKind === "opportunity" && !selectedId)
        }
        onClick={() => void assign()}
        className="w-full border border-upcycle-orange bg-upcycle-orange px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white disabled:opacity-40"
      >
        {busy ? "Assigning…" : "Assign"}
      </button>
      {status ? <p className="text-[11px] text-carbon-blue/70">{status}</p> : null}
      {error ? <p className="text-[11px] text-red-700">{error}</p> : null}
    </div>
  );
}
