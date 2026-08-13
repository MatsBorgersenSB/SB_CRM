"use client";

/**
 * Michelin Compose Assign pane — assign while writing (hybrid path #2).
 * Blocks: (1) recipient (2) assign target (3) Assign / Add to SmartCRM.
 */

import { useCallback, useEffect, useState } from "react";
import { OutlookNoContactState } from "@/components/m365/outlook-no-contact-state";
import { openOutlookSignInDialog } from "@/components/m365/outlook-auth-gate";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { CompanyRelationshipPosture } from "@/lib/company-classification";
import {
  applyOutlookItemSmartCrmCategories,
  ensureOutlookComposeSeed,
  resolveOutlookComposeRecipients,
  type OutlookComposeRecipient,
  type OutlookOpenMessageSeed,
} from "@/lib/m365/outlook-context";
import type { UserRole } from "@/types/auth";

type LinkOption = {
  id: string;
  label: string;
  name: string;
};

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

type Phase =
  | { status: "loading" }
  | { status: "auth-required" }
  | { status: "no-recipients" }
  | { status: "unknown"; email: string; displayName: string }
  | { status: "ready"; email: string; context: TagContextPayload };

async function loadTagContext(
  email: string,
  role: UserRole,
): Promise<
  | { kind: "auth" }
  | { kind: "unknown" }
  | { kind: "ready"; context: TagContextPayload }
  | { kind: "error"; message: string }
> {
  const response = await fetch(
    `/api/m365/outlook/mail-tag?${new URLSearchParams({ email })}`,
    {
      headers: { [AUTH_ROLE_HEADER]: role },
      credentials: "include",
    },
  );

  if (response.status === 401 || response.status === 403) {
    return { kind: "auth" };
  }
  if (response.status === 404) {
    return { kind: "unknown" };
  }

  const payload = (await response.json().catch(() => ({}))) as TagContextPayload & {
    detail?: string;
  };
  if (!response.ok) {
    return {
      kind: "error",
      message: payload.detail || payload.error || "Unable to load assign options",
    };
  }
  return { kind: "ready", context: payload };
}

