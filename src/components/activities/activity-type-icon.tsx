"use client";

import {
  CheckSquare,
  Cog,
  FileText,
  Factory,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Phone,
  StickyNote,
  Users,
  Video,
} from "lucide-react";
import type { ActivityType } from "@/types/activity";
import { WORKSPACE_ACTIVITY_TYPES } from "@/types/activity";

const ICON_MAP: Record<ActivityType, typeof Phone> = {
  "Phone Call": Phone,
  Email: Mail,
  "Email Follow-Up": Mail,
  "Teams Meeting": Video,
  Meeting: Users,
  "Site Visit": Factory,
  "Proposal Sent": FileText,
  "Technical Review": Cog,
  "Commercial Review": Cog,
  Task: CheckSquare,
  Note: StickyNote,
  Other: MoreHorizontal,
};

const COLOR_MAP: Record<ActivityType, string> = {
  "Phone Call": "bg-sky-500/10 text-sky-700 border-sky-500/20",
  Email: "bg-violet-500/10 text-violet-700 border-violet-500/20",
  "Email Follow-Up": "bg-violet-500/10 text-violet-700 border-violet-500/20",
  "Teams Meeting": "bg-indigo-500/10 text-indigo-700 border-indigo-500/20",
  Meeting: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  "Site Visit": "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  "Proposal Sent": "bg-amber-500/10 text-amber-700 border-amber-500/20",
  "Technical Review": "bg-carbon-blue/8 text-carbon-blue border-carbon-blue/15",
  "Commercial Review": "bg-carbon-blue/8 text-carbon-blue border-carbon-blue/15",
  Task: "bg-upcycle-orange/10 text-upcycle-orange border-upcycle-orange/25",
  Note: "bg-carbon-blue/5 text-carbon-blue/70 border-carbon-blue/10",
  Other: "bg-carbon-blue/5 text-carbon-blue/60 border-carbon-blue/10",
};

export function ActivityTypeIcon({
  type,
  size = "md",
}: {
  type: ActivityType;
  size?: "sm" | "md" | "lg";
}) {
  const Icon = ICON_MAP[type] ?? MessageSquare;
  const sizeClass =
    size === "sm" ? "size-7" : size === "lg" ? "size-11" : "size-9";
  const iconSize = size === "sm" ? 14 : size === "lg" ? 20 : 16;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center border ${sizeClass} ${COLOR_MAP[type] ?? COLOR_MAP.Other}`}
    >
      <Icon size={iconSize} strokeWidth={1.75} />
    </span>
  );
}

export const ACTIVITY_TYPE_OPTIONS: {
  type: ActivityType;
  label: string;
  emoji: string;
}[] = [
  { type: "Meeting", label: "Meeting", emoji: "🤝" },
  { type: "Teams Meeting", label: "Teams Meeting", emoji: "🎥" },
  { type: "Phone Call", label: "Phone Call", emoji: "📞" },
  { type: "Email Follow-Up", label: "Email Follow-Up", emoji: "📧" },
  { type: "Site Visit", label: "Site Visit", emoji: "🏭" },
  { type: "Commercial Review", label: "Commercial Review", emoji: "📊" },
  { type: "Task", label: "Task", emoji: "✅" },
  { type: "Note", label: "Note", emoji: "📝" },
];

/** Legacy types still available in filters */
export const LEGACY_ACTIVITY_TYPE_OPTIONS: {
  type: ActivityType;
  label: string;
  emoji: string;
}[] = [
  { type: "Email", label: "Email", emoji: "📧" },
  { type: "Proposal Sent", label: "Proposal Sent", emoji: "📄" },
  { type: "Technical Review", label: "Technical Review", emoji: "⚙" },
  { type: "Other", label: "Other", emoji: "➕" },
];

export function isWorkspaceActivityType(type: ActivityType): boolean {
  return WORKSPACE_ACTIVITY_TYPES.includes(type);
}
