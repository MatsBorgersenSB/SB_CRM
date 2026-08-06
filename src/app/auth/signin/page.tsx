import Link from "next/link";

export const dynamic = "force-dynamic";

type SignInPageProps = {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
};

function errorMessage(error: string | undefined): string | null {
  if (!error) return null;
  if (error === "OAuthCallbackError") {
    return "Microsoft signed you in, but SmartCRM could not complete the session. Check Vercel logs for [SmartCRM AuthTrace].";
  }
  if (error === "OAuthSignin") {
    return "Could not start Microsoft sign-in. Retry, or contact IT if this continues.";
  }
  if (error === "Configuration") {
    return "Sign-in is misconfigured (missing Azure AD credentials or AUTH_SECRET). Contact IT.";
  }
  return `Sign-in failed (${error}). Contact IT if this continues.`;
}

/**
 * Server-rendered sign-in — plain <a href> to /api/azure-start.
 * No client fetch/JSON, so SessionProvider SyntaxErrors cannot block Microsoft redirect.
 */
export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl?.trim() || "/";
  const error = params.error;
  const startHref = `/api/azure-start?${new URLSearchParams({ callbackUrl }).toString()}`;
  const message = errorMessage(error);

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

          {message ? (
            <p
              className="mt-5 border border-thermal-red/40 bg-thermal-red/10 px-3 py-2 text-[12px] text-thermal-red"
              role="alert"
            >
              {message}
            </p>
          ) : null}

          <p className="mt-5 border border-white/15 bg-white/[0.03] px-3 py-2 text-[11px] text-white/55">
            Use this page only: <code className="text-white/80">/auth/signin</code>
            <br />
            Not <code className="text-white/40">/api/auth/signin</code> (that path causes CORS
            errors).
          </p>

          {/* Plain <a> — full browser navigation, never fetch/XHR */}
          <a
            href={startHref}
            data-testid="azure-signin-link"
            className="mt-8 inline-flex w-full items-center justify-center gap-2 border border-upcycle-orange bg-upcycle-orange px-4 py-3 text-center text-[13px] font-semibold text-white transition-colors hover:bg-upcycle-orange/90"
          >
            Sign in with Microsoft 365 (Standard Bio Account)
          </a>

          <p className="mt-3 text-center text-[11px] text-white/40">
            You will be redirected to Microsoft to authenticate.
          </p>

          <p className="mt-6 break-all text-center text-[10px] text-white/30">
            Start URL: {startHref}
          </p>

          <p className="mt-2 text-center text-[10px] text-white/25">
            If the button does nothing, open{" "}
            <Link href={startHref} className="underline">
              this Microsoft start link
            </Link>{" "}
            directly.
          </p>
        </div>
      </main>
    </div>
  );
}
