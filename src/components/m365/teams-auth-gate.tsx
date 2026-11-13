"use client";

import { useEffect, useState, type ReactNode } from "react";
import { OutlookConnectCard } from "@/components/m365/outlook-connect-action";
import { openOutlookSignInDialog } from "@/components/m365/outlook-auth-gate";
import { ensureTeamsSmartCrmSession } from "@/lib/m365/teams-sso";

type GateState =
  | { status: "checking" }
  | { status: "authenticated" }
  | { status: "needs-sign-in" };

/**
 * Teams surfaces: try silent SSO first. Connect is emergency-only.
 */
export function TeamsAuthGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>({ status: "checking" });

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await ensureTeamsSmartCrmSession({ allowInteractive: false });
      if (!cancelled) {
        setState({
          status: result === "authenticated" ? "authenticated" : "needs-sign-in",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === "checking") {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-white px-6">
        <p className="text-[13px] text-carbon-blue/50">Connecting to SmartCRM…</p>
      </div>
    );
  }

  if (state.status === "needs-sign-in") {
    return (
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <OutlookConnectCard
          detail="Could not connect quietly from Teams. Connect once — then this pane stays with you."
          onConnect={() => {
            void (async () => {
              setState({ status: "checking" });
              const silentRetry = await ensureTeamsSmartCrmSession({
                allowInteractive: true,
              });
              if (silentRetry === "authenticated") {
                setState({ status: "authenticated" });
                return;
              }
              await openOutlookSignInDialog(() => {
                window.location.reload();
              });
            })();
          }}
        />
      </div>
    );
  }

  return <>{children}</>;
}
