"use client";

import { ASSISTED_EVERYTHING } from "@/lib/smart-assist-config";

export function AssistedEverythingPanel({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="border border-upcycle-orange/20 bg-upcycle-orange/[0.04] px-4 py-3">
        <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-upcycle-orange">
          {ASSISTED_EVERYTHING.title}
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-carbon-blue/70">
          {ASSISTED_EVERYTHING.mandate}
        </p>
        <p className="mt-2 text-[11px] font-medium italic text-carbon-blue/55">
          {ASSISTED_EVERYTHING.mantra}
        </p>
      </div>
    );
  }

  return (
    <div className="dashboard-card overflow-hidden">
      <div className="border-b border-carbon-blue/8 px-4 py-4 sm:px-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-upcycle-orange">
          SmartAssist · {ASSISTED_EVERYTHING.title}
        </p>
        <p className="mt-2 text-sm font-medium leading-relaxed text-carbon-blue">
          {ASSISTED_EVERYTHING.mandate}
        </p>
      </div>

      <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 sm:px-5">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/40">
            Assisted decisions
          </p>
          <ul className="mt-2 space-y-1">
            {ASSISTED_EVERYTHING.assistedDomains.map((domain) => (
              <li key={domain} className="text-[12px] text-carbon-blue/70">
                {domain}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/40">
              For users
            </p>
            <p className="mt-1 text-[12px] text-carbon-blue/70">{ASSISTED_EVERYTHING.userRequirement}</p>
            <p className="mt-1 text-[12px] text-carbon-blue/70">{ASSISTED_EVERYTHING.usability}</p>
            <p className="mt-1 text-[12px] font-medium text-carbon-blue">
              {ASSISTED_EVERYTHING.division.user}
            </p>
          </div>
          <div>
            <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/40">
              For SmartAssist
            </p>
            <p className="mt-1 text-[12px] text-carbon-blue/70">{ASSISTED_EVERYTHING.smartAssistRole}</p>
            <p className="mt-1 text-[12px] font-medium text-carbon-blue">
              {ASSISTED_EVERYTHING.division.system}
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-carbon-blue/8 bg-carbon-blue/[0.02] px-4 py-3 sm:px-5">
        <p className="text-[11px] font-medium italic text-upcycle-orange">
          {ASSISTED_EVERYTHING.mantra}
        </p>
      </div>
    </div>
  );
}
