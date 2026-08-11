"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

type M365Status = {
  connected: boolean;
  lastSyncedAt?: string | null;
};

/**
 * Always-on Outlook mail sync control for the global workspace header.
 */
export function M365MailSyncHeaderButton() {
  const [status, setStatus] = useState<M365Status | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/m365/status", { credentials: "include" });
      if (!response.ok) {
        setStatus(null);
        return;
      }
      setStatus((await response.json()) as M365Status);
    } catch {
      setStatus(null);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const syncNow = async () => {
    setSyncing(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/m365/mail-sync", {
        method: "POST",
        credentials: "include",
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        result?: { upserted?: number; tombstoned?: number };
      };
      if (!response.ok) {
        throw new Error(body.error ?? "Mail sync failed");
      }
      const upserted = body.result?.upserted ?? 0;
      setMessage(
        upserted === 0
          ? "Mailbox up to date"
          : `Synced ${upserted} message${upserted === 1 ? "" : "s"}`,
      );
      await reload();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Mail sync failed");
    } finally {
      setSyncing(false);
    }
  };

  if (!status?.connected) {
    return (
      <Link
        href="/m365-preview"
        className="inline-flex items-center gap-1.5 border border-carbon-blue/15 bg-white px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue transition-colors hover:border-upcycle-orange hover:text-upcycle-orange"
        title="Connect Microsoft 365 to sync Outlook mail"
      >
        <RefreshCw className="size-3" strokeWidth={2} aria-hidden />
        Connect to sync
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {error ? (
        <span className="hidden max-w-[14rem] truncate text-[10px] text-red-700/80 sm:inline" title={error}>
          {error}
        </span>
      ) : message ? (
        <span className="hidden max-w-[14rem] truncate text-[10px] text-emerald-700/90 sm:inline" title={message}>
          {message}
        </span>
      ) : status.lastSyncedAt ? (
        <span
          className="hidden text-[10px] text-carbon-blue/40 sm:inline"
          title={new Date(status.lastSyncedAt).toLocaleString()}
        >
          Last sync {new Date(status.lastSyncedAt).toLocaleTimeString()}
        </span>
      ) : null}
      <button
        type="button"
        disabled={syncing}
        onClick={() => void syncNow()}
        className="inline-flex items-center gap-1.5 border border-carbon-blue/15 bg-white px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue transition-colors hover:border-upcycle-orange hover:text-upcycle-orange disabled:opacity-50"
        title="Sync Outlook mailbox now"
      >
        <RefreshCw
          className={`size-3 ${syncing ? "animate-spin" : ""}`}
          strokeWidth={2}
          aria-hidden
        />
        {syncing ? "Syncing…" : "Sync Outlook"}
      </button>
    </div>
  );
}
