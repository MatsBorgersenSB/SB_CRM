import type { Activity } from "@/types/activity";
import { ActivityKnowledgeSections } from "@/components/activities/activity-knowledge-sections";

/** Full 9-section knowledge view for activity detail pages. */
export function ActivityMemoryDetail({ activity }: { activity: Activity }) {
  return <ActivityKnowledgeSections activity={activity} />;
}
