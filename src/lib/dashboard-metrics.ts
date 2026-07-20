/** @deprecated Use @/lib/relationship-intelligence */
export {
  buildDashboardData,
  buildRelationshipCommandCenter,
  formatDashboardDate,
  getWelcomeGreeting,
} from "@/lib/relationship-intelligence";

export type {
  DashboardKpis,
  RelationshipCommandCenter,
} from "@/lib/relationship-intelligence";

// Legacy alias
export type { RelationshipCommandCenter as DashboardData } from "@/lib/relationship-intelligence";
