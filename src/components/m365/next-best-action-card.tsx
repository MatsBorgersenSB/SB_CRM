import Link from "next/link";
import type { M365ActionBlock } from "@/types/m365";
import { ImpactContext } from "@/components/m365/impact-context";

const PRIORITY_STYLES: Record<M365ActionBlock["priority"], string> = {
  High: "border-upcycle-orange/30 bg-upcycle-orange/[0.04] text-upcycle-orange",
  Medium: "border-carbon-blue/15 bg-carbon-blue/[0.03] text-carbon-blue",
  Low: "border-carbon-blue/10 bg-light-grey text-carbon-blue/70",
};

export function NextBestActionCard({
  action,
  compact = false,
  prominent = false,
  hideLinks = false,
}: {
  action: M365ActionBlock;
  compact?: boolean;
  prominent?: boolean;
  hideLinks?: boolean;
}) {
  if (compact) {
    return (
      <div className="text-[11px] leading-relaxed text-carbon-blue/55">
        <span
          className={`inline-flex border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${PRIORITY_STYLES[action.priority]}`}
        >
          {action.priority}
        </span>
        <p className="mt-1 font-medium text-carbon-blue/75">{action.action}</p>
        <ImpactContext items={action.impact} />
      </div>
    );
  }

  const body = (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] font-semibold uppercase tracking-wider opacity-70">
          {prominent ? "Recommended action" : "Next best action"}
        </p>
        <span className="text-[9px] font-semibold uppercase tracking-wider opacity-60">
          {action.priority} priority
        </span>
      </div>
      <p className={`mt-1 font-semibold ${prominent ? "text-sm text-carbon-blue" : "text-sm"}`}>
        {action.action}
      </p>
      <ImpactContext items={action.impact} />
      {!hideLinks ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <Link
            href={action.href}
            className="text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange hover:underline"
          >
            Open in SmartCRM
          </Link>
          {action.plannerEligible ? (
            <span className="text-[10px] text-carbon-blue/40">· Planner eligible</span>
          ) : null}
        </div>
      ) : null}
    </>
  );

  if (prominent) {
    return <div className="text-carbon-blue">{body}</div>;
  }

  return <div className={`border px-4 py-3 ${PRIORITY_STYLES[action.priority]}`}>{body}</div>;
}
