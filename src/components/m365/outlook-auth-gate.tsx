"use client";

import {
  Component,
  useCallback,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { whenOfficeReady } from "@/lib/outlook-office";
import { markOutlookPaneReady } from "@/lib/outlook-addin-shell";
import {
  isRetiredOutlookHost,
  resolvePublicAppOrigin,
  SMARTCRM_PRODUCTION_ORIGIN,
} from "@/lib/smartcrm-origin";

type GateState =
  | { status: "checking" }
  | { status: "authenticated" }
  | { status: "needs-sign-in" }
  | { status: "wrong-host"; host: string }
  | { status: "error"; message: string };

/** Abort hung session probes so the pane never sticks on "Connecting…". */
const SESSION_FETCH_TIMEOUT_MS = 1_500;
/** Absolute ceiling — always surface Sign In if still checking. */
const CHECKING_FALLBACK_MS = 1_500;
/** Do not block Sign In dialog on a long Office.onReady wait. */
const SIGN_IN_OFFICE_READY_MS = 1_500;

function appOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return resolvePublicAppOrigin();
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
 * Working Outlook Dialog SSO URL.
 * There is no `/login` route — `/auth/signin` + auth-complete bridge is required
 * for iframe-safe session handoff after Microsoft sign-in.
 */
export function buildOutlookSignInUrl(origin = appOrigin()): string {
  const completeUrl = `${origin}/outlook/auth-complete`;
  return `${origin}/auth/signin?callbackUrl=${encodeURIComponent(completeUrl)}`;
}

function openSignInInBrowser(signInUrl: string): void {
  try {
    const popup = window.open(signInUrl, "smartcrm-signin", "width=520,height=720");
    if (!popup) {
      window.open(signInUrl, "_blank", "noopener,noreferrer");
    }
  } catch {
    window.location.assign(signInUrl);
  }
}

/**
 * Opens SmartCRM SSO in an Office dialog (or a popup / new-tab fallback) so the
 * task pane can receive a session via dialog-bridge (iframe-safe).
 * Never throws — always falls back to a browser window.
 */
export async function openOutlookSignInDialog(onComplete: () => void): Promise<void> {
  const signInUrl = buildOutlookSignInUrl();

  try {
    const office = await whenOfficeReady(SIGN_IN_OFFICE_READY_MS);
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
            openSignInInBrowser(signInUrl);
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
  } catch {
    /* fall through to browser open */
  }

  const popup = window.open(signInUrl, "smartcrm-signin", "width=520,height=720");
  if (!popup) {
    window.open(signInUrl, "_blank", "noopener,noreferrer");
    return;
  }
  const timer = window.setInterval(() => {
    if (popup.closed) {
      window.clearInterval(timer);
      onComplete();
    }
  }, 800);
}

function SignInToSmartCrmCard({
  onSignedIn,
  verifying = false,
}: {
  onSignedIn: () => void;
  verifying?: boolean;
}) {
  const signInUrl = buildOutlookSignInUrl();

  return (
    <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
      <div className="w-full max-w-sm border border-carbon-blue/10 bg-carbon-blue/[0.02] p-5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
          SmartCRM
        </p>
        <p className="mt-2 text-sm font-semibold text-carbon-blue">Sign In to SmartCRM</p>
        <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">
          Relationship intelligence stays in SmartCRM. Sign in with your Microsoft work
          account — then this pane answers what matters and what to do next.
        </p>
        {verifying ? (
          <p className="mt-3 text-[10px] text-carbon-blue/40">Checking session…</p>
        ) : null}
        <button
          type="button"
          onClick={() => {
            void openOutlookSignInDialog(onSignedIn).catch(() => {
              openSignInInBrowser(signInUrl);
            });
          }}
          className="mt-5 inline-flex w-full items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
        >
          Sign In to SmartCRM
        </button>
        <a
          href={signInUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block text-center text-[10px] font-medium text-carbon-blue/60 underline-offset-2 hover:underline"
        >
          Open sign-in in browser
        </a>
      </div>
    </div>
  );
}

/**
 * Catches render errors in the Outlook task pane and always offers Sign In.
 */
export class OutlookAddinErrorBoundary extends Component<
  { children: ReactNode; onRetry?: () => void },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return {
      hasError: true,
      message: error?.message?.trim() || "Something went wrong in the Outlook pane.",
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[SmartCRM OutlookAddin]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SignInToSmartCrmCard
          onSignedIn={() => {
            this.setState({ hasError: false, message: "" });
            this.props.onRetry?.();
          }}
        />
      );
    }
    return this.props.children;
  }
}

