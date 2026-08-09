"use client";

import { useCallback, useEffect, useState } from "react";

type M365Status = {
  connected: boolean;
  integrationId: string | null;
  tokenExpiresAt: string | null;
  lastSyncedAt?: string | null;
  scopes: string[];
  sharePoint: {
    transport: string;
    siteConfigured: boolean;
    ready: boolean;
  };
  connectUrl: string;
};

/**
 * Connect Microsoft 365 Graph (mail + SharePoint) for the signed-in user.
 */
export function M365ConnectPanel() {
  const [status, setStatus] = useState<M365Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/m365/status", { credentials: "include" });
      if (response.status === 401) {
        setError("Sign in to SmartCRM first, then connect Outlook / SharePoint.");
        setStatus(null);
        setLoading(false);
        return;
      }
      if (!response.ok) {
        setError("Unable to read M365 connection status.");
        setStatus(null);
        setLoading(false);
        return;
      }
      setStatus((await response.json()) as M365Status);
    } catch {
      setError("Unable to read M365 connection status.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("m365") === "connected" || params.get("m365") === "error") {
      void reload();
    }
  }, [reload]);

  const syncNow = async () => {
    setSyncing(true);
    setSyncMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/m365/mail-sync", {
        method: "POST",
        credentials: "include",
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        result?: { upserted?: number; tombstoned?: number; status?: string };
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Mail sync failed");
      }
      const upserted = body.result?.upserted ?? 0;
      const tombstoned = body.result?.tombstoned ?? 0;
      setSyncMessage(
        `Synced mailbox — ${upserted} message${upserted === 1 ? "" : "s"} updated` +
          (tombstoned > 0 ? `, ${tombstoned} tombstoned` : "") +
          ".",
      );
      await reload();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Mail sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <section className="border border-carbon-blue/10 bg-carbon-blue/[0.02] px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
            Microsoft 365 · Graph
          </p>
          <p className="mt-1 text-[13px] font-semibold text-carbon-blue">
            {loading
              ? "Checking connection…"
              : status?.connected
                ? "Outlook & SharePoint connected"
                : "Connect Outlook and SharePoint"}
          </p>
          <p className="mt-1 max-w-xl text-[11px] leading-relaxed text-carbon-blue/50">
            SmartCRM keeps identity in SSO. Graph tokens (mail + files) are stored encrypted
            separately so SharePoint can be the document backend for SmartDocs.
          </p>
          {error ? <p className="mt-2 text-[11px] text-red-700/80">{error}</p> : null}
          {syncMessage ? (
            <p className="mt-2 text-[11px] text-emerald-700/90">{syncMessage}</p>
          ) : null}
          {status?.connected ? (
            <p className="mt-2 text-[11px] text-carbon-blue/45">
              SharePoint transport: {status.sharePoint.transport}
              {status.sharePoint.ready
                ? " · site ready"
                : " · set SHAREPOINT_TRANSPORT=graph and SHAREPOINT_SITE_ID"}
              {status.lastSyncedAt
                ? ` · last mail sync ${new Date(status.lastSyncedAt).toLocaleString()}`
                : " · mail not synced yet"}
            </p>
          ) : null}
        </div>
        <div className="flex flex-col gap-2">
          {!status?.connected ? (
            <a
              href="/api/auth/m365/login"
              className="inline-flex items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
            >
              Connect Microsoft 365
            </a>
          ) : (
            <>
              <button
                type="button"
                disabled={syncing}
                onClick={() => void syncNow()}
                className="inline-flex items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white disabled:opacity-50"
              >
                {syncing ? "Syncing…" : "Sync mail now"}
              </button>
              <button
                type="button"
                onClick={() => void reload()}
                className="inline-flex items-center justify-center border border-carbon-blue/15 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue"
              >
                Refresh status
              </button>
            </>
          )}
          <a
            href="/outlook-addin"
            target="_blank"
            rel="noopener noreferrer"
            className="text-center text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/50 hover:text-upcycle-orange"
          >
            Open Outlook pane preview
          </a>
        </div>
      </div>
    </section>
  );
}
