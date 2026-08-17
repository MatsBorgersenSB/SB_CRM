"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import { useAuth } from "@/context/auth-context";

type SharePointFolderPayload = {
  sharepointFolderUrl?: string | null;
  error?: string;
  detail?: string;
};

async function readFolderUrl(response: Response): Promise<string> {
  const body = (await response.json().catch(() => ({}))) as SharePointFolderPayload;
  if (!response.ok) {
    throw new Error(body.detail || body.error || `SharePoint failed (${response.status})`);
  }
  const url = body.sharepointFolderUrl?.trim() || "";
  if (!url) {
    throw new Error("SharePoint folder was created but no URL was returned");
  }
  return url;
}

/**
 * Opens the SharePoint file when a URL is known; otherwise ensures the
 * company Documents folder and opens that.
 */
export function ViewInSharePointButton({
  fileUrl,
  folderUrl: folderUrlProp,
  companyId,
  dealId,
  dealName,
  companyName,
  className = "",
}: {
  fileUrl?: string | null;
  folderUrl?: string | null;
  companyId?: string | null;
  dealId?: string | null;
  dealName?: string | null;
  companyName?: string | null;
  className?: string;
}) {
  const { user } = useAuth();
  const [folderUrl, setFolderUrl] = useState<string | null>(folderUrlProp?.trim() || null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const knownFileUrl = fileUrl?.trim() || "";
  const knownFolderUrl = folderUrl?.trim() || folderUrlProp?.trim() || "";
  const href = knownFileUrl || knownFolderUrl;
  const canEnsureCompany = Boolean(companyId?.trim());
  const canEnsureDeal = Boolean(dealId?.trim());

  const ensureFolder = useCallback(async (): Promise<string> => {
    const headers: HeadersInit = {
      [AUTH_ROLE_HEADER]: user.role,
      "Content-Type": "application/json",
    };

    if (canEnsureCompany && companyId) {
      const response = await fetch(
        `/api/companies/${encodeURIComponent(companyId)}/sharepoint`,
        { method: "POST", credentials: "include", headers },
      );
      return readFolderUrl(response);
    }

    if (canEnsureDeal && dealId) {
      const response = await fetch("/api/opportunities/sharepoint", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify({
          dealId,
          companyName,
          opportunityTitle: dealName,
        }),
      });
      return readFolderUrl(response);
    }

    throw new Error("No company or opportunity to open in SharePoint");
  }, [canEnsureCompany, canEnsureDeal, companyId, companyName, dealId, dealName, user.role]);

  useEffect(() => {
    if (knownFileUrl || folderUrlProp?.trim() || !canEnsureCompany || !companyId) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    void fetch(`/api/companies/${encodeURIComponent(companyId)}/sharepoint`, {
      credentials: "include",
    })
      .then((response) => readFolderUrl(response))
      .then((url) => {
        if (!cancelled) setFolderUrl(url);
      })
      .catch(() => {
        /* Lookup failed — the button still offers an on-demand open. */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [canEnsureCompany, companyId, folderUrlProp, knownFileUrl]);

  const handleEnsureAndOpen = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const url = await ensureFolder();
      setFolderUrl(url);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (openError) {
      setError(openError instanceof Error ? openError.message : "Could not open SharePoint");
    } finally {
      setBusy(false);
    }
  };

  const linkClass = `inline-flex items-center gap-1.5 border border-[#0284c7]/30 bg-[#0284c7]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#38bdf8] transition-colors hover:bg-[#0284c7]/20 ${className}`;

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
        <ExternalLink className="size-3 shrink-0" aria-hidden />
        View in SharePoint
      </a>
    );
  }

  if (loading) {
    return (
      <span
        className={`inline-flex items-center border border-[#0284c7]/20 bg-[#0284c7]/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#38bdf8]/70 ${className}`}
      >
        SharePoint: Checking…
      </span>
    );
  }

  if (!canEnsureCompany && !canEnsureDeal) {
    return null;
  }

  return (
    <span className={`inline-flex max-w-full flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleEnsureAndOpen()}
        className="inline-flex items-center gap-1.5 border border-upcycle-orange/30 bg-upcycle-orange/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange transition-colors hover:bg-upcycle-orange/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <ExternalLink className="size-3 shrink-0" aria-hidden />
        {busy ? "Opening…" : "View in SharePoint"}
      </button>
      {error ? (
        <span className="max-w-[280px] text-[10px] leading-snug text-thermal-red" role="alert">
          {error}
        </span>
      ) : null}
    </span>
  );
}
