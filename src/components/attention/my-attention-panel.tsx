"use client";

import type { AttentionQueue } from "@/types/attention-item";
import { flattenAttentionQueue } from "@/types/attention-item";
import { AttentionQueueTable } from "@/components/attention/attention-queue-table";

type MyAttentionPanelProps = {
  queue: AttentionQueue;
  /** Max items on home (information budget). */
  limit?: number;
  /** Filter to a specific owner's queue (from Opportunities owner link). */
  ownerFilter?: string;
};

export function MyAttentionPanel({ queue, limit = 20, ownerFilter }: MyAttentionPanelProps) {
  let items = flattenAttentionQueue(queue, { includeHealthy: false, limit: ownerFilter ? 100 : limit });

  if (ownerFilter) {
    items = items.filter(
      (item) => item.ownerLabel?.toLowerCase() === ownerFilter.toLowerCase(),
    );
  }

  if (items.length === 0) {
    return (
      <p className="text-sm text-carbon-blue/45">
        {ownerFilter
          ? `No attention items in ${ownerFilter}'s queue right now.`
          : "Nothing needs your attention right now. Your portfolio is healthy."}
      </p>
    );
  }

  return (
    <AttentionQueueTable
      items={items}
      emptyMessage="Nothing needs your attention right now. Your portfolio is healthy."
    />
  );
}