/**
 * Ensures the Outlook task pane has a SmartCRM SSO session before loading
 * relationship / briefing intelligence.
 *
 * Office.onReady runs on mount (via whenOfficeReady) regardless of auth status.
 * Session probe uses /api/auth/session — any failure / timeout → needs-sign-in.
 * Never throws.
 */
export function OutlookAuthGate({ children }: { children: ReactNode }) {
  // Default to Sign In so SSR / failed hydration never leave a blank "Connecting…" pane.
  // Session probe upgrades to authenticated when a session exists.
  const [state, setState] = useState<GateState>({ status: "needs-sign-in" });
  const [probePending, setProbePending] = useState(true);

  const checkSession = useCallback(async (mode: "soft" | "hard" = "soft") => {
    if (mode === "hard") {
      setState({ status: "checking" });
    }
    setProbePending(true);

    try {
      if (typeof window !== "undefined" && isRetiredOutlookHost(window.location.host)) {
        setState({ status: "wrong-host", host: window.location.host });
        return;
      }

      const controller = new AbortController();
      const abortTimer = window.setTimeout(
        () => controller.abort(),
        SESSION_FETCH_TIMEOUT_MS,
      );

      let response: Response;
      try {
        response = await fetch("/api/auth/session", {
          credentials: "include",
          cache: "no-store",
          signal: controller.signal,
        });
      } finally {
        window.clearTimeout(abortTimer);
      }

      // Unauthenticated / forbidden / non-OK → friendly sign-in, never an unhandled error
      if (response.status === 401 || response.status === 403 || !response.ok) {
        setState({ status: "needs-sign-in" });
        return;
      }

      const raw = await response.text();
      type SessionProbe = { user?: { email?: string | null } | null };
      let session: SessionProbe | null = null;
      try {
        session = raw ? (JSON.parse(raw) as SessionProbe) : null;
      } catch {
        // HTML / non-JSON (e.g. unexpected middleware) → Sign In, never SyntaxError
        setState({ status: "needs-sign-in" });
        return;
      }

      if (session?.user?.email) {
        setState({ status: "authenticated" });
        return;
      }
      setState({ status: "needs-sign-in" });
    } catch {
      // Network / abort / parse failures: treat as signed out so the pane stays usable
      setState({ status: "needs-sign-in" });
    } finally {
      setProbePending(false);
    }
  }, []);

  // Office.onReady must run on mount regardless of authentication status
  useEffect(() => {
    markOutlookPaneReady();
    void whenOfficeReady().catch(() => null);
  }, []);

  useEffect(() => {
    void checkSession("soft");
  }, [checkSession]);

  // Hard timeout: never leave the user on "Connecting to SmartCRM…"
  useEffect(() => {
    if (state.status !== "checking") return;
    const timer = window.setTimeout(() => {
      setState((current) =>
        current.status === "checking" ? { status: "needs-sign-in" } : current,
      );
      setProbePending(false);
    }, CHECKING_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [state.status]);

  // Soft probe should also settle quickly even if fetch hangs past AbortController quirks
  useEffect(() => {
    if (!probePending || state.status !== "needs-sign-in") return;
    const timer = window.setTimeout(() => setProbePending(false), CHECKING_FALLBACK_MS);
    return () => window.clearTimeout(timer);
  }, [probePending, state.status]);

  if (state.status === "checking") {
    return (
      <div
        data-smartcrm-connecting=""
        className="flex h-[100dvh] items-center justify-center bg-white px-6"
      >
        <p className="text-[12px] text-carbon-blue/50">Connecting to SmartCRM…</p>
      </div>
    );
  }

  if (state.status === "wrong-host") {
    return (
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
          SmartCRM
        </p>
        <p className="mt-2 text-sm font-semibold text-carbon-blue">Wrong add-in host</p>
        <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">
          This task pane is loading from{" "}
          <span className="font-medium text-carbon-blue">{state.host}</span>, which is
          retired. Remove the old SmartCRM add-in, then sideload{" "}
          <span className="font-medium text-carbon-blue">
            outlook/relationship-card/manifest.xml
          </span>{" "}
          so SourceLocation is{" "}
          <span className="font-medium text-carbon-blue">{SMARTCRM_PRODUCTION_ORIGIN}</span>
          .
        </p>
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
          onClick={() => void checkSession("hard")}
          className="mt-4 border border-carbon-blue/15 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue"
        >
          Retry
        </button>
      </div>
    );
  }

  if (state.status === "needs-sign-in") {
    return (
      <SignInToSmartCrmCard
        onSignedIn={() => void checkSession("hard")}
        verifying={probePending}
      />
    );
  }

  return (
    <OutlookAddinErrorBoundary onRetry={() => void checkSession("hard")}>
      {children}
    </OutlookAddinErrorBoundary>
  );
}
