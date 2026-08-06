"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

type DebugSnapshot = {
  ok?: boolean;
  snapshot?: Record<string, unknown>;
  error?: string;
};

function SignInContent() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const error = searchParams.get("error");
  const showDebug = searchParams.get("debug") === "1";
  const [debugInfo, setDebugInfo] = useState<DebugSnapshot | null>(null);

  const startHref = useMemo(() => {
    const params = new URLSearchParams({ callbackUrl });
    return `/api/azure-start?${params.toString()}`;
  }, [callbackUrl]);

  useEffect(() => {
    console.log("[SmartCRM AuthTrace:client]", "signin.page.mounted", { callbackUrl, startHref });
  }, [callbackUrl, startHref]);

  useEffect(() => {
    if (!showDebug) return;
    void fetch("/api/auth/debug")
      .then(async (res) => setDebugInfo((await res.json()) as DebugSnapshot))
      .catch((err: unknown) =>
        setDebugInfo({ error: err instanceof Error ? err.message : String(err) }),
      );
  }, [showDebug]);

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
                ? "Microsoft signed you in, but SmartCRM could not complete the session. Check Vercel logs for [SmartCRM AuthTrace]."
                : error === "OAuthSignin"
                  ? "Could not start Microsoft sign-in. Retry, or contact IT if this continues."
                  : error === "Configuration"
                    ? "Sign-in is misconfigured (missing Azure AD credentials or AUTH_SECRET). Contact IT."
                    : `Sign-in failed (${error}). Contact IT if this continues.`}
            </p>
          ) : null}

          {/* Plain navigation — no client fetch/JSON. Server issues Microsoft redirect. */}
          <a
            href={startHref}
            className="mt-8 inline-flex w-full items-center justify-center gap-2 border border-upcycle-orange bg-upcycle-orange px-4 py-3 text-center text-[13px] font-semibold text-white transition-colors hover:bg-upcycle-orange/90"
            onClick={() =>
              console.log("[SmartCRM AuthTrace:client]", "signin.link.click", startHref)
            }
          >
            🔑 Sign in with Microsoft 365 (Standard Bio Account)
          </a>

          <p className="mt-3 text-center text-[11px] text-white/40">
            You will be redirected to Microsoft to authenticate.
          </p>

          {showDebug ? (
            <div className="mt-6 space-y-3 border border-white/15 bg-black/30 p-3 text-[11px] text-white/80">
              <p className="font-semibold text-upcycle-orange">Auth debug</p>
              <p>
                Start URL: <code className="break-all">{startHref}</code>
              </p>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-[10px] text-white/70">
                {debugInfo ? JSON.stringify(debugInfo, null, 2) : "Loading…"}
              </pre>
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
