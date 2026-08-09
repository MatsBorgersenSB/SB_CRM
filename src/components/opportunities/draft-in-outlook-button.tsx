"use client";

import { useState } from "react";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { UserRole } from "@/types/auth";

export type DraftInOutlookRequest = {
  toEmail: string;
  subject: string;
  bodyHtml: string;
  opportunityId?: string;
  projectId?: string;
};

type DraftApiResponse = {
  success?: boolean;
  webLink?: string | null;
  deepLink?: string | null;
  draftId?: string;
  error?: string;
  detail?: string;
};

/**
 * Opens a Graph draft (webLink) or Outlook compose deepLink in a new tab.
 * When opportunityId or projectId is set, the draft receives intentional SmartCRM categories.
 */
export async function openOutlookDraft(
  input: DraftInOutlookRequest,
  role: UserRole = "superuser",
): Promise<void> {
  const response = await fetch("/api/m365/draft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      [AUTH_ROLE_HEADER]: role,
    },
    body: JSON.stringify({
      toEmail: input.toEmail,
      subject: input.subject,
      bodyHtml: input.bodyHtml,
      opportunityId: input.opportunityId,
      projectId: input.projectId,
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as DraftApiResponse;
  if (!response.ok || payload.success === false) {
    throw new Error(payload.detail || payload.error || "Could not open Outlook draft");
  }

  const href = payload.webLink || payload.deepLink;
  if (!href) {
    throw new Error("Draft API returned no webLink or deepLink");
  }

  window.open(href, "_blank", "noopener,noreferrer");
}

export function DraftInOutlookButton({
  toEmail,
  subject,
  bodyHtml,
  opportunityId,
  projectId,
  role = "superuser",
  disabled = false,
  className = "",
  label = "Draft in Outlook",
}: DraftInOutlookRequest & {
  role?: UserRole;
  disabled?: boolean;
  className?: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = async () => {
    setBusy(true);
    setError(null);
    try {
      await openOutlookDraft(
        { toEmail, subject, bodyHtml, opportunityId, projectId },
        role,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Draft failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        type="button"
        disabled={disabled || busy || !toEmail}
        onClick={() => void onClick()}
        className={
          className ||
          "border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold text-white hover:brightness-105 disabled:opacity-50"
        }
      >
        {busy ? "Opening Outlook…" : label}
      </button>
      {error ? <p className="text-[10px] text-thermal-red">{error}</p> : null}
    </div>
  );
}
