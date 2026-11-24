"use client";

import type { ReactNode } from "react";

/**
 * Impossible-to-miss teammate strip on a living record.
 * Primary = Ask. Secondary = Give to / Also show to.
 */
export function TeamWorkStrip({
  ask,
  extras,
}: {
  /** Big orange Ask control — required. */
  ask: ReactNode;
  /** Give to / Also show to — secondary. */
  extras?: ReactNode;
}) {
  return (
    <div className="border-2 border-upcycle-orange/50 bg-upcycle-orange/[0.08] px-4 py-4">
      <p className="text-[15px] font-semibold text-carbon-blue">Need help from a teammate?</p>
      <p className="mt-1 text-[13px] text-carbon-blue/65">
        Press the orange button. Pick who. Say what you need. They get a ping.
      </p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="shrink-0">{ask}</div>
        {extras ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-upcycle-orange/20 pt-3 sm:border-l sm:border-t-0 sm:pl-3 sm:pt-0">
            <span className="w-full text-[11px] font-medium text-carbon-blue/45 sm:w-auto">
              Or hand work over:
            </span>
            {extras}
          </div>
        ) : null}
      </div>
    </div>
  );
}
