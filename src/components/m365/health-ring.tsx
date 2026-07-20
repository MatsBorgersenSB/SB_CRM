import type { M365HealthBlock } from "@/types/m365";
import type { RelationshipHealthStatus } from "@/lib/relationship-health-engine";
import { RelationshipHealthScoreRing } from "@/components/relationship/relationship-health-display";

export function HealthRing({
  health,
  size = "md",
}: {
  health: M365HealthBlock;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <RelationshipHealthScoreRing
      score={health.score}
      status={health.status as RelationshipHealthStatus}
      size={size}
    />
  );
}
