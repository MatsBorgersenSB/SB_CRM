import type { OpportunityCommandCenterItem } from "@/lib/opportunity-command-center-data";
import { DealLink } from "@/components/relationship/relationship-links";

export function OpportunityCommandCenterRow({
  item,
}: {
  item: OpportunityCommandCenterItem;
  showValue?: boolean;
}) {
  const topDealRisk = item.risks[0];

  return (
    <DealLink dealId={item.dealId} className="group block border-b border-carbon-blue/6 px-6 py-4 last:border-b-0 transition-colors hover:bg-carbon-blue/[0.02]">
      <p className="text-sm font-semibold text-carbon-blue group-hover:text-upcycle-orange">
        {item.dealName}
      </p>
      <p className="mt-0.5 text-[11px] text-carbon-blue/45">{item.subtitle}</p>
      <p className="mt-2 text-[11px] font-semibold text-carbon-blue/75">
        {item.nextBestAction.action}
      </p>
      {topDealRisk ? (
        <p className="mt-1.5 text-[10px] text-carbon-blue/45">
          {topDealRisk.label}
          {topDealRisk.detail ? ` — ${topDealRisk.detail}` : ""}
        </p>
      ) : null}
    </DealLink>
  );
}
