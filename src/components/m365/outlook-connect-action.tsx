"use client";

/**
 * One Connect story for Outlook / Teams panes.
 * Session handoff and Graph consent stay separate under the hood — same button copy.
 */

import type { ReactNode } from "react";
import {
  OUTLOOK_CONNECT_BODY,
  OUTLOOK_CONNECT_HINT,
  OUTLOOK_CONNECT_TITLE,
  OUTLOOK_GRAPH_CONSENT_BODY,
} from "@/lib/m365/outlook-connect-copy";
import { openMicrosoftConsentDialog } from "@/lib/m365/outlook-smartcrm-category";

export {
  OUTLOOK_CONNECT_BODY,
  OUTLOOK_CONNECT_HINT,
  OUTLOOK_CONNECT_TITLE,
  OUTLOOK_GRAPH_CONSENT_BODY,
} from "@/lib/m365/outlook-connect-copy";

const PRIMARY_BTN =
  "inline-flex w-full items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-white transition-opacity hover:opacity-90";

const INLINE_BTN =
  "inline-flex items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-white hover:brightness-105";

/** Session Connect — caller wires openOutlookSignInDialog (avoids circular import). */
export function OutlookSessionConnectButton({
  onConnect,
  className = PRIMARY_BTN,
  label = OUTLOOK_CONNECT_TITLE,
}: {
  onConnect: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <button type="button" className={className} onClick={onConnect}>
      {label}
    </button>
  );
}

export function OutlookGraphConsentButton({
  onConnected,
  className = INLINE_BTN,
  label = OUTLOOK_CONNECT_TITLE,
}: {
  onConnected?: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        void openMicrosoftConsentDialog().then(() => onConnected?.());
      }}
    >
      {label}
    </button>
  );
}

/** Pane empty-state Connect card (session). */
export function OutlookConnectCard({
  onConnect,
  detail,
  verifying = false,
  children,
}: {
  onConnect: () => void;
  detail?: string;
  verifying?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="w-full max-w-sm border border-carbon-blue/10 bg-carbon-blue/[0.02] p-5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
        SmartCRM
      </p>
      <p className="mt-2 text-sm font-semibold text-carbon-blue">{OUTLOOK_CONNECT_TITLE}</p>
      <p className="mt-1 text-[12px] leading-relaxed text-carbon-blue/50">
        {detail?.trim() || OUTLOOK_CONNECT_BODY}
      </p>
      {verifying ? (
        <p className="mt-3 text-[11px] text-carbon-blue/60">Checking connection…</p>
      ) : null}
      <div className="mt-5">
        <OutlookSessionConnectButton onConnect={onConnect} />
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-carbon-blue/65">
        {OUTLOOK_CONNECT_HINT}
      </p>
      {children}
    </div>
  );
}

/** Inline Graph consent strip (mail mark / selection read). */
export function OutlookGraphConsentStrip({
  onConnected,
}: {
  onConnected?: () => void;
}) {
  return (
    <div className="mt-2 border border-upcycle-orange/30 bg-white px-2.5 py-2">
      <p className="text-[12px] leading-snug text-carbon-blue">{OUTLOOK_GRAPH_CONSENT_BODY}</p>
      <div className="mt-2">
        <OutlookGraphConsentButton onConnected={onConnected} />
      </div>
    </div>
  );
}
