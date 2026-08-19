"use client";

import { useEffect, useState } from "react";
import { DraftInOutlookButton } from "@/components/opportunities/draft-in-outlook-button";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { CompanyRelationshipPosture } from "@/lib/company-classification";
import {
  resolveOutlookSelectedMessageSeeds,
  subscribeOutlookSelectedItemsChanged,
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
  currentOpportunityId: string | null;
  currentProjectId: string | null;
  opportunityOptions: LinkOption[];
  projectOptions: LinkOption[];
  relationshipPosture?: CompanyRelationshipPosture;
  opportunityEligible?: boolean;
  error?: string;
};

/**
 * Compact Outlook add-in control: tag the open thread and/or open a tagged draft.
 * Sell-to: opportunity or project. Buy-from / non-commercial: relationship mark only.
 */
export function OutlookMailTagPanel({
  email,
  role = "superuser",
  opportunityEligible,
}: {
  email: string;
  role?: UserRole;
  /** When false, hide Opportunity/Project commercial tagging. */
  opportunityEligible?: boolean;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [seed, setSeed] = useState<OutlookOpenMessageSeed | null>(null);
  const [seeds, setSeeds] = useState<OutlookOpenMessageSeed[]>([]);
  const [context, setContext] = useState<TagContextPayload | null>(null);
  const [linkKind, setLinkKind] = useState<"opportunity" | "project">("opportunity");
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);
  const [selectionTick, setSelectionTick] = useState(0);
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    void subscribeOutlookSelectedItemsChanged(() => {
      setSelectionTick((value) => value + 1);
    }).then((fn) => {
      unsubscribe = fn;
    });
    return () => {
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const openSeeds = await resolveOutlookSelectedMessageSeeds();
        if (cancelled) return;
        setSeeds(openSeeds);
        setSeed(openSeeds[0] ?? null);

        const params = new URLSearchParams({ email });
        if (openSeeds[0]?.conversationId) {
          params.set("conversationId", openSeeds[0].conversationId);
        }
        const response = await fetch(`/api/m365/outlook/mail-tag?${params}`, {
          headers: { [AUTH_ROLE_HEADER]: role },
          credentials: "include",
        });
        const payload = (await response.json().catch(() => ({}))) as TagContextPayload & {
          detail?: string;
        };
        if (!response.ok) {
          throw new Error(payload.detail || payload.error || "Unable to load tag options");
        }
        if (cancelled) return;
        setContext(payload);
        if (payload.currentProjectId) {
          setLinkKind("project");
          setSelectedId(payload.currentProjectId);
        } else if (payload.currentOpportunityId) {
          setLinkKind("opportunity");
          setSelectedId(payload.currentOpportunityId);
        } else {
          setSelectedId("");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load tags");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [email, role, selectionTick]);

  const commercialTagging =
    opportunityEligible ?? context?.opportunityEligible ?? true;
  const options =
    linkKind === "project" ? context?.projectOptions ?? [] : context?.opportunityOptions ?? [];
  const selectedCount = seeds.length;

  const saveSelectedMails = async (link?: {
    opportunityId?: string | null;
    projectId?: string | null;
  }) => {
    if (!context?.contactId || seeds.length === 0) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/m365/outlook/mail-tag", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [AUTH_ROLE_HEADER]: role,
        },
        body: JSON.stringify({
          contactId: context.contactId,
          ...(link?.opportunityId !== undefined ? { opportunityId: link.opportunityId } : {}),
          ...(link?.projectId !== undefined ? { projectId: link.projectId } : {}),
          messages: seeds.map((row) => ({
            conversationId: row.conversationId,
            message: {
              externalMessageId: row.externalMessageId,
              subject: row.subject,
              senderEmail: row.senderEmail || email,
              recipientEmails: row.recipientEmails,
              ...(row.sentAt ? { sentAt: row.sentAt } : {}),
              bodyPreview: row.bodyPreview,
              webLink: row.webLink,
              isOutbound: row.isOutbound === true,
            },
          })),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        saved?: number;
        failed?: number;
        total?: number;
      };
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || "Could not save mail in SmartCRM");
      }
      const saved = payload.saved ?? 0;
      const failed = payload.failed ?? 0;
      if (saved === 0) {
        throw new Error("Could not save these mails for the matched contact.");
      }
      setStatus(
        failed > 0
          ? `Saved ${saved} of ${payload.total ?? seeds.length} mails on ${context.companyName}.`
          : saved === 1
            ? `Saved on ${context.companyName} in SmartCRM.`
            : `Saved ${saved} mails on ${context.companyName} in SmartCRM.`,
      );
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save mail");
    } finally {
      setBusy(false);
    }
  };

  const markRelationshipInOutlook = async () => {
    await saveSelectedMails();
  };

  const applyTag = async () => {
    if (!selectedId) return;
    await saveSelectedMails(
      linkKind === "project"
        ? { projectId: selectedId }
        : { opportunityId: selectedId },
    );
  };

  const syncAttachmentsToSmartDocs = async () => {
    if (seeds.length === 0) return;
    setSyncBusy(true);
    setSyncError(null);
    setSyncStatus(null);
    try {
      const emailExternalMessageIds = seeds
        .map((row) => row.externalMessageId?.trim())
        .filter(Boolean) as string[];
      if (emailExternalMessageIds.length === 0) {
        throw new Error("No message ids to sync attachments.");
      }

      const response = await fetch("/api/m365/sync-attachments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [AUTH_ROLE_HEADER]: role,
        },
        credentials: "include",
        body: JSON.stringify({ emailExternalMessageIds }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        documentsSaved?: number;
        fetchedAttachments?: number;
      };

      if (!response.ok) {
        throw new Error(payload.detail || payload.error || "Could not sync attachments");
      }

      const saved = payload.documentsSaved ?? 0;
      const fetched = payload.fetchedAttachments ?? 0;
      setSyncStatus(
        saved > 0
          ? `Filed ${saved} attachment(s) into SmartDocs (${fetched} fetched).`
          : `No attachments were filed into SmartDocs (${fetched} fetched).`,
      );
    } catch (syncErr) {
      setSyncError(
        syncErr instanceof Error ? syncErr.message : "Could not file attachments",
      );
    } finally {
      setSyncBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="border border-carbon-blue/10 bg-white px-3 py-2.5">
        <p className="text-[11px] text-carbon-blue/45">Loading mail tag options…</p>
      </div>
    );
  }

  if (!context) {
    return error ? (
      <div className="border border-carbon-blue/10 bg-white px-3 py-2.5">
        <p className="text-[11px] text-thermal-red">{error}</p>
      </div>
    ) : null;
  }

  if (!commercialTagging) {
    return (
      <div className="border border-carbon-blue/15 bg-carbon-blue/[0.02] px-3 py-2.5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/45">
          Relationship mail
        </p>
        <p className="mt-1 text-[11px] leading-snug text-carbon-blue/60">
          {selectedCount > 1
            ? `${selectedCount} mails selected — save them onto ${context.companyName} in SmartCRM.`
            : `${context.companyName} is a supplier / service relationship — not linked to an opportunity or project. Mark this mail so it appears on the contact in SmartCRM.`}
        </p>
        <SelectedMailSubjects seeds={seeds} />
        {seed ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void markRelationshipInOutlook()}
            className="mt-2 inline-flex w-full items-center justify-center border border-carbon-blue/20 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange disabled:opacity-50"
          >
            {busy
              ? "Saving…"
              : selectedCount > 1
                ? `Save ${selectedCount} mails in SmartCRM`
                : "Save mail in SmartCRM"}
          </button>
        ) : (
          <p className="mt-2 text-[10px] text-carbon-blue/45">
            Select one or more mails in Outlook, then save them here.
          </p>
        )}
        {seed ? (
          <button
            type="button"
            disabled={busy || syncBusy}
            onClick={() => void syncAttachmentsToSmartDocs()}
            className="mt-2 inline-flex w-full items-center justify-center border border-carbon-blue/15 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange disabled:opacity-50"
          >
            {syncBusy ? "Filing attachments…" : "File attachments to SmartDocs"}
          </button>
        ) : null}
        {status ? <p className="mt-1.5 text-[10px] text-emerald-700">{status}</p> : null}
        {syncStatus ? <p className="mt-1.5 text-[10px] text-emerald-700">{syncStatus}</p> : null}
        {error ? <p className="mt-1.5 text-[10px] text-thermal-red">{error}</p> : null}
        {syncError ? <p className="mt-1.5 text-[10px] text-thermal-red">{syncError}</p> : null}
      </div>
    );
  }

  return (
    <div className="border border-upcycle-orange/25 bg-upcycle-orange/[0.03] px-3 py-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-upcycle-orange">
        Tag mail
      </p>
      <p className="mt-1 text-[11px] leading-snug text-carbon-blue/55">
        {selectedCount > 1
          ? `${selectedCount} mails selected. Save them onto this contact, or tag all to one opportunity or project.`
          : "Save this mail onto the contact, or tag the thread to an opportunity or project."}
      </p>
      <SelectedMailSubjects seeds={seeds} />

      <div className="mt-2 flex gap-1">
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

      <label className="mt-2 block text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
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

      <div className="mt-2 flex flex-col gap-1.5">
        {seed ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => void markRelationshipInOutlook()}
              className="inline-flex items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white hover:brightness-105 disabled:opacity-50"
            >
              {busy
                ? "Saving…"
                : selectedCount > 1
                  ? `Save ${selectedCount} mails in SmartCRM`
                  : "Save mail in SmartCRM"}
            </button>
            <button
              type="button"
              disabled={!selectedId || busy}
              onClick={() => void applyTag()}
              className="inline-flex items-center justify-center border border-carbon-blue/20 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange disabled:opacity-50"
            >
              {busy
                ? "Tagging…"
                : selectedCount > 1
                  ? `Tag ${selectedCount} threads`
                  : "Tag this thread"}
            </button>
          </>
        ) : (
          <p className="text-[10px] text-carbon-blue/45">
            Select one or more mails in Outlook, then save them here.
          </p>
        )}

        {seed ? (
          <button
            type="button"
            disabled={busy || syncBusy}
            onClick={() => void syncAttachmentsToSmartDocs()}
            className="inline-flex items-center justify-center border border-carbon-blue/15 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange disabled:opacity-50"
          >
            {syncBusy ? "Filing attachments…" : `File attachments (${selectedCount})`}
          </button>
        ) : null}

        <DraftInOutlookButton
          toEmail={email}
          subject={
            linkKind === "project"
              ? `Re: ${options.find((row) => row.id === selectedId)?.name ?? "project"}`
              : `Re: ${options.find((row) => row.id === selectedId)?.name ?? "opportunity"}`
          }
          bodyHtml="<p>Hi,</p><p></p><p>Best regards</p>"
          opportunityId={linkKind === "opportunity" ? selectedId || undefined : undefined}
          projectId={linkKind === "project" ? selectedId || undefined : undefined}
          role={role}
          disabled={!selectedId}
          label="New tagged mail"
          className="inline-flex items-center justify-center border border-carbon-blue/20 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange disabled:opacity-50"
        />
      </div>

      {status ? <p className="mt-1.5 text-[10px] text-emerald-700">{status}</p> : null}
      {syncStatus ? <p className="mt-1.5 text-[10px] text-emerald-700">{syncStatus}</p> : null}
      {error ? <p className="mt-1.5 text-[10px] text-thermal-red">{error}</p> : null}
      {syncError ? <p className="mt-1.5 text-[10px] text-thermal-red">{syncError}</p> : null}
    </div>
  );
}

function SelectedMailSubjects({ seeds }: { seeds: OutlookOpenMessageSeed[] }) {
  if (seeds.length <= 1) return null;
  return (
    <ul className="mt-2 max-h-28 overflow-auto text-[11px] leading-snug text-carbon-blue/60">
      {seeds.slice(0, 8).map((row) => (
        <li key={row.externalMessageId} className="truncate">
          {row.subject}
        </li>
      ))}
    </ul>
  );
}
