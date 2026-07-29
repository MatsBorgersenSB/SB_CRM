"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import type {
  Nudge,
  NudgeActionType,
  NudgeSeverity,
} from "@/lib/assistant/nudge-engine";
import { company360Href } from "@/types/company-360";

const SEVERITY_STYLES: Record<NudgeSeverity, string> = {
  HIGH: "border-thermal-red/30 bg-thermal-red/5 text-thermal-red",
  MEDIUM: "border-upcycle-orange/30 bg-upcycle-orange/5 text-upcycle-orange",
  LOW: "border-carbon-blue/20 bg-carbon-blue/[0.03] text-carbon-blue/70",
};

const PRIMARY_ACTION_TYPES = new Set<NudgeActionType>([
  "DRAFT_OUTREACH_EMAIL",
  "ADD_ECONOMIC_BUYER",
]);

type NudgeBannerProps = {
  /** When set, load nudges for this company. Omit for portfolio overview. */
  companyId?: string;
  companyName?: string;
  /** Cap how many nudges are shown. */
  maxItems?: number;
  className?: string;
};

function actionButtonClass(actionType: NudgeActionType): string {
  return PRIMARY_ACTION_TYPES.has(actionType)
    ? "border border-upcycle-orange/30 bg-upcycle-orange/10 px-2.5 py-1 text-[11px] font-semibold text-upcycle-orange hover:bg-upcycle-orange/15"
    : "border border-carbon-blue/15 bg-carbon-blue/[0.03] px-2.5 py-1 text-[11px] font-semibold text-carbon-blue/75 hover:border-carbon-blue/25";
}

export function NudgeBanner({
  companyId,
  companyName,
  maxItems = 4,
  className = "",
}: NudgeBannerProps) {
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query = companyId
        ? `companyId=${encodeURIComponent(companyId)}`
        : "limit=8";
      const response = await fetch(`/api/assistant/nudges?${query}`);
      const body = (await response.json()) as {
        nudges?: Nudge[];
        error?: string;
      };
      if (!response.ok) {
        setNudges([]);
        return;
      }
      setNudges(body.nudges ?? []);
    } catch {
      setNudges([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const visible = nudges
    .filter((nudge) => !dismissed.has(nudge.id))
    .slice(0, maxItems);

  if (loading || visible.length === 0) {
    return null;
  }

  return (
    <section
      className={`border border-carbon-blue/10 bg-[var(--dashboard-surface)] ${className}`}
      aria-label="Proactive nudges"
    >
      <div className="flex items-center justify-between border-b border-carbon-blue/8 px-4 py-2.5">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            What deserves attention
          </p>
          <p className="text-[12px] font-semibold text-carbon-blue">
            {companyName
              ? `Nudges for ${companyName}`
              : `${visible.length} account nudge${visible.length === 1 ? "" : "s"}`}
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

      <ul className="divide-y divide-carbon-blue/8">
        {visible.map((nudge) => {
          const payload = nudge.actionPayload;
          const primaryLabel =
            payload.label ??
            (nudge.actionType === "ADD_ECONOMIC_BUYER"
              ? "Add Economic Buyer"
              : nudge.actionType === "DRAFT_OUTREACH_EMAIL"
                ? "Draft Outreach Email"
                : "Take action");
          const secondary = (payload.secondaryActions ?? []).slice(0, 2);

          return (
            <li key={nudge.id} className="px-4 py-3">
              <div className="flex flex-wrap items-start gap-2">
                <span
                  className={`shrink-0 border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${SEVERITY_STYLES[nudge.severity]}`}
                >
                  {nudge.severity === "HIGH"
                    ? "High"
                    : nudge.severity === "MEDIUM"
                      ? "Medium"
                      : "Low"}
                </span>
                {!companyId && payload.companyId ? (
                  <Link
                    href={company360Href(payload.companyId)}
                    className="text-[11px] font-semibold text-carbon-blue/55 hover:text-upcycle-orange"
                  >
                    {payload.companyName ?? payload.companyId}
                  </Link>
                ) : null}
                <button
                  type="button"
                  onClick={() =>
                    setDismissed((current) => new Set(current).add(nudge.id))
                  }
                  className="ml-auto text-[10px] font-medium text-carbon-blue/35 hover:text-carbon-blue/60"
                  aria-label="Dismiss nudge"
                >
                  Dismiss
                </button>
              </div>

              <p className="mt-1.5 text-[13px] font-semibold leading-snug text-carbon-blue">
                {nudge.title}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/60">
                {nudge.description}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                {payload.href ? (
                  <a
                    href={payload.href}
                    target={
                      nudge.actionType === "DRAFT_OUTREACH_EMAIL"
                        ? "_blank"
                        : undefined
                    }
                    rel={
                      nudge.actionType === "DRAFT_OUTREACH_EMAIL"
                        ? "noopener noreferrer"
                        : undefined
                    }
                    className={actionButtonClass(nudge.actionType)}
                  >
                    {primaryLabel}
                  </a>
                ) : null}
                {secondary.map((action) => (
                  <a
                    key={`${action.actionType}-${action.label}`}
                    href={action.href}
                    target={
                      action.actionType === "DRAFT_OUTREACH_EMAIL"
                        ? "_blank"
                        : undefined
                    }
                    rel={
                      action.actionType === "DRAFT_OUTREACH_EMAIL"
                        ? "noopener noreferrer"
                        : undefined
                    }
                    className={actionButtonClass(action.actionType)}
                  >
                    {action.label}
                  </a>
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
