"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { whenOfficeReady } from "@/lib/outlook-office";

type GateState =
  | { status: "checking" }
  | { status: "authenticated" }
  | { status: "needs-sign-in" }
  | { status: "error"; message: string };

function appOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
}

async function claimBridgeToken(bridgeToken: string): Promise<boolean> {
  const response = await fetch("/api/outlook/dialog-bridge/claim", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ bridgeToken }),
    cache: "no-store",
  });
  return response.ok;
}

function parseDialogMessage(raw: string): {
  authenticated: boolean;
  bridgeToken?: string;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { authenticated: false };

  if (trimmed === "authenticated" || trimmed.includes("authenticated")) {
    try {
      const parsed = JSON.parse(trimmed) as {
        type?: string;
        bridgeToken?: string;
      };
      if (parsed?.type === "authenticated" || parsed?.bridgeToken) {
        return {
          authenticated: true,
          bridgeToken: parsed.bridgeToken,
        };
      }
    } catch {
      /* plain string from older dialog builds */
    }
    return { authenticated: true };
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      type?: string;
      bridgeToken?: string;
    };
    if (parsed?.type === "authenticated") {
      return { authenticated: true, bridgeToken: parsed.bridgeToken };
    }
  } catch {
    /* ignore */
  }

  return { authenticated: false };
}

/**
 * Opens SmartCRM SSO in an Office dialog (or a popup fallback) so the task
 * pane can receive a session via dialog-bridge (iframe-safe).
 */
async function openSignInDialog(onComplete: () => void): Promise<void> {
  const completeUrl = `${appOrigin()}/outlook/auth-complete`;
  const signInUrl = `${appOrigin()}/auth/signin?callbackUrl=${encodeURIComponent(completeUrl)}`;

  const office = await whenOfficeReady();
  const displayDialog = office?.context?.ui?.displayDialogAsync;

  if (typeof displayDialog === "function" && office) {
    displayDialog(
      signInUrl,
      {
        height: 70,
        width: 40,
        promptBeforeOpen: false,
        displayInIframe: false,
      },
      (result) => {
        if (result.status !== Office.AsyncResultStatus.Succeeded || !result.value) {
          window.open(signInUrl, "_blank", "noopener,noreferrer");
          return;
        }
        const dialog = result.value;
        let settled = false;

        const finish = async (bridgeToken?: string) => {
          if (settled) return;
          settled = true;
          try {
            if (bridgeToken) {
              await claimBridgeToken(bridgeToken);
            }
          } catch {
            /* checkSession will surface failure */
          }
          try {
            dialog.close();
          } catch {
            /* already closed */
          }
          onComplete();
        };

        dialog.addEventHandler(
          Office.EventType.DialogMessageReceived,
          (arg) => {
            const message =
              typeof arg === "object" && arg && "message" in arg
                ? String((arg as { message: string }).message)
                : typeof arg === "string"
                  ? arg
                  : "";
            const parsed = parseDialogMessage(message);
            if (parsed.authenticated) {
              void finish(parsed.bridgeToken);
            }
          },
        );
        dialog.addEventHandler(Office.EventType.DialogEventReceived, () => {
          void finish();
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
      const response = await fetch("/api/auth/session", {
        credentials: "include",
        cache: "no-store",
      });
      if (!response.ok) {
        setState({ status: "needs-sign-in" });
        return;
      }
      const session = (await response.json()) as {
        user?: { email?: string | null } | null;
      };
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
          onClick={() => void openSignInDialog(() => void checkSession())}
          className="mt-5 inline-flex items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
        >
          Sign in with Microsoft
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
