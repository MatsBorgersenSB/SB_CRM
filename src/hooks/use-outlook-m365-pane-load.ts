import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  resolveDevDisplayName,
  resolveOutlookSenderDetails,
  subscribeOutlookMailboxItemChanged,
} from "@/lib/m365/outlook-context";

export type OutlookPaneLoadState<T> =
  | { status: "loading" }
  | { status: "ready"; payload: T }
  | { status: "not-found" }
  | { status: "empty"; message: string }
  | { status: "auth-required"; message: string }
  | { status: "error"; message: string };

type UseOutlookM365PaneLoadOptions<T> = {
  apiPath: string;
  expectedKind: string;
  emptyMessage: string;
  errorMessage: string;
  unexpectedPayloadMessage: string;
};

/**
 * Loads an M365 payload for Outlook task panes after mount.
 * Email: ?email= query param first, then Office.js counterparty resolution.
 */
export function useOutlookM365PaneLoad<T extends { kind: string }>({
  apiPath,
  expectedKind,
  emptyMessage,
  errorMessage,
  unexpectedPayloadMessage,
}: UseOutlookM365PaneLoadOptions<T>) {
  const searchParams = useSearchParams();
  const emailParam = searchParams.get("email");
  const nameParam = searchParams.get("name");

  const [state, setState] = useState<OutlookPaneLoadState<T>>({ status: "loading" });
  const [resolvedEmail, setResolvedEmail] = useState<string | null>(null);
  const [resolvedDisplayName, setResolvedDisplayName] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const mountedRef = useRef(false);
  const requestIdRef = useRef(0);

  const reload = useCallback(() => {
    setReloadKey((current) => current + 1);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let timer: number | undefined;
    void subscribeOutlookMailboxItemChanged(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setReloadKey((current) => current + 1);
      }, 350);
    }).then((fn) => {
      unsubscribe = fn;
    });
    return () => {
      window.clearTimeout(timer);
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    const requestId = ++requestIdRef.current;

    const safeSetState = (next: OutlookPaneLoadState<T>) => {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setState(next);
    };

    const safeSetSender = (email: string | null, displayName: string | null) => {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setResolvedEmail(email);
      setResolvedDisplayName(displayName);
    };

    void (async () => {
      safeSetState({ status: "loading" });

      const devEmail = emailParam?.trim().toLowerCase() || null;
      const devName = resolveDevDisplayName(searchParams);

      let email = devEmail;
      let displayName = devName;

      if (!email) {
        const sender = await resolveOutlookSenderDetails();
        email = sender?.email ?? null;
        displayName = displayName ?? sender?.displayName ?? null;
      }

      // Outlook for Mac often populates To/Cc shortly after the pane opens.
      if (!email) {
        await new Promise((resolve) => window.setTimeout(resolve, 600));
        const retrySender = await resolveOutlookSenderDetails();
        email = retrySender?.email ?? null;
        displayName = displayName ?? retrySender?.displayName ?? null;
      }

      safeSetSender(email, displayName);

      if (!email) {
        safeSetState({ status: "empty", message: emptyMessage });
        return;
      }

      try {
        const response = await fetch(`${apiPath}?email=${encodeURIComponent(email)}`, {
          credentials: "include",
        });

        if (requestId !== requestIdRef.current || !mountedRef.current) return;

        if (response.status === 401 || response.status === 403) {
          safeSetState({
            status: "auth-required",
            message: "Sign in to SmartCRM to continue.",
          });
          return;
        }

        if (response.status === 404) {
          safeSetState({ status: "not-found" });
          return;
        }

        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
            code?: string;
          } | null;
          if (body?.code === "AUTH_REQUIRED") {
            safeSetState({
              status: "auth-required",
              message: body.error ?? "Sign in to SmartCRM to continue.",
            });
            return;
          }
          safeSetState({
            status: "error",
            message: body?.error ?? errorMessage,
          });
          return;
        }

        const payload = (await response.json()) as T;
        if (requestId !== requestIdRef.current || !mountedRef.current) return;

        if (payload.kind !== expectedKind) {
          safeSetState({ status: "error", message: unexpectedPayloadMessage });
          return;
        }

        safeSetState({ status: "ready", payload });
      } catch {
        safeSetState({ status: "error", message: errorMessage });
      }
    })();

    return () => {
      requestIdRef.current += 1;
    };
  }, [
    apiPath,
    emailParam,
    nameParam,
    emptyMessage,
    errorMessage,
    expectedKind,
    reloadKey,
    unexpectedPayloadMessage,
  ]);

  return { state, resolvedEmail, resolvedDisplayName, reload };
}
