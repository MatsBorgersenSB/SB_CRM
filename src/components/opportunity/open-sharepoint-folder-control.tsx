"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FolderPlus } from "lucide-react";
import { withAuthRoleHeaders } from "@/lib/api-auth";
import { useAuth } from "@/context/auth-context";

export type SharePointFolderLinkState = {
  sharepointFolderUrl: string | null;
  sharepointFolderId: string | null;
  sharepointFolderPath: string | null;
  loading: boolean;
  refresh: () => void;
};

/**
 * Resolve SharePoint document folder metadata for a portfolio deal
 * (Prisma opportunity registry — folder provisioned after create).
 */
export function useOpportunitySharePointFolder(
  dealId: string,
  assetName?: string,
): SharePointFolderLinkState {
  const [state, setState] = useState<Omit<SharePointFolderLinkState, "refresh">>({
    sharepointFolderUrl: null,
    sharepointFolderId: null,
    sharepointFolderPath: null,
    loading: true,
  });
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setTick((current) => current + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({ ...current, loading: true }));

    const params = new URLSearchParams();
    if (dealId) params.set("dealId", dealId);
    if (assetName?.trim()) params.set("name", assetName.trim());

    void fetch(`/api/opportunities/sharepoint?${params.toString()}`)
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as {
          sharepointFolderUrl?: string | null;
          sharepointFolderId?: string | null;
          sharepointFolderPath?: string | null;
        };
      })
      .then((body) => {
        if (cancelled) return;
        setState({
          sharepointFolderUrl: body?.sharepointFolderUrl?.trim() || null,
          sharepointFolderId: body?.sharepointFolderId?.trim() || null,
          sharepointFolderPath: body?.sharepointFolderPath?.trim() || null,
          loading: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({
          sharepointFolderUrl: null,
          sharepointFolderId: null,
          sharepointFolderPath: null,
          loading: false,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [dealId, assetName, tick]);

  return { ...state, refresh };
}

/**
 * Open SharePoint Folder when linked; otherwise offer Create / Retry.
 * Auto-provision runs on opportunity create; this is the user recovery path.
 */
export function OpenSharePointFolderControl({
  sharepointFolderUrl,
  loading = false,
  dealId,
  companyName,
  opportunityTitle,
  onProvisioned,
  className = "",
}: {
  sharepointFolderUrl?: string | null;
  loading?: boolean;
  dealId?: string;
  companyName?: string;
  opportunityTitle?: string;
  onProvisioned?: (url: string) => void;
  className?: string;
}) {
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);

  const url = localUrl?.trim() || sharepointFolderUrl?.trim() || "";

  const handleProvision = async () => {
    if (!dealId?.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/opportunities/sharepoint", {
        method: "POST",
        headers: withAuthRoleHeaders(user.role, {
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          dealId,
          companyName,
          opportunityTitle,
        }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        sharepointFolderUrl?: string | null;
        detail?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(body.detail || body.error || `Provision failed (${response.status})`);
      }
      const nextUrl = body.sharepointFolderUrl?.trim() || null;
      if (!nextUrl) {
        throw new Error("SharePoint folder was created but no URL was returned");
      }
      setLocalUrl(nextUrl);
      onProvisioned?.(nextUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create SharePoint folder");
    } finally {
      setBusy(false);
    }
  };

  if (loading && !url) {
    return (
      <span
        className={`inline-flex items-center border border-[#0284c7]/20 bg-[#0284c7]/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#38bdf8]/70 ${className}`}
      >
        SharePoint: Checking…
      </span>
    );
  }

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 border border-[#0284c7]/30 bg-[#0284c7]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#38bdf8] transition-colors hover:bg-[#0284c7]/20 ${className}`}
      >
        <ExternalLink className="size-3 shrink-0" aria-hidden />
        Open SharePoint Folder
      </a>
    );
  }

  if (!dealId) {
    return (
      <span
        className={`inline-flex items-center border border-carbon-blue/10 bg-carbon-blue/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40 ${className}`}
        title="Folder will appear after Graph/Azure provision completes"
      >
        SharePoint: Pending Azure
      </span>
    );
  }

  return (
    <span className={`inline-flex max-w-full flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        disabled={busy}
        onClick={() => void handleProvision()}
        title="Create Documents/Opportunities/{Company}/{Deal} in SharePoint"
        className="inline-flex items-center gap-1.5 border border-upcycle-orange/30 bg-upcycle-orange/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange transition-colors hover:bg-upcycle-orange/15 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <FolderPlus className="size-3 shrink-0" aria-hidden />
        {busy ? "Creating folder…" : "Create SharePoint Folder"}
      </button>
      {error ? (
        <span className="max-w-[280px] text-[10px] leading-snug text-thermal-red" role="alert">
          {error}
        </span>
      ) : (
        <span className="text-[9px] text-carbon-blue/35">
          Path: Documents / Opportunities / …
        </span>
      )}
    </span>
  );
}
