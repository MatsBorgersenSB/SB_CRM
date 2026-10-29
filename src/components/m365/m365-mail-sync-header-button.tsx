"use client";

import { formatTime } from "@/lib/regional-format-preference";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";

type M365Status = {
  connected: boolean;
  lastSyncedAt?: string | null;
};

/**
 * Quiet Outlook mail sync control — lives in the sidebar footer, not a product header.
 */
export function M365MailSyncHeaderButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
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
    let active = true;
    void fetch("/api/m365/status", { credentials: "include" })
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) {
          setStatus(null);
          return;
        }
        setStatus((await response.json()) as M365Status);
      })
      .catch(() => {
        if (active) setStatus(null);
      });
    return () => {
      active = false;
    };
  }, []);

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
      router.refresh();
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
        className={cn(
          "inline-flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs tracking-tight",
          "text-muted-foreground transition-colors hover:bg-accent/80 hover:text-foreground",
        )}
        title="Connect Microsoft 365 to sync mail"
      >
        <RefreshCw className="size-3" strokeWidth={2} aria-hidden />
        Connect mail
      </Link>
    );
  }

  const statusLabel = error
    ? error
    : message
      ? message
      : status.lastSyncedAt
        ? `Last sync ${formatTime(new Date(status.lastSyncedAt))}`
        : null;

  return (
    <div className="flex flex-col gap-1">
      {statusLabel && !compact ? (
        <span
          className={cn(
            "hidden truncate text-[11px] sm:inline",
            error ? "text-destructive" : "text-muted-foreground",
          )}
          title={statusLabel}
        >
          {statusLabel}
        </span>
      ) : null}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={syncing}
        onClick={() => void syncNow()}
        className="w-full justify-start px-2 text-muted-foreground"
        title="Sync Outlook mailbox now"
      >
        <RefreshCw
          className={cn("size-3", syncing ? "animate-spin" : "")}
          strokeWidth={2}
          aria-hidden
        />
        {syncing ? "Syncing…" : "Sync mail"}
      </Button>
      {compact && statusLabel ? (
        <span
          className={cn(
            "truncate px-2 text-[11px]",
            error ? "text-destructive" : "text-muted-foreground",
          )}
          title={statusLabel}
        >
          {statusLabel}
        </span>
      ) : null}
    </div>
  );
}
