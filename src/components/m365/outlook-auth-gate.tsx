"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

type GateState =
  | { status: "checking" }
  | { status: "authenticated" }
  | { status: "needs-sign-in" }
  | { status: "error"; message: string };

function appOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
}

/**
 * Opens SmartCRM SSO in an Office dialog (or a popup fallback) so the task
 * pane can receive first-party session cookies after Microsoft login.
 */
function openSignInDialog(onComplete: () => void): void {
  const completeUrl = `${appOrigin()}/outlook/auth-complete`;
  const signInUrl = `${appOrigin()}/auth/signin?callbackUrl=${encodeURIComponent(completeUrl)}`;

  const office = typeof Office !== "undefined" ? Office : undefined;
  const displayDialog = office?.context?.ui?.displayDialogAsync;

  if (typeof displayDialog === "function") {
    displayDialog(
      signInUrl,
      { height: 70, width: 40, promptBeforeOpen: false },
      (result) => {
        if (result.status !== Office.AsyncResultStatus.Succeeded || !result.value) {
          window.open(signInUrl, "_blank", "noopener,noreferrer");
          return;
        }
        const dialog = result.value;
        dialog.addEventHandler(
          Office.EventType.DialogMessageReceived,
          (arg) => {
            const message =
              typeof arg === "object" && arg && "message" in arg
                ? String((arg as { message: string }).message)
                : "";
            if (message === "authenticated" || message.includes("authenticated")) {
              dialog.close();
              onComplete();
            }
          },
        );
        dialog.addEventHandler(Office.EventType.DialogEventReceived, () => {
          onComplete();
        });
      },
    );
    return;
  }

  const popup = window.open(signInUrl, "smartcrm-signin", "width=520,height=720");
  if (!popup) {
    window.location.href = signInUrl;
    return;
  }
  const timer = window.setInterval(() => {
    if (popup.closed) {
      window.clearInterval(timer);
      onComplete();
    }
  }, 800);
}

/**
 * Ensures the Outlook task pane has a SmartCRM SSO session before loading
 * relationship / briefing intelligence.
 */
export function OutlookAuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ status: "checking" });

  const checkSession = useCallback(async () => {
    setState({ status: "checking" });
    try {
      const response = await fetch("/api/auth/session", { credentials: "include" });
      if (!response.ok) {
        setState({ status: "needs-sign-in" });
        return;
      }
      const session = (await response.json()) as { user?: { email?: string | null } | null };
      if (session?.user?.email) {
        setState({ status: "authenticated" });
        return;
      }
      setState({ status: "needs-sign-in" });
    } catch {
      setState({ status: "error", message: "Unable to verify SmartCRM session." });
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  if (state.status === "checking") {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-white px-6">
        <p className="text-[12px] text-carbon-blue/50">Connecting to SmartCRM…</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
          SmartCRM
        </p>
        <p className="mt-2 text-sm font-semibold text-carbon-blue">Session check failed</p>
        <p className="mt-1 text-[11px] text-carbon-blue/50">{state.message}</p>
        <button
          type="button"
          onClick={() => void checkSession()}
          className="mt-4 border border-carbon-blue/15 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue"
        >
          Retry
        </button>
      </div>
    );
  }

  if (state.status === "needs-sign-in") {
    return (
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
          SmartCRM
        </p>
        <p className="mt-2 text-sm font-semibold text-carbon-blue">Sign in to continue</p>
        <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">
          Relationship intelligence stays in SmartCRM. Sign in with your Microsoft work
          account — then this pane answers what matters and what to do next.
        </p>
        <button
          type="button"
          onClick={() => openSignInDialog(() => void checkSession())}
          className="mt-5 inline-flex items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
        >
          Sign in with Microsoft
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
