"use client";

import {
  Component,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { whenOfficeReady } from "@/lib/outlook-office";
import { markOutlookPaneReady } from "@/lib/outlook-addin-shell";
import {
  isUnsupportedOutlookHost,
  resolvePublicAppOrigin,
  SMARTCRM_PRODUCTION_HOST,
  SMARTCRM_PRODUCTION_ORIGIN,
} from "@/lib/smartcrm-origin";

type GateState =
  | { status: "checking" }
  | { status: "authenticated" }
  | { status: "needs-sign-in" }
  | { status: "wrong-host"; host: string }
  | { status: "error"; message: string };

/** Soft probe — keep Sign In reachable if the session endpoint hangs. */
const SESSION_FETCH_TIMEOUT_MS = 3_000;
/** After Office Dialog claim, allow a slightly longer first probe. */
const SESSION_FETCH_TIMEOUT_HARD_MS = 5_000;
/** Absolute ceiling — always surface Sign In if still checking. */
const CHECKING_FALLBACK_MS = 6_000;
/** Do not block Sign In dialog on a long Office.onReady wait. */
// Some environments load Office.js slowly; if this times out we fall back to a
// popup-based sign-in which cannot reliably bridge session cookies into the
// Outlook iframe (causes Sign In loops).
const SIGN_IN_OFFICE_READY_MS = 4_000;
/**
 * Office DialogEventReceived 12006 (closed) can race ahead of DialogMessageReceived.
 * Wait briefly so a late bridge token can still be claimed.
 */
// Extended to reduce the “Microsoft succeeded, but task pane never received
// the bridge token” failure mode (sign-in loop).
const DIALOG_CLOSE_GRACE_MS = 2_500;
/** Dialog closed by user / host. */
const OFFICE_DIALOG_CLOSED = 12006;
/** User dismissed the dialog open prompt. */
const OFFICE_DIALOG_IGNORED = 12009;

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

function dialogEventErrorCode(arg: unknown): number | null {
  if (typeof arg === "object" && arg && "error" in arg) {
    const code = Number((arg as { error: number }).error);
    return Number.isFinite(code) ? code : null;
  }
  return null;
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

function traceLine(label: string, detail?: string): string {
  const timestamp = new Date().toISOString().slice(11, 23);
  return detail ? `${timestamp} ${label}: ${detail}` : `${timestamp} ${label}`;
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
export async function openOutlookSignInDialog(
  onComplete: () => void,
  onTrace?: (line: string) => void,
): Promise<void> {
  const signInUrl = buildOutlookSignInUrl();
  onTrace?.(traceLine("dialog.start", signInUrl));

  try {
    const office = await whenOfficeReady(SIGN_IN_OFFICE_READY_MS);
    onTrace?.(traceLine("office.ready", office ? "ok" : "timeout/null"));
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
            onTrace?.(
              traceLine(
                "dialog.open.failed",
                typeof result.status === "string" ? result.status : String(result.status),
              ),
            );
            openSignInInBrowser(signInUrl);
            return;
          }
          onTrace?.(traceLine("dialog.open.ok"));
          const dialog = result.value;
          let settled = false;
          let receivedBridgeToken: string | undefined;
          let closeTimer: number | undefined;

          const finish = async (bridgeToken?: string) => {
            if (settled) return;
            settled = true;
            if (closeTimer !== undefined) {
              window.clearTimeout(closeTimer);
              closeTimer = undefined;
            }
            const token = bridgeToken?.trim() || receivedBridgeToken?.trim() || "";
            try {
              if (token) {
                onTrace?.(traceLine("bridge.claim.start"));
                const claimed = await claimBridgeToken(token);
                onTrace?.(traceLine("bridge.claim.done", claimed ? "ok" : "failed"));
              } else {
                onTrace?.(traceLine("bridge.claim.skip", "missing token"));
              }
            } catch {
              onTrace?.(traceLine("bridge.claim.error"));
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
              if (!parsed.authenticated) return;
              if (parsed.bridgeToken?.trim()) {
                receivedBridgeToken = parsed.bridgeToken.trim();
                onTrace?.(traceLine("dialog.message.token", "received"));
              } else {
                onTrace?.(traceLine("dialog.message.auth", "no token"));
              }
              void finish(parsed.bridgeToken);
            },
          );

          /**
           * Do NOT finish on every DialogEventReceived — OAuth redirects inside
           * the dialog can emit 12002/other codes before auth-complete runs.
           * Finishing early without a bridge token is the colleague sign-in loop:
           * Microsoft succeeds, task pane never claims a session, Sign In returns.
           */
          dialog.addEventHandler(Office.EventType.DialogEventReceived, (arg) => {
            const code = dialogEventErrorCode(arg);
            onTrace?.(traceLine("dialog.event", code == null ? "unknown" : String(code)));
            if (code !== OFFICE_DIALOG_CLOSED && code !== OFFICE_DIALOG_IGNORED) {
              return;
            }
            if (settled) return;
            if (closeTimer !== undefined) return;
            closeTimer = window.setTimeout(() => {
              void finish(receivedBridgeToken);
            }, DIALOG_CLOSE_GRACE_MS);
          });
        },
      );
      return;
    }
  } catch {
    onTrace?.(traceLine("dialog.exception"));
    /* fall through to browser open */
  }

  onTrace?.(traceLine("dialog.fallback.popup"));
  const popup = window.open(signInUrl, "smartcrm-signin", "width=520,height=720");
  if (!popup) {
    onTrace?.(traceLine("dialog.fallback.new-tab"));
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
  onTrace,
  verifying = false,
  traceLines = [],
}: {
  onSignedIn: () => void;
  onTrace?: (line: string) => void;
  verifying?: boolean;
  traceLines?: string[];
}) {
  const signInUrl = buildOutlookSignInUrl();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const traceText = useMemo(() => traceLines.join("\n"), [traceLines]);

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
            void openOutlookSignInDialog(onSignedIn, onTrace).catch(() => {
              openSignInInBrowser(signInUrl);
            });
          }}
          className="mt-5 inline-flex w-full items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90"
        >
          Sign In to SmartCRM
        </button>
        <p className="mt-3 text-[10px] leading-relaxed text-carbon-blue/45">
          Use the button above inside Outlook. Opening sign-in in a separate browser tab
          cannot pass the session into this pane.
        </p>
        {traceLines.length > 0 ? (
          <div className="mt-3 border border-carbon-blue/10 bg-white/60 p-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/50">
                Temporary auth trace
              </p>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard
                    .writeText(traceText)
                    .then(() => {
                      setCopyState("copied");
                    })
                    .catch(() => {
                      setCopyState("failed");
                    });
                }}
                className="text-[9px] font-semibold uppercase tracking-wider text-upcycle-orange"
              >
                {copyState === "copied"
                  ? "Copied"
                  : copyState === "failed"
                    ? "Copy failed"
                    : "Copy trace"}
              </button>
            </div>
            <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap text-[9px] leading-relaxed text-carbon-blue/55">
              {traceText}
            </pre>
          </div>
        ) : null}
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
  const [traceLines, setTraceLines] = useState<string[]>([]);
  const pushTrace = useCallback((line: string) => {
    setTraceLines((current) => {
      const next = [...current, line];
      return next.length > 60 ? next.slice(next.length - 60) : next;
    });
  }, []);

  const checkSession = useCallback(async (mode: "soft" | "hard" = "soft") => {
    pushTrace(traceLine("session.check.start", mode));
    if (mode === "hard") {
      setState({ status: "checking" });
    }
    setProbePending(true);

    const timeoutMs =
      mode === "hard" ? SESSION_FETCH_TIMEOUT_HARD_MS : SESSION_FETCH_TIMEOUT_MS;
    const attempts = mode === "hard" ? 3 : 1;

    try {
      if (typeof window !== "undefined" && isUnsupportedOutlookHost(window.location.host)) {
        pushTrace(traceLine("session.host.unsupported", window.location.host));
        setState({ status: "wrong-host", host: window.location.host });
        return;
      }

      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const controller = new AbortController();
        const abortTimer = window.setTimeout(() => controller.abort(), timeoutMs);

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

        // Unauthenticated / forbidden / non-OK → retry on hard, else Sign In
        if (response.status === 401 || response.status === 403 || !response.ok) {
          pushTrace(traceLine("session.http", String(response.status)));
          if (attempt < attempts - 1) {
            await new Promise((resolve) => window.setTimeout(resolve, 350 * (attempt + 1)));
            continue;
          }
          setState({ status: "needs-sign-in" });
          return;
        }

        const raw = await response.text();
        type SessionProbe = { user?: { email?: string | null } | null };
        let session: SessionProbe | null = null;
        try {
          session = raw ? (JSON.parse(raw) as SessionProbe) : null;
        } catch {
          if (attempt < attempts - 1) {
            await new Promise((resolve) => window.setTimeout(resolve, 350 * (attempt + 1)));
            continue;
          }
          // HTML / non-JSON (e.g. unexpected middleware) → Sign In, never SyntaxError
          setState({ status: "needs-sign-in" });
          return;
        }

        if (session?.user?.email) {
          pushTrace(traceLine("session.ok", session.user.email ?? "user"));
          setState({ status: "authenticated" });
          return;
        }

        if (attempt < attempts - 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 350 * (attempt + 1)));
          continue;
        }
        setState({ status: "needs-sign-in" });
        pushTrace(traceLine("session.empty"));
        return;
      }
    } catch {
      pushTrace(traceLine("session.error"));
      // Network / abort / parse failures: treat as signed out so the pane stays usable
      setState({ status: "needs-sign-in" });
    } finally {
      setProbePending(false);
    }
  }, [pushTrace]);

  // Office.onReady must run on mount regardless of authentication status
  useEffect(() => {
    if (typeof window !== "undefined") {
      pushTrace(traceLine("pane.host", window.location.host));
      pushTrace(traceLine("signin.url", buildOutlookSignInUrl()));
    }
    markOutlookPaneReady();
    void whenOfficeReady().catch(() => null);
  }, [pushTrace]);

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
          not supported for Outlook sign-in. Remove older/preview add-ins, then
          sideload{" "}
          <span className="font-medium text-carbon-blue">
            outlook/relationship-card/manifest.xml
          </span>{" "}
          so SourceLocation host is{" "}
          <span className="font-medium text-carbon-blue">{SMARTCRM_PRODUCTION_HOST}</span>{" "}
          and origin is{" "}
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
        onTrace={pushTrace}
        verifying={probePending}
        traceLines={traceLines}
      />
    );
  }

  return (
    <OutlookAddinErrorBoundary onRetry={() => void checkSession("hard")}>
      {children}
    </OutlookAddinErrorBoundary>
  );
}
