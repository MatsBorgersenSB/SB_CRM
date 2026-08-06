"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type DebugSnapshot = {
  ok?: boolean;
  snapshot?: {
    urls?: Record<string, unknown>;
    secrets?: Record<string, unknown>;
    azure?: Record<string, unknown>;
    expectedCallbackUrl?: string;
    notes?: string[];
  };
  error?: string;
};

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const error = searchParams.get("error");
  const showDebug = searchParams.get("debug") === "1";
  const [pending, setPending] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugSnapshot | null>(null);
  const [clientLog, setClientLog] = useState<string[]>([]);

  const pushLog = (line: string) => {
    const entry = `${new Date().toISOString()} ${line}`;
    console.log("[SmartCRM AuthTrace:client]", entry);
    setClientLog((prev) => [...prev.slice(-40), entry]);
  };

  useEffect(() => {
    if (!showDebug) return;
    pushLog("signin.page.mounted");
    void fetch("/api/auth/debug")
      .then(async (res) => {
        pushLog(`debug.fetch status=${res.status}`);
        const json = (await res.json()) as DebugSnapshot;
        setDebugInfo(json);
      })
      .catch((err: unknown) => {
        pushLog(`debug.fetch failed: ${err instanceof Error ? err.message : String(err)}`);
        setDebugInfo({ error: err instanceof Error ? err.message : String(err) });
      });
  }, [showDebug]);

  useEffect(() => {
    if (error) pushLog(`signin.error.param=${error}`);
  }, [error]);

  const handleSignIn = async () => {
    setPending(true);
    pushLog(`signin.click provider=azure-ad callbackUrl=${callbackUrl}`);
    try {
      const result = await signIn("azure-ad", { callbackUrl, redirect: true });
      pushLog(`signin.returned ${JSON.stringify(result ?? null)}`);
    } catch (err) {
      pushLog(`signin.throw ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-carbon-blue text-white">
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 20% 0%, rgba(230,81,37,0.35), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 100%, rgba(255,255,255,0.06), transparent 50%)",
        }}
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <div>
          <p className="text-lg font-semibold tracking-tight">Standard Bio</p>
          <p className="mt-0.5 text-[11px] uppercase tracking-[0.18em] text-white/45">
            Upcycling carbon
          </p>
        </div>
        <p className="hidden text-[11px] text-white/40 sm:block">Microsoft 365 · Entra ID</p>
      </header>

      <main className="relative z-10 flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md border border-white/10 bg-white/[0.04] p-8 backdrop-blur-sm sm:p-10">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-upcycle-orange">
            SmartCRM
          </p>
          <h1 className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[28px]">
            Industrial Pyrolysis &amp; EPC Platform
          </h1>
          <p className="mt-3 text-[14px] leading-relaxed text-white/60">
            Sign in with your Standard Bio Microsoft 365 account to access relationship
            intelligence, opportunities, and project execution.
          </p>

          {error ? (
            <p
              className="mt-5 border border-thermal-red/40 bg-thermal-red/10 px-3 py-2 text-[12px] text-thermal-red"
              role="alert"
            >
              {error === "OAuthCallbackError"
                ? "Microsoft signed you in, but SmartCRM could not complete the session (OAuth callback failed). Retry once. If it persists, IT should verify AUTH_URL, Azure Web redirect URI (/api/auth/callback/azure-ad), and client secret in Vercel."
                : error === "Configuration"
                  ? "Sign-in is misconfigured (missing Azure AD credentials or AUTH_SECRET). Contact IT."
                  : `Sign-in failed (${error}). Contact IT if this continues.`}
            </p>
          ) : null}

          <button
            type="button"
            onClick={() => void handleSignIn()}
            disabled={pending}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 border border-upcycle-orange bg-upcycle-orange px-4 py-3 text-[13px] font-semibold text-white transition-colors hover:bg-upcycle-orange/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending
              ? "Redirecting to Microsoft…"
              : "🔑 Sign in with Microsoft 365 (Standard Bio Account)"}
          </button>

          {showDebug ? (
            <div className="mt-6 space-y-3 border border-white/15 bg-black/30 p-3 text-[11px] text-white/80">
              <p className="font-semibold text-upcycle-orange">Auth debug (no secrets)</p>
              <p>
                Server snapshot:{" "}
                <a className="underline" href="/api/auth/debug" target="_blank" rel="noreferrer">
                  /api/auth/debug
                </a>
              </p>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px] text-white/70">
                {debugInfo ? JSON.stringify(debugInfo, null, 2) : "Loading…"}
              </pre>
              <p className="font-semibold text-white/90">Client log</p>
              <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all text-[10px] text-white/70">
                {clientLog.join("\n") || "(empty)"}
              </pre>
              <p className="text-white/50">
                After sign-in, open Vercel → Deployment → Logs and filter{" "}
                <code>[SmartCRM AuthTrace]</code>
              </p>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-carbon-blue text-white/60">
          Loading sign-in…
        </div>
      }
    >
      <SignInContent />
    </Suspense>
  );
}
