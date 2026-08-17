"use client";

import { useEffect, useState } from "react";
import { DraftInOutlookButton } from "@/components/opportunities/draft-in-outlook-button";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { CompanyRelationshipPosture } from "@/lib/company-classification";
import {
  resolveOutlookOpenMessageSeed,
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
  const [context, setContext] = useState<TagContextPayload | null>(null);
  const [linkKind, setLinkKind] = useState<"opportunity" | "project">("opportunity");
  const [selectedId, setSelectedId] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const openSeed = await resolveOutlookOpenMessageSeed();
        if (cancelled) return;
        setSeed(openSeed);

        const params = new URLSearchParams({ email });
        if (openSeed?.conversationId) {
          params.set("conversationId", openSeed.conversationId);
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
  }, [email, role]);

  const commercialTagging =
    opportunityEligible ?? context?.opportunityEligible ?? true;
  const options =
    linkKind === "project" ? context?.projectOptions ?? [] : context?.opportunityOptions ?? [];
  const conversationId = seed?.conversationId ?? null;

  const markRelationshipInOutlook = async () => {
    if (!context?.contactId || !seed) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/m365/outlook/mail-tag", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          [AUTH_ROLE_HEADER]: role,
        },
        body: JSON.stringify({
          contactId: context.contactId,
          conversationId: seed.conversationId,
          message: {
            externalMessageId: seed.externalMessageId,
            subject: seed.subject,
            senderEmail: seed.senderEmail || email,
            recipientEmails: seed.recipientEmails,
            sentAt: seed.sentAt,
            bodyPreview: seed.bodyPreview,
            webLink: seed.webLink,
            isOutbound: seed.isOutbound === true,
          },
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
      };
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || "Could not save this mail in SmartCRM");
      }

      setStatus(`Saved on ${context.companyName} in SmartCRM. Open the contact to read the mail.`);
    } catch (markError) {
      setError(markError instanceof Error ? markError.message : "Could not mark mail");
    } finally {
      setBusy(false);
    }
  };

  const applyTag = async () => {
    if (!context?.contactId || !conversationId || !selectedId || !seed) return;
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const response = await fetch("/api/m365/outlook/mail-tag", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          [AUTH_ROLE_HEADER]: role,
        },
        body: JSON.stringify({
          contactId: context.contactId,
          conversationId,
          opportunityId: linkKind === "opportunity" ? selectedId : null,
          projectId: linkKind === "project" ? selectedId : null,
          message: {
            externalMessageId: seed.externalMessageId,
            subject: seed.subject,
            senderEmail: seed.senderEmail || email,
            recipientEmails: seed.recipientEmails,
            sentAt: seed.sentAt,
            bodyPreview: seed.bodyPreview,
            webLink: seed.webLink,
            isOutbound: seed.isOutbound === true,
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
        throw new Error(payload.detail || payload.error || "Could not tag mail");
      }

      setStatus(
        linkKind === "project"
          ? "Thread tagged to project in SmartCRM."
          : "Thread tagged to opportunity in SmartCRM.",
      );
    } catch (tagError) {
      setError(tagError instanceof Error ? tagError.message : "Could not tag mail");
    } finally {
      setBusy(false);
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
          {context.companyName} is a supplier / service relationship — not linked to an
          opportunity or project. Mark this mail so it appears on the contact in SmartCRM.
        </p>
        {seed ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void markRelationshipInOutlook()}
            className="mt-2 inline-flex w-full items-center justify-center border border-carbon-blue/20 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save mail in SmartCRM"}
          </button>
        ) : (
          <p className="mt-2 text-[10px] text-carbon-blue/45">
            Open a mail item to mark it with the SmartCRM category.
          </p>
        )}
        {status ? <p className="mt-1.5 text-[10px] text-emerald-700">{status}</p> : null}
        {error ? <p className="mt-1.5 text-[10px] text-thermal-red">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="border border-upcycle-orange/25 bg-upcycle-orange/[0.03] px-3 py-2.5">
      <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-upcycle-orange">
        Tag mail
      </p>
      <p className="mt-1 text-[11px] leading-snug text-carbon-blue/55">
        Choose opportunity or project. Applies intentional SmartCRM Outlook categories.
      </p>

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
        {conversationId && seed ? (
          <button
            type="button"
            disabled={!selectedId || busy}
            onClick={() => void applyTag()}
            className="inline-flex items-center justify-center border border-carbon-blue/20 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange disabled:opacity-50"
          >
            {busy ? "Tagging…" : "Tag this thread"}
          </button>
        ) : (
          <p className="text-[10px] text-carbon-blue/45">
            Open a mail item to tag this thread, or start a tagged draft below.
          </p>
        )}

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
          className="inline-flex items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white hover:brightness-105 disabled:opacity-50"
        />
      </div>

      {status ? <p className="mt-1.5 text-[10px] text-emerald-700">{status}</p> : null}
      {error ? <p className="mt-1.5 text-[10px] text-thermal-red">{error}</p> : null}
    </div>
  );
}
