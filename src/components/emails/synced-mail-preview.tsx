"use client";

import { useEffect, useState } from "react";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import type { UserRole } from "@/types/auth";

type EmailViewPayload = {
  bodyPreview?: string | null;
  bodyText?: string | null;
  webLink?: string | null;
  error?: string;
  detail?: string;
};

/**
 * Expandable SmartCRM mail preview + Open in Outlook for synced messages.
 */
export function SyncedMailPreview({
  emailId,
  bodyPreview,
  webLink = null,
  role = "superuser",
  compact = false,
  presentation = "default",
}: {
  emailId: string;
  bodyPreview: string | null;
  webLink?: string | null;
  role?: UserRole;
  compact?: boolean;
  /** snippet = text only; reader = expanded body + Open in Outlook. */
  presentation?: "default" | "snippet" | "reader";
}) {
  const isReader = presentation === "reader";
  const isSnippet = presentation === "snippet";
  const [expanded, setExpanded] = useState(isReader);
  const [previewText, setPreviewText] = useState(bodyPreview);
  const [outlookUrl, setOutlookUrl] = useState(webLink);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const snippet = (previewText || bodyPreview || "").trim();
  const shortSnippet =
    snippet.length > 140 ? `${snippet.slice(0, 140)}…` : snippet;

  const loadView = async (): Promise<EmailViewPayload | null> => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/emails/${encodeURIComponent(emailId)}/view?enrich=1`,
        {
          headers: { [AUTH_ROLE_HEADER]: role },
          cache: "no-store",
        },
      );
      const payload = (await response.json().catch(() => ({}))) as EmailViewPayload;
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || "Could not load preview");
      }
      const text = (payload.bodyText || payload.bodyPreview || "").trim();
      if (text) setPreviewText(text);
      if (payload.webLink) setOutlookUrl(payload.webLink);
      return payload;
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Could not load preview",
      );
      return null;
    } finally {
      setLoading(false);
    }
  };

  const togglePreview = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!previewText || previewText.length < 80 || !outlookUrl) {
      await loadView();
    }
  };

  const openInOutlook = async () => {
    if (outlookUrl) {
      window.open(outlookUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const payload = await loadView();
    const link = payload?.webLink || outlookUrl;
    if (link) {
      window.open(link, "_blank", "noopener,noreferrer");
      return;
    }
    setError("Outlook link is not available for this message yet. Sync Outlook and try again.");
  };

  useEffect(() => {
    if (!isReader) return;
    setExpanded(true);
    if (!previewText || previewText.length < 80 || !outlookUrl) {
      void loadView();
    }
    // Load once per message when the conversation is opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailId, isReader]);

  if (isSnippet) {
    if (!shortSnippet) return null;
    return (
      <p className="text-[12px] leading-relaxed text-carbon-blue/55">{shortSnippet}</p>
    );
  }

  return (
    <div className={compact || isReader ? "mt-1.5" : "mt-2"}>
      {!expanded && shortSnippet ? (
        <p className="text-[11px] leading-relaxed text-carbon-blue/55">{shortSnippet}</p>
      ) : null}

      {expanded ? (
        <div className="mt-1 max-h-64 overflow-y-auto border border-carbon-blue/10 bg-white px-2.5 py-2">
          {loading && !previewText ? (
            <p className="text-[12px] text-carbon-blue/45">Loading preview…</p>
          ) : (
            <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-carbon-blue/80">
              {(previewText || bodyPreview || "No preview available.").trim()}
            </p>
          )}
        </div>
      ) : null}

      {error ? <p className="mt-1 text-[11px] text-red-700/80">{error}</p> : null}

      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        {isReader ? null : (
          <button
            type="button"
            disabled={loading}
            onClick={() => void togglePreview()}
            className="inline-flex items-center border border-carbon-blue/15 bg-white px-2.5 py-1 text-[11px] font-semibold text-carbon-blue/75 transition-colors hover:border-upcycle-orange/40 hover:text-upcycle-orange disabled:opacity-50"
          >
            {expanded ? "Hide preview" : "Preview in SmartCRM"}
          </button>
        )}
        <button
          type="button"
          disabled={loading}
          onClick={() => void openInOutlook()}
          className="inline-flex items-center border border-carbon-blue/15 bg-white px-2.5 py-1 text-[11px] font-semibold text-carbon-blue/75 transition-colors hover:border-upcycle-orange/40 hover:text-upcycle-orange disabled:opacity-50"
        >
          {loading ? "Opening…" : "Open in Outlook"}
        </button>
      </div>
    </div>
  );
}
