"use client";

import {
  ASSISTED_CONFIGURATION,
  ASSISTED_EVERYTHING,
  SMARTCRM_PLATFORM_CONSTITUTION,
} from "@/lib/smart-assist-config";
import type { WorkspaceArchitectureLayer } from "@/types/assisted-configuration";

export function PlatformArchitecturePanel({
  layers,
}: {
  layers: WorkspaceArchitectureLayer[];
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-carbon-blue/10 bg-carbon-blue/[0.02] px-4 py-4 sm:px-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-upcycle-orange">
          {ASSISTED_EVERYTHING.title}
        </p>
        <p className="mt-2 text-[12px] leading-relaxed text-carbon-blue/65">
          {ASSISTED_EVERYTHING.mandate}
        </p>
        <p className="mt-3 text-sm font-medium text-carbon-blue">
          {SMARTCRM_PLATFORM_CONSTITUTION.platform}
        </p>
        <ul className="mt-3 space-y-2 text-[12px] leading-relaxed text-carbon-blue/65">
          <li>{SMARTCRM_PLATFORM_CONSTITUTION.userRole}</li>
          <li>{SMARTCRM_PLATFORM_CONSTITUTION.smartAssistRole}</li>
          <li>{SMARTCRM_PLATFORM_CONSTITUTION.platformRole}</li>
          <li>{SMARTCRM_PLATFORM_CONSTITUTION.evolution}</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2 border-t border-carbon-blue/8 pt-4">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            {ASSISTED_CONFIGURATION.customerManages}
          </span>
          <span className="text-carbon-blue/20">·</span>
          <span className="text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange/80">
            {ASSISTED_CONFIGURATION.smartAssistManages}
          </span>
        </div>
        <p className="mt-3 text-[11px] italic text-carbon-blue/45">
          {ASSISTED_EVERYTHING.division.system} {ASSISTED_EVERYTHING.division.user}{" "}
          {ASSISTED_EVERYTHING.mantra}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {layers.map((layer) => (
          <div
            key={layer.id}
            className={`border p-4 ${
              layer.healthy
                ? "border-carbon-blue/10 bg-white"
                : "border-upcycle-orange/25 bg-upcycle-orange/[0.03]"
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/50">
                {layer.label}
              </p>
              <span
                className={`text-[9px] font-bold uppercase tracking-wider ${
                  layer.healthy ? "text-carbon-blue/35" : "text-upcycle-orange"
                }`}
              >
                {layer.healthy ? "Maintained" : "Evolving"}
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-carbon-blue/70">{layer.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
