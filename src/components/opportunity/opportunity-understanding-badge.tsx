import type { RecommendedAttention } from "@/lib/opportunity-workspace-intelligence";

const ATTENTION_STYLES: Record<RecommendedAttention, string> = {
  HIGH: "border-thermal-red/30 bg-thermal-red/[0.06] text-thermal-red",
  MEDIUM: "border-upcycle-orange/30 bg-upcycle-orange/[0.06] text-upcycle-orange",
  LOW: "border-carbon-blue/15 bg-carbon-blue/[0.04] text-carbon-blue/65",
  HOLD: "border-carbon-blue/12 bg-carbon-blue/[0.02] text-carbon-blue/45",
};

export function OpportunityUnderstandingBadge({
  attention,
  openGaps,
}: {
  attention: RecommendedAttention;
  openGaps: number;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ATTENTION_STYLES[attention]}`}
      title={`${openGaps} open learning gap${openGaps === 1 ? "" : "s"}`}
    >
      <span>{attention}</span>
      <span className="font-normal normal-case tracking-normal text-carbon-blue/45">
        · {openGaps} gap{openGaps === 1 ? "" : "s"}
      </span>
    </span>
  );
}
