"use client";

import { AssistantRecommendationCard } from "@/components/administration/assistant-recommendation-card";
import { userAccessGapToView } from "@/lib/assistant-actionability";
import type { UserAccessGap } from "@/types/user-access";

export function UserAccessGapCard({ gap }: { gap: UserAccessGap }) {
  return <AssistantRecommendationCard recommendation={userAccessGapToView(gap)} />;
}
