"use client";

import { useMemo, useState, useSyncExternalStore } from "react";
import type { AttentionQueue } from "@/types/attention-item";
import { flattenAttentionQueue } from "@/types/attention-item";
import {
  dedupeAttentionByCompany,
  TODAY_ATTENTION_VISIBLE,
} from "@/lib/attention-focus";
import { filterDismissedAttentionItems } from "@/lib/attention-dismiss-store";
import { AttentionQueueTable } from "@/components/attention/attention-queue-table";

const subscribeNever = () => () => {};

type MyAttentionPanelProps = {
  queue: AttentionQueue;
  /** Max items on home (information budget). */
  limit?: number;
  /** Filter to a specific owner's queue (from Opportunities owner link). */
  ownerFilter?: string;
};

export function MyAttentionPanel({
  queue,
  limit = TODAY_ATTENTION_VISIBLE,
  ownerFilter,
}: MyAttentionPanelProps) {
  // Dismissals live in localStorage: false on the server and first client render, true after.
  const hydrated = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const [showAll, setShowAll] = useState(false);

  // Dismiss first, then one row per company — dismissing the lead item reveals the next.
  const allItems = useMemo(() => {
    let rows = flattenAttentionQueue(queue, { includeHealthy: false });

    if (ownerFilter) {
      rows = rows.filter(
        (item) => item.ownerLabel?.toLowerCase() === ownerFilter.toLowerCase(),
      );
    }

    return dedupeAttentionByCompany(hydrated ? filterDismissedAttentionItems(rows) : rows);
  }, [queue, ownerFilter, hydrated]);

  const items = showAll || ownerFilter ? allItems : allItems.slice(0, limit);
  const hiddenCount = allItems.length - items.length;

  if (items.length === 0) {
    return (
      <p className="text-sm text-carbon-blue/65">
        {ownerFilter
          ? `No attention items in ${ownerFilter}'s queue right now.`
          : "Nothing needs your attention right now. Your portfolio is healthy."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <AttentionQueueTable
        items={items}
        emptyMessage="Nothing needs your attention right now. Your portfolio is healthy."
      />
      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="self-start text-[13px] font-semibold text-upcycle-orange hover:underline"
        >
          Show {hiddenCount} more {hiddenCount === 1 ? "company" : "companies"}
        </button>
      ) : null}
    </div>
  );
}
