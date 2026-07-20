"use client";

import { Lightbulb, Plus } from "lucide-react";
import type { SuggestedActivity } from "@/lib/activity-workspace";

const SEVERITY_DOT: Record<SuggestedActivity["severity"], string> = {
  urgent: "bg-red-500",
  needs_attention: "bg-upcycle-orange",
  waiting: "bg-amber-400",
  healthy: "bg-emerald-500",
  completed: "bg-carbon-blue/30",
};

const ACTION_BUTTON_LABEL: Record<SuggestedActivity["assistantKind"], string> = {
  email: "Draft",
  call: "Call",
  meeting: "Meet",
  activity: "Plan",
};

export function ActivitySuggestedPanel({
  suggestions,
  onExecuteSuggestion,
}: {
  suggestions: SuggestedActivity[];
  onExecuteSuggestion: (suggestion: SuggestedActivity) => void;
}) {
  if (suggestions.length === 0) return null;

  return (
    <section className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Lightbulb className="size-3.5 text-upcycle-orange" strokeWidth={2} />
        <h3 className="text-[10px] font-bold uppercase tracking-[0.14em] text-carbon-blue/50">
          SmartAssist Recommendations
        </h3>
      </div>
      <ul className="space-y-2">
        {suggestions.map((suggestion) => (
          <li
            key={suggestion.id}
            className="flex items-start justify-between gap-3 border border-carbon-blue/8 bg-white p-3"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`size-1.5 shrink-0 rounded-full ${SEVERITY_DOT[suggestion.severity]}`}
                  aria-hidden
                />
                <p className="text-xs font-semibold text-carbon-blue">{suggestion.label}</p>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/55">
                {suggestion.reason}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onExecuteSuggestion(suggestion)}
              className="inline-flex shrink-0 items-center gap-1 border border-upcycle-orange/25 bg-upcycle-orange/10 px-2 py-1 text-[10px] font-semibold text-upcycle-orange transition-colors hover:bg-upcycle-orange/15"
            >
              <Plus className="size-3" strokeWidth={2.5} />
              {ACTION_BUTTON_LABEL[suggestion.assistantKind]}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
