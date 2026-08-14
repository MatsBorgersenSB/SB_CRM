import Link from "next/link";
import { Plus } from "lucide-react";
import type { Activity } from "@/types/activity";
import { ActivityTimeline } from "@/components/activities/activity-timeline";
import { CompleteCommitmentCard } from "@/components/commitments/complete-commitment-card";
import {
  pickPendingCommitment,
  toPendingCommitmentView,
} from "@/lib/complete-commitment";

export function Company360ActivitiesTab({
  activities,
}: {
  activities: Activity[];
}) {
  const pending = pickPendingCommitment(activities);
  const pendingCommitment = pending ? toPendingCommitmentView(pending) : null;

  return (
    <section className="dashboard-card">
      <header className="flex items-center justify-between border-b border-carbon-blue/8 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-carbon-blue">Activity timeline</h2>
          <p className="mt-0.5 text-[11px] text-carbon-blue/45">
            Chronological relationship history — no spreadsheets, just context
          </p>
        </div>
        <Link
          href="/activities"
          className="inline-flex items-center gap-1 border border-upcycle-orange/30 bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-upcycle-orange/90"
        >
          <Plus className="size-3.5" />
          Record interaction
        </Link>
      </header>

      <div className="px-5 py-5">
        {pendingCommitment ? (
          <CompleteCommitmentCard
            key={pendingCommitment.activityId}
            className="mb-4"
            commitment={pendingCommitment}
          />
        ) : null}
        <ActivityTimeline
          activities={activities}
          emptyMessage="No interactions recorded for this company yet. Start the timeline with your first activity."
        />
      </div>
    </section>
  );
}
