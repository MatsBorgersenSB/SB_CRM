"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";

export type SharePointFolderLinkState = {
  sharepointFolderUrl: string | null;
  sharepointFolderId: string | null;
  sharepointFolderPath: string | null;
  loading: boolean;
};

/**
 * Resolve SharePoint document folder metadata for a portfolio deal
 * (Prisma opportunity registry — folder provisioned after create).
 */
export function useOpportunitySharePointFolder(
  dealId: string,
  assetName?: string,
): SharePointFolderLinkState {
  const [state, setState] = useState<SharePointFolderLinkState>({
    sharepointFolderUrl: null,
    sharepointFolderId: null,
    sharepointFolderPath: null,
    loading: true,
  });

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
  }, [dealId, assetName]);

  return state;
}

/**
 * Open SharePoint Folder action — shown when folder URL is known;
 * otherwise a subtle pending badge (Azure / Graph provision in flight).
 */
export function OpenSharePointFolderControl({
  sharepointFolderUrl,
  loading = false,
  className = "",
}: {
  sharepointFolderUrl?: string | null;
  loading?: boolean;
  className?: string;
}) {
  if (loading) {
    return (
      <span
        className={`inline-flex items-center border border-[#0284c7]/20 bg-[#0284c7]/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#38bdf8]/70 ${className}`}
      >
        SharePoint: Checking…
      </span>
    );
  }

  const url = sharepointFolderUrl?.trim();
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

  return (
    <span
      className={`inline-flex items-center border border-carbon-blue/10 bg-carbon-blue/[0.03] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40 ${className}`}
      title="Folder will appear after Graph/Azure provision completes"
    >
      SharePoint: Pending Azure
    </span>
  );
}
