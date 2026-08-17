"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import { useAuth } from "@/context/auth-context";
import type { NotificationDto } from "@/lib/notifications/notification-service";

const TYPE_STYLES: Record<string, string> = {
  INFO: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  ALERT: "border-amber-500/35 bg-amber-500/10 text-amber-800 dark:text-amber-200",
  APPROVAL: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  DEAL_WIN: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * FS-015 — Notification bell with unread badge and slide-over drawer.
 */
export function NotificationBell() {
  const { user } = useAuth();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = useCallback(() => setOpen(false), []);
  useEscapeKey(open, close);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/notifications", {
        headers: {
          [AUTH_ROLE_HEADER]: user.role,
          "x-sb-user-id": String(user.id),
          "x-sb-user-name": user.displayName,
        },
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => ({}))) as {
        notifications?: NotificationDto[];
        unreadCount?: number;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Could not load notifications");
      }
      setItems(payload.notifications ?? []);
      setUnreadCount(payload.unreadCount ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [user.displayName, user.id, user.role]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const markRead = useCallback(
    async (id: string) => {
      try {
        const response = await fetch(`/api/notifications/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            [AUTH_ROLE_HEADER]: user.role,
            "x-sb-user-id": String(user.id),
          },
          body: JSON.stringify({ read: true }),
        });
        if (!response.ok) return;
        setItems((current) =>
          current.map((row) => (row.id === id ? { ...row, read: true } : row)),
        );
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch {
        /* ignore */
      }
    },
    [user.id, user.role],
  );

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative inline-flex size-8 items-center justify-center border border-carbon-blue/15 bg-white text-carbon-blue transition-colors hover:border-upcycle-orange/40 hover:text-upcycle-orange"
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="size-4" strokeWidth={1.75} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center bg-upcycle-orange px-1 text-[9px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            aria-label="Close notifications"
            onClick={close}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="absolute right-0 z-50 mt-2 flex max-h-[min(28rem,70vh)] w-[min(22rem,calc(100vw-2rem))] flex-col border border-carbon-blue/15 bg-white shadow-lg"
          >
            <header className="flex items-center justify-between border-b border-carbon-blue/10 px-3 py-2.5">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  FS-015
                </p>
                <h2 id={titleId} className="text-[13px] font-semibold text-carbon-blue">
                  Notifications
                </h2>
              </div>
              <button
                type="button"
                onClick={close}
                className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45 hover:text-carbon-blue"
              >
                Close
              </button>
            </header>

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <p className="px-3 py-4 text-[12px] text-carbon-blue/50">Loading…</p>
              ) : error ? (
                <p className="px-3 py-4 text-[12px] text-thermal-red">{error}</p>
              ) : items.length === 0 ? (
                <p className="px-3 py-4 text-[12px] text-carbon-blue/50">
                  No alerts yet — when something needs attention, it lands here.
                </p>
              ) : (
                <ul className="divide-y divide-carbon-blue/8">
                  {items.map((item) => (
                    <li
                      key={item.id}
                      className={`px-3 py-2.5 ${item.read ? "bg-white" : "bg-upcycle-orange/[0.04]"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`inline-flex border px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider ${
                            TYPE_STYLES[item.type] ?? TYPE_STYLES.INFO
                          }`}
                        >
                          {item.type.replace("_", " ")}
                        </span>
                        <span className="text-[9px] text-carbon-blue/40">
                          {formatWhen(item.createdAt)}
                        </span>
                      </div>
                      <p className="mt-1 text-[12px] font-semibold text-carbon-blue">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-carbon-blue/65">
                        {item.message}
                      </p>
                      <div className="mt-2 flex items-center gap-2">
                        {item.link ? (
                          <Link
                            href={item.link}
                            onClick={() => {
                              void markRead(item.id);
                              close();
                            }}
                            className="text-[10px] font-semibold text-upcycle-orange hover:underline"
                          >
                            Open
                          </Link>
                        ) : null}
                        {!item.read ? (
                          <button
                            type="button"
                            onClick={() => void markRead(item.id)}
                            className="text-[10px] font-semibold text-carbon-blue/50 hover:text-carbon-blue"
                          >
                            Mark read
                          </button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
