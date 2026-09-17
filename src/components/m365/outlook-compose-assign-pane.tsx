"use client";

/**
 * Michelin Compose Assign pane — assign while writing (hybrid path #2).
 * Blocks: (1) recipient (2) assign target (3) Assign / Add to SmartCRM.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { OutlookNoContactState } from "@/components/m365/outlook-no-contact-state";
import { OutlookContactSearch, type OutlookContactHit } from "@/components/m365/outlook-contact-search";
import { openOutlookSignInDialog } from "@/components/m365/outlook-auth-gate";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { CompanyRelationshipPosture } from "@/lib/company-classification";
import {
  addOutlookComposeRecipient,
  ensureOutlookComposeSeed,
  resolveOutlookComposeRecipients,
  subscribeOutlookComposeRecipientsChanged,
  type OutlookComposeRecipient,
  type OutlookOpenMessageSeed,
} from "@/lib/m365/outlook-context";
import type { UserRole } from "@/types/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

type AssignLinkKind = "company" | "project" | "opportunity";

type Phase =
  | { status: "loading" }
  | { status: "auth-required" }
  | { status: "no-recipients" }
  | { status: "unknown"; email: string; displayName: string }
  | { status: "ready"; email: string; context: TagContextPayload };

async function loadTagContext(
  input: { email?: string; contactId?: string },
  role: UserRole,
): Promise<
  | { kind: "auth" }
  | { kind: "unknown" }
  | { kind: "ready"; context: TagContextPayload }
  | { kind: "error"; message: string }
> {
  const params = new URLSearchParams();
  if (input.email?.trim()) params.set("email", input.email.trim().toLowerCase());
  if (input.contactId?.trim()) params.set("contactId", input.contactId.trim());
  if (!params.has("email") && !params.has("contactId")) {
    return { kind: "error", message: "Choose a contact or enter an email." };
  }

  const response = await fetch(`/api/m365/outlook/mail-tag?${params}`, {
    headers: { [AUTH_ROLE_HEADER]: role },
    credentials: "include",
  });

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
  const [linkKind, setLinkKind] = useState<AssignLinkKind>("company");
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [manualEmail, setManualEmail] = useState("");
  const [newContactDraft, setNewContactDraft] = useState<{
    email: string;
    displayName: string;
  } | null>(null);
  const recipientKeyRef = useRef("");
  const keepCrmChoiceRef = useRef(false);

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  const applyReadyContext = (email: string, context: TagContextPayload) => {
    setPhase({ status: "ready", email, context });
    const opportunityEligible = context.opportunityEligible ?? true;
    if (context.currentProjectId) {
      setLinkKind("project");
      setSelectedId(context.currentProjectId);
    } else if (context.currentOpportunityId && opportunityEligible) {
      setLinkKind("opportunity");
      setSelectedId(context.currentOpportunityId);
    } else {
      setLinkKind("company");
      setSelectedId("");
    }
  };

  const loadForEmail = useCallback(
    async (email: string, displayName = "") => {
      keepCrmChoiceRef.current = true;
      setPhase({ status: "loading" });
      setError(null);
      setStatus(null);
      const normalized = email.trim().toLowerCase();
      if (!EMAIL_RE.test(normalized)) {
        setError("Enter a valid email address.");
        setPhase({ status: "no-recipients" });
        return;
      }

      const result = await loadTagContext({ email: normalized }, role);
      if (result.kind === "auth") {
        setPhase({ status: "auth-required" });
        return;
      }
      if (result.kind === "unknown") {
        setPhase({
          status: "unknown",
          email: normalized,
          displayName,
        });
        return;
      }
      if (result.kind === "error") {
        setError(result.message);
        setPhase({ status: "no-recipients" });
        return;
      }
      setSelectedEmail(normalized);
      applyReadyContext(normalized, result.context);
    },
    [role],
  );

  const selectCrmContact = useCallback(
    async (hit: OutlookContactHit) => {
      keepCrmChoiceRef.current = true;
      setError(null);
      setStatus(null);
      setNewContactDraft(null);
      if (hit.email) {
        await addOutlookComposeRecipient({
          email: hit.email,
          displayName: hit.name,
        });
        setRecipients((current) => {
          if (current.some((row) => row.email === hit.email)) return current;
          return [{ email: hit.email!, displayName: hit.name }, ...current];
        });
        await loadForEmail(hit.email, hit.name);
        return;
      }

      setPhase({ status: "loading" });
      const result = await loadTagContext({ contactId: hit.id }, role);
      if (result.kind === "auth") {
        setPhase({ status: "auth-required" });
        return;
      }
      if (result.kind === "unknown") {
        setError("This contact is in search but could not be opened. Add them again with an email.");
        setPhase({ status: "no-recipients" });
        return;
      }
      if (result.kind === "error") {
        setError(result.message);
        setPhase({ status: "no-recipients" });
        return;
      }
      applyReadyContext("", result.context);
    },
    [loadForEmail, role],
  );

  const startNewContact = (draft: {
    query: string;
    email: string;
    displayName: string;
  }) => {
    setError(null);
    setStatus(null);
    if (draft.email && EMAIL_RE.test(draft.email)) {
      void loadForEmail(draft.email, draft.displayName);
      return;
    }
    setNewContactDraft({
      email: draft.email,
      displayName: draft.displayName || draft.query,
    });
    setPhase({ status: "no-recipients" });
  };

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const list = await resolveOutlookComposeRecipients({
        attempts: 6,
        delayMs: 350,
      });
      if (cancelled) return;

      if (list.length === 0 && keepCrmChoiceRef.current) {
        return;
      }

      setPhase({ status: "loading" });
      setError(null);
      setStatus(null);
      setRecipients(list);
      recipientKeyRef.current = list
        .map((entry) => entry.email)
        .sort()
        .join(",");

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

      const result = await loadTagContext({ email: preferred }, role);
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
    let active = true;
    let unsubscribe: (() => void) | undefined;
    let timer: number | undefined;

    void (async () => {
      unsubscribe = await subscribeOutlookComposeRecipientsChanged(() => {
        if (!active) return;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          void resolveOutlookComposeRecipients({ attempts: 1, delayMs: 0 }).then((list) => {
            if (!active) return;
            const key = list
              .map((entry) => entry.email)
              .sort()
              .join(",");
            if (key === recipientKeyRef.current) return;
            recipientKeyRef.current = key;
            reload();
          });
        }, 400);
      });
    })();

    return () => {
      active = false;
      window.clearTimeout(timer);
      unsubscribe?.();
    };
  }, [reload]);

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

      const result = await loadTagContext({ email: selectedEmail }, role);
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

  const opportunityEligible =
    phase.status === "ready"
      ? (phase.context.opportunityEligible ?? true)
      : true;

  const options =
    phase.status === "ready"
      ? linkKind === "project"
        ? phase.context.projectOptions
        : linkKind === "opportunity"
          ? phase.context.opportunityOptions
          : []
      : [];

  const assignMail = async () => {
    if (phase.status !== "ready") return;
    if (linkKind !== "company" && !selectedId) return;

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
          ...(linkKind === "company"
            ? {}
            : {
                opportunityId: linkKind === "opportunity" ? selectedId : null,
                projectId: linkKind === "project" ? selectedId : null,
              }),
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

      setStatus(
        linkKind === "project"
          ? "Assigned to project in SmartCRM."
          : linkKind === "opportunity"
            ? "Assigned to opportunity in SmartCRM."
            : `Saved on ${phase.context.companyName} — no opportunity or project link.`,
      );
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Could not assign mail");
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
        Search SmartCRM for the person, or add them if they are new. Opportunity only
        appears for sell-to relationships (Customer / Prospect / Offtaker).
      </p>

      {phase.status === "loading" ? (
        <p className="mt-4 text-[11px] text-carbon-blue/45">
          {recipients.length === 0
            ? "Looking up contacts…"
            : "Reading recipients…"}
        </p>
      ) : null}

      <div className="mt-4">
        <OutlookContactSearch
          role={role}
          disabled={busy}
          onSelect={(hit) => void selectCrmContact(hit)}
          onCreateNew={startNewContact}
        />
      </div>

      {newContactDraft ? (
        <div className="mt-3 space-y-2 border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-2">
          <p className="text-[12px] font-medium text-carbon-blue">Add a new contact</p>
          {newContactDraft.displayName ? (
            <p className="text-[11px] text-carbon-blue/55">{newContactDraft.displayName}</p>
          ) : null}
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Email
            <input
              type="email"
              value={newContactDraft.email || manualEmail}
              onChange={(event) => {
                const value = event.target.value;
                setManualEmail(value);
                setNewContactDraft((current) =>
                  current ? { ...current, email: value } : current,
                );
              }}
              placeholder="kristy.pena@arciplug.com"
              className="mt-1 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-[12px] font-medium text-carbon-blue"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              const email = (newContactDraft.email || manualEmail).trim().toLowerCase();
              void loadForEmail(email, newContactDraft.displayName);
            }}
            disabled={!EMAIL_RE.test((newContactDraft.email || manualEmail).trim())}
            className="inline-flex w-full items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white hover:brightness-105 disabled:opacity-50"
          >
            Continue
          </button>
        </div>
      ) : null}

      {phase.status === "no-recipients" && !newContactDraft ? (
        <div className="mt-3 space-y-2">
          <p className="text-[11px] leading-relaxed text-carbon-blue/55">
            Outlook has not filled To yet. Search for the person above, or refresh if you
            already typed them in Outlook.
          </p>
          <button
            type="button"
            onClick={reload}
            className="text-[11px] font-medium text-carbon-blue/50 hover:text-upcycle-orange"
          >
            Refresh Outlook recipients
          </button>
        </div>
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

      {phase.status === "ready" ? (
        <div className="mt-4 space-y-2">
          <p className="text-[11px] text-carbon-blue/55">
            {phase.context.contactName
              ? `${phase.context.contactName} · ${phase.context.companyName}`
              : phase.context.companyName}
          </p>

          <div className="flex gap-1">
            {(
              [
                { kind: "company" as const, label: "Company", enabled: true },
                { kind: "project" as const, label: "Project", enabled: true },
                {
                  kind: "opportunity" as const,
                  label: "Opportunity",
                  enabled: opportunityEligible,
                },
              ] as const
            ).map((entry) => (
              <button
                key={entry.kind}
                type="button"
                disabled={!entry.enabled}
                title={
                  entry.enabled
                    ? undefined
                    : "Opportunities are only for sell-to relationships (Customer / Prospect / Offtaker)."
                }
                onClick={() => {
                  if (!entry.enabled) return;
                  setLinkKind(entry.kind);
                  setSelectedId("");
                  setStatus(null);
                  setError(null);
                }}
                className={`flex-1 border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-40 ${
                  linkKind === entry.kind
                    ? "border-upcycle-orange/40 bg-upcycle-orange/10 text-upcycle-orange"
                    : "border-carbon-blue/15 bg-white text-carbon-blue/50"
                }`}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {linkKind === "company" ? (
            <p className="text-[11px] leading-snug text-carbon-blue/55">
              Saves this draft on {phase.context.companyName} without linking an
              opportunity or project.
              {!opportunityEligible
                ? " Opportunity stays hidden for suppliers and partners — use Project to link Escalante-style work."
                : ""}
            </p>
          ) : (
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
          )}

          <button
            type="button"
            disabled={busy || (linkKind !== "company" && !selectedId)}
            onClick={() => void assignMail()}
            className="inline-flex w-full items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white hover:brightness-105 disabled:opacity-50"
          >
            {busy
              ? "Assigning…"
              : linkKind === "company"
                ? "Save on company"
                : "Assign this mail"}
          </button>
        </div>
      ) : null}

      {status ? <p className="mt-3 text-[10px] text-emerald-700">{status}</p> : null}
      {error ? <p className="mt-3 text-[10px] text-thermal-red">{error}</p> : null}
    </div>
  );
}
