"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  IntentTrigger,
  IntentTriggerUrgency,
} from "@/lib/marketing/intent-radar";

const URGENCY_STYLES: Record<IntentTriggerUrgency, string> = {
  HIGH: "border-thermal-red/30 bg-thermal-red/5 text-thermal-red",
  MEDIUM: "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange",
};

type IntentRadarBannerProps = {
  companyId: string;
  companyName?: string;
  className?: string;
  maxItems?: number;
};

export function IntentRadarBanner({
  companyId,
  companyName,
  className = "",
  maxItems = 4,
}: IntentRadarBannerProps) {
  const [triggers, setTriggers] = useState<IntentTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/marketing/intent-triggers?companyId=${encodeURIComponent(companyId)}`,
      );
      const body = (await response.json()) as {
        triggers?: IntentTrigger[];
        error?: string;
      };
      if (!response.ok) {
        setError(body.error ?? "Could not load intent triggers");
        setTriggers([]);
        return;
      }
      setTriggers(body.triggers ?? []);
    } catch {
      setError("Intent radar unavailable");
      setTriggers([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || (!error && triggers.length === 0)) {
    return null;
  }

  const visible = triggers.slice(0, maxItems);

  return (
    <section
      className={`border border-carbon-blue/10 bg-[var(--dashboard-surface)] ${className}`}
      aria-label="Intent trigger radar"
    >
      <div className="flex items-center justify-between border-b border-carbon-blue/8 px-4 py-2.5">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Intent Trigger Radar
          </p>
          <p className="text-[12px] font-semibold text-carbon-blue">
            {companyName
              ? `Buying signals for ${companyName}`
              : `${visible.length} active trigger${visible.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45 hover:text-upcycle-orange"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="px-4 py-3 text-[11px] text-thermal-red">{error}</p>
      ) : (
        <ul className="divide-y divide-carbon-blue/8">
          {visible.map((trigger) => (
            <li key={trigger.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${URGENCY_STYLES[trigger.urgency]}`}
                >
                  {trigger.urgency}
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  {trigger.type.replace(/_/g, " ")}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] font-semibold text-carbon-blue">
                {trigger.title}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/60">
                {trigger.description}
              </p>
              <p className="mt-2 text-[11px] leading-relaxed text-carbon-blue/70">
                <span className="font-semibold text-carbon-blue/50">Next: </span>
                {trigger.recommendedAction}
              </p>
              {trigger.outreach?.href || trigger.outreach?.mailtoHref ? (
                <div className="mt-3">
                  <a
                    href={trigger.outreach.href ?? trigger.outreach.mailtoHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex border border-upcycle-orange/30 bg-upcycle-orange/10 px-2.5 py-1 text-[11px] font-semibold text-upcycle-orange hover:bg-upcycle-orange/15"
                  >
                    Generate Intent Outreach
                  </a>
                </div>
              ) : trigger.outreach ? (
                <p className="mt-2 text-[10px] text-carbon-blue/40">
                  Add a contact email to enable 1-click outreach.
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
