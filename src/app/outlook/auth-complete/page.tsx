"use client";

import { useEffect, useState } from "react";
import { messageParentSafe } from "@/lib/outlook-office";

type CompleteState =
  | { status: "working" }
  | { status: "done" }
  | { status: "error"; message: string };

/**
 * Office Dialog landing page after SmartCRM SSO.
 * 1) Confirm dialog session cookies
 * 2) Mint bridge token (task-pane iframe cannot read dialog cookies)
 * 3) messageParent only after Office.onReady
 */
export default function OutlookAuthCompletePage() {
  const [state, setState] = useState<CompleteState>({ status: "working" });

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const sessionRes = await fetch("/api/auth/session", {
          credentials: "include",
          cache: "no-store",
        });
        const session = (await sessionRes.json().catch(() => null)) as {
          user?: { email?: string | null } | null;
        } | null;

        if (!session?.user?.email) {
          if (!cancelled) {
            setState({
              status: "error",
              message:
                "Microsoft signed you in, but this dialog has no SmartCRM session cookie. Close and try Sign in again.",
            });
          }
          return;
        }

        const bridgeRes = await fetch("/api/outlook/dialog-bridge", {
          method: "POST",
          credentials: "include",
          cache: "no-store",
        });
        const bridgeBody = (await bridgeRes.json().catch(() => null)) as {
          bridgeToken?: string;
          error?: string;
        } | null;

        if (!bridgeRes.ok || !bridgeBody?.bridgeToken) {
          if (!cancelled) {
            setState({
              status: "error",
              message:
                bridgeBody?.error ||
                "Could not create a session bridge for the Outlook task pane.",
            });
          }
          return;
        }

        const payload = JSON.stringify({
          type: "authenticated",
          bridgeToken: bridgeBody.bridgeToken,
        });

        const sent = await messageParentSafe(payload);
        if (!cancelled) {
          setState({ status: "done" });
        }

        window.setTimeout(() => {
          try {
            window.close();
          } catch {
            /* Office Dialog may ignore window.close; parent closes via dialog.close() */
          }
        }, sent ? 400 : 1200);
      } catch (error) {
        if (!cancelled) {
          setState({
            status: "error",
            message:
              error instanceof Error
                ? error.message
                : "Could not finish Outlook sign-in.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center bg-white px-6 text-center">
      <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
        SmartCRM
      </p>
      {state.status === "working" ? (
        <>
          <h1 className="mt-2 text-base font-semibold text-carbon-blue">
            Finishing sign-in…
          </h1>
          <p className="mt-1 max-w-sm text-[12px] text-carbon-blue/50">
            Returning you to the Outlook task pane.
          </p>
        </>
      ) : null}
      {state.status === "done" ? (
        <>
          <h1 className="mt-2 text-base font-semibold text-carbon-blue">
            You&apos;re signed in
          </h1>
          <p className="mt-1 max-w-sm text-[12px] text-carbon-blue/50">
            You can close this window and return to Outlook.
          </p>
        </>
      ) : null}
      {state.status === "error" ? (
        <>
          <h1 className="mt-2 text-base font-semibold text-carbon-blue">
            Sign-in incomplete
          </h1>
          <p className="mt-1 max-w-sm text-[12px] text-carbon-blue/50">{state.message}</p>
          <a
            href={`/auth/signin?callbackUrl=${encodeURIComponent("/outlook/auth-complete")}`}
            className="mt-4 border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white"
          >
            Try again
          </a>
        </>
      ) : null}
    </main>
  );
}
