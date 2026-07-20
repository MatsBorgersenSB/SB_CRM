"use client";

import { AssistantRecommendationCard } from "@/components/administration/assistant-recommendation-card";
import { configRecommendationToView } from "@/lib/assistant-actionability";
import type { ConfigRecommendation } from "@/types/assisted-configuration";

export function ConfigRecommendationCard({
  recommendation,
}: {
  recommendation: ConfigRecommendation;
}) {
  return (
    <AssistantRecommendationCard recommendation={configRecommendationToView(recommendation)} />
  );
}
