"use client";

import { useMemo, useState } from "react";
import type { CommercialPackage } from "@/types/commercial-package";
import type { PipelineRow } from "@/types/pipeline";
import { formatDealValue, formatProbability } from "@/types/pipeline";
import { DealLink } from "@/components/relationship/relationship-links";
import { IconLabel, SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import {
  CLOSE_DATE_STATUS_ICON,
  CLOSE_DATE_STATUS_LABEL,
  formatExpectedCloseDate,
  getCloseDateStatus,
  getProbabilityStatus,
  opportunityStageLabel,
  PROBABILITY_STATUS_ICON,
  PROBABILITY_STATUS_LABEL,
  sortOpportunities,
  type OpportunitySortKey,
} from "@/lib/opportunity-overview";

type SortDirection = "asc" | "desc";

function SortHeader({
  label,
  icon,
  active,
  direction,
  onClick,
  align = "left",
}: {
  label: string;
  icon?: "value" | "meeting" | "stage" | "probability" | "opNumber";
  active: boolean;
  direction: SortDirection;
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <th className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
          active ? "text-upcycle-orange" : "text-carbon-blue/45 hover:text-carbon-blue"
        } ${align === "right" ? "ml-auto" : ""}`}
      >
        {icon ? <SmartCRMIcon name={icon} size="xs" /> : null}
        {label}
        {active ? (
          <span className="text-[9px] opacity-70" aria-hidden>
            {direction === "asc" ? "↑" : "↓"}
          </span>
        ) : null}
      </button>
    </th>
  );
}

function StatusCell({
  icon,
  label,
  detail,
}: {
  icon: string;
  label: string;
  detail: string;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 truncate text-[12px] text-carbon-blue/70">
      <span className="shrink-0" aria-hidden>
        {icon}
      </span>
      <span className="sr-only">{label}</span>
      <span className="truncate">{detail}</span>
    </span>
  );
}

/**
 * Compact commercial overview table for open opportunities.
 * Fluid layout — no horizontal scrollbar on desktop.
 */
export function OpportunitiesOverviewTable({
  deals,
  commercialPackages,
  defaultSort = "value",
  defaultDirection = "desc",
  compact = false,
}: {
  deals: PipelineRow[];
  commercialPackages: CommercialPackage[];
  defaultSort?: OpportunitySortKey;
  defaultDirection?: SortDirection;
  /** Tighter column mix for side-by-side workspace panels */
  compact?: boolean;
}) {
  const [sortKey, setSortKey] = useState<OpportunitySortKey>(defaultSort);
  const [direction, setDirection] = useState<SortDirection>(defaultDirection);

  const sorted = useMemo(
    () => sortOpportunities(deals, sortKey, direction),
    [deals, sortKey, direction],
  );

  const toggleSort = (key: OpportunitySortKey) => {
    if (sortKey === key) {
      setDirection((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setDirection(key === "id" || key === "stage" ? "asc" : "desc");
    }
  };

  if (deals.length === 0) {
    return <p className="text-sm text-carbon-blue/45">No opportunities yet.</p>;
  }

  return (
    <table className="w-full table-fixed border-collapse text-left">
      <colgroup>
        <col className={compact ? "w-[28%]" : "w-[26%]"} />
        <col className={compact ? "w-[14%]" : "w-[13%]"} />
        <col className={compact ? "w-[18%]" : "w-[17%]"} />
        <col className={compact ? "w-[16%]" : "w-[15%]"} />
        <col className={compact ? "w-[14%]" : "w-[13%]"} />
        <col className={compact ? "w-[10%]" : "w-[16%]"} />
      </colgroup>
      <thead>
        <tr className="border-b border-carbon-blue/8 bg-carbon-blue/[0.03]">
          <th className="px-3 py-2 text-left">
            <IconLabel
              icon="opportunity"
              iconSize="xs"
              className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45"
            >
              Opportunity
            </IconLabel>
          </th>
          <SortHeader
            label="Value"
            icon="value"
            active={sortKey === "value"}
            direction={direction}
            onClick={() => toggleSort("value")}
            align="right"
          />
          <SortHeader
            label="Close Date"
            icon="meeting"
            active={sortKey === "expectedCloseDate"}
            direction={direction}
            onClick={() => toggleSort("expectedCloseDate")}
          />
          <SortHeader
            label="Stage"
            icon="stage"
            active={sortKey === "stage"}
            direction={direction}
            onClick={() => toggleSort("stage")}
          />
          <SortHeader
            label="Probability"
            icon="probability"
            active={sortKey === "probability"}
            direction={direction}
            onClick={() => toggleSort("probability")}
            align="right"
          />
          <SortHeader
            label="OP-No."
            icon="opNumber"
            active={sortKey === "id"}
            direction={direction}
            onClick={() => toggleSort("id")}
          />
        </tr>
      </thead>
      <tbody>
        {sorted.map((deal) => {
          const closeStatus = getCloseDateStatus(deal.expectedCloseDate);
          const probStatus = getProbabilityStatus(deal.probability);
          const stageLabel = opportunityStageLabel(deal, commercialPackages);

          return (
            <tr
              key={deal.id}
              className="border-b border-carbon-blue/6 last:border-b-0 hover:bg-carbon-blue/[0.02]"
            >
              <td className="px-3 py-2.5">
                <DealLink dealId={deal.id} className="group block truncate">
                  <span className="text-[13px] font-semibold text-carbon-blue group-hover:text-upcycle-orange">
                    {deal.assetName}
                  </span>
                </DealLink>
              </td>
              <td className="px-3 py-2.5 text-right text-[12px] font-semibold tabular-nums text-carbon-blue">
                {formatDealValue(deal.currency, deal.salesValue)}
              </td>
              <td className="px-3 py-2.5">
                {closeStatus ? (
                  <StatusCell
                    icon={CLOSE_DATE_STATUS_ICON[closeStatus]}
                    label={CLOSE_DATE_STATUS_LABEL[closeStatus]}
                    detail={formatExpectedCloseDate(deal.expectedCloseDate)}
                  />
                ) : (
                  <span className="text-[12px] text-carbon-blue/35">—</span>
                )}
              </td>
              <td className="truncate px-3 py-2.5 text-[12px] text-carbon-blue/70">{stageLabel}</td>
              <td className="px-3 py-2.5 text-right">
                <StatusCell
                  icon={PROBABILITY_STATUS_ICON[probStatus]}
                  label={PROBABILITY_STATUS_LABEL[probStatus]}
                  detail={formatProbability(deal.probability)}
                />
              </td>
              <td className="px-3 py-2.5">
                <DealLink
                  dealId={deal.id}
                  showIcon={false}
                  className="block truncate font-mono text-[11px] text-carbon-blue/55 hover:text-upcycle-orange"
                >
                  {deal.id}
                </DealLink>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