export function OutlookComposeAssignPane({ role = "superuser" }: { role?: UserRole }) {
  const [recipients, setRecipients] = useState<OutlookComposeRecipient[]>([]);
  const [selectedEmail, setSelectedEmail] = useState("");
  const [phase, setPhase] = useState<Phase>({ status: "loading" });
  const [linkKind, setLinkKind] = useState<"opportunity" | "project">("opportunity");
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  const applyReadyContext = (email: string, context: TagContextPayload) => {
    setPhase({ status: "ready", email, context });
    if (context.currentProjectId) {
      setLinkKind("project");
      setSelectedId(context.currentProjectId);
    } else if (context.currentOpportunityId) {
      setLinkKind("opportunity");
      setSelectedId(context.currentOpportunityId);
    } else {
      setSelectedId("");
    }
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setPhase({ status: "loading" });
      setError(null);
      setStatus(null);

      const list = await resolveOutlookComposeRecipients();
      if (cancelled) return;
      setRecipients(list);

      if (list.length === 0) {
        setSelectedEmail("");
        setPhase({ status: "no-recipients" });
        return;
      }

      const preferred =
        (selectedEmail && list.some((entry) => entry.email === selectedEmail)
          ? selectedEmail
          : list[0]!.email) || list[0]!.email;
      if (preferred !== selectedEmail) {
        setSelectedEmail(preferred);
      }

      const result = await loadTagContext(preferred, role);
      if (cancelled) return;

      if (result.kind === "auth") {
        setPhase({ status: "auth-required" });
        return;
      }
      if (result.kind === "unknown") {
        const match = list.find((entry) => entry.email === preferred);
        setPhase({
          status: "unknown",
          email: preferred,
          displayName: match?.displayName ?? "",
        });
        return;
      }
      if (result.kind === "error") {
        setError(result.message);
        setPhase({ status: "no-recipients" });
        return;
      }
      applyReadyContext(preferred, result.context);
    })();

    return () => {
      cancelled = true;
    };
    // Intentionally re-run on reload / role; recipient switch handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, reloadKey]);

  useEffect(() => {
    if (!selectedEmail || recipients.length === 0) return;
    if (phase.status === "ready" && phase.email === selectedEmail) return;
    if (phase.status === "unknown" && phase.email === selectedEmail) return;
    if (phase.status === "loading" || phase.status === "auth-required") return;
    if (phase.status === "no-recipients") return;

    let cancelled = false;
    void (async () => {
      setPhase({ status: "loading" });
      setError(null);
      setStatus(null);

      const result = await loadTagContext(selectedEmail, role);
      if (cancelled) return;

      if (result.kind === "auth") {
        setPhase({ status: "auth-required" });
        return;
      }
      if (result.kind === "unknown") {
        const match = recipients.find((entry) => entry.email === selectedEmail);
        setPhase({
          status: "unknown",
          email: selectedEmail,
          displayName: match?.displayName ?? "",
        });
        return;
      }
      if (result.kind === "error") {
        setError(result.message);
        return;
      }
      applyReadyContext(selectedEmail, result.context);
    })();

    return () => {
      cancelled = true;
    };
    // phase email mismatch drives recipient switches only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmail, recipients, role]);

  const commercialTagging =
    phase.status === "ready"
      ? (phase.context.opportunityEligible ?? true)
      : true;

  const options =
    phase.status === "ready"
      ? linkKind === "project"
        ? phase.context.projectOptions
        : phase.context.opportunityOptions
      : [];

  const assignMail = async () => {
    if (phase.status !== "ready" || !selectedId) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const seed: OutlookOpenMessageSeed | null = await ensureOutlookComposeSeed({
        primaryRecipientEmail: phase.email,
      });
      if (!seed?.conversationId) {
        throw new Error(
          "Save the draft in Outlook first (or wait a moment), then Assign again.",
        );
      }

      const response = await fetch("/api/m365/outlook/mail-tag", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          [AUTH_ROLE_HEADER]: role,
        },
        body: JSON.stringify({
          contactId: phase.context.contactId,
          conversationId: seed.conversationId,
          opportunityId: linkKind === "opportunity" ? selectedId : null,
          projectId: linkKind === "project" ? selectedId : null,
          message: {
            externalMessageId: seed.externalMessageId,
            subject: seed.subject,
            senderEmail: seed.senderEmail,
            recipientEmails: seed.recipientEmails?.length
              ? seed.recipientEmails
              : [phase.email],
            sentAt: seed.sentAt,
            isOutbound: true,
          },
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        projectName?: string | null;
        opportunityName?: string | null;
      };
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || "Could not assign mail");
      }

      const selectedName = options.find((row) => row.id === selectedId)?.name;
      await applyOutlookItemSmartCrmCategories(
        linkKind === "project"
          ? { projectName: payload.projectName || selectedName }
          : { opportunityName: payload.opportunityName || selectedName },
      );

      setStatus(
        linkKind === "project"
          ? "Assigned to project in SmartCRM."
          : "Assigned to opportunity in SmartCRM.",
      );
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Could not assign mail");
    } finally {
      setBusy(false);
    }
  };

  const markRelationshipOnly = async () => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      await ensureOutlookComposeSeed({
        primaryRecipientEmail: selectedEmail || undefined,
      });
      const ok = await applyOutlookItemSmartCrmCategories({});
      if (!ok) {
        throw new Error("Could not apply SmartCRM category on this draft.");
      }
      setStatus("Marked as SmartCRM relationship mail — no opportunity or project link.");
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Could not mark mail");
    } finally {
      setBusy(false);
    }
  };

  if (phase.status === "auth-required") {
    return (
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
          SmartCRM
        </p>
        <p className="mt-2 text-sm font-semibold text-carbon-blue">Sign In to SmartCRM</p>
        <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">
          Sign in to assign this mail to an opportunity or project.
        </p>
        <button
          type="button"
          onClick={() =>
            void openOutlookSignInDialog(() => {
              window.location.reload();
            })
          }
          className="mt-5 inline-flex w-full items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white"
        >
          Sign In to SmartCRM
        </button>
      </div>
    );
  }

  if (phase.status === "unknown") {
    return (
      <OutlookNoContactState
        email={phase.email}
        displayName={phase.displayName}
        variant="compose"
        onContactCreated={reload}
      />
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white p-4">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
        SmartCRM
      </p>
      <p className="mt-1 text-sm font-semibold text-carbon-blue">Assign this mail</p>
      <p className="mt-1 text-[11px] leading-snug text-carbon-blue/55">
        Link the draft you are writing — opportunity, project, or relationship only.
      </p>

      {phase.status === "loading" ? (
        <p className="mt-4 text-[11px] text-carbon-blue/45">Reading recipients…</p>
      ) : null}

      {phase.status === "no-recipients" ? (
        <p className="mt-4 text-[11px] leading-relaxed text-carbon-blue/55">
          Add someone in To, then open Assign again.
        </p>
      ) : null}

      {recipients.length > 0 ? (
        <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Recipient
          <select
            value={selectedEmail}
            onChange={(event) => {
              setSelectedEmail(event.target.value);
              setStatus(null);
              setError(null);
            }}
            className="mt-1 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-medium text-carbon-blue"
          >
            {recipients.map((entry) => (
              <option key={entry.email} value={entry.email}>
                {entry.displayName
                  ? `${entry.displayName} · ${entry.email}`
                  : entry.email}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {phase.status === "ready" && !commercialTagging ? (
        <div className="mt-4 border border-carbon-blue/15 bg-carbon-blue/[0.02] px-3 py-2.5">
          <p className="text-[11px] leading-snug text-carbon-blue/60">
            {phase.context.companyName} is not a sell-to relationship — keep mail on the company
            without an opportunity or project.
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void markRelationshipOnly()}
            className="mt-2 inline-flex w-full items-center justify-center border border-carbon-blue/20 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange disabled:opacity-50"
          >
            {busy ? "Marking…" : "Mark relationship mail"}
          </button>
        </div>
      ) : null}

      {phase.status === "ready" && commercialTagging ? (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] text-carbon-blue/55">
            {phase.context.contactName
              ? `${phase.context.contactName} · ${phase.context.companyName}`
              : phase.context.companyName}
          </p>

          <div className="flex gap-1">
            {(["opportunity", "project"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  setLinkKind(kind);
                  setSelectedId("");
                  setStatus(null);
                }}
                className={`flex-1 border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider ${
                  linkKind === kind
                    ? "border-upcycle-orange/40 bg-upcycle-orange/10 text-upcycle-orange"
                    : "border-carbon-blue/15 bg-white text-carbon-blue/50"
                }`}
              >
                {kind === "opportunity" ? "Opportunity" : "Project"}
              </button>
            ))}
          </div>

          <label className="block text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            {linkKind === "opportunity" ? "Opportunity" : "Project"}
            <select
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              className="mt-1 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-medium text-carbon-blue"
            >
              <option value="">Select…</option>
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={!selectedId || busy}
            onClick={() => void assignMail()}
            className="inline-flex w-full items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white hover:brightness-105 disabled:opacity-50"
          >
            {busy ? "Assigning…" : "Assign this mail"}
          </button>
        </div>
      ) : null}

      {status ? <p className="mt-3 text-[10px] text-emerald-700">{status}</p> : null}
      {error ? <p className="mt-3 text-[10px] text-thermal-red">{error}</p> : null}
    </div>
  );
}
