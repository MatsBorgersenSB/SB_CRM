import type { ConfigurationDomain } from "@/types/assisted-configuration";
import type { UserAccessGap } from "@/types/user-access";

/** Normalized actionable recommendation for UI — no dead ends. */
export type ActionableRecommendationView = {
  id: string;
  eyebrow: string;
  title: string;
  why: string;
  impact: string;
  recommendedAction: string;
  resolutionHref: string;
  resolutionLabel: string;
  severity: "critical" | "warning" | "healthy";
  confidencePercent?: number;
};

export const CONFIG_DOMAIN_RESOLUTION: Record<
  ConfigurationDomain,
  { href: string; label: string }
> = {
  roles: { href: "/administration/users-access", label: "Assign roles in Users & Access" },
  permissions: {
    href: "/administration/users-access",
    label: "Review permissions in Users & Access",
  },
  ownership: {
    href: "/administration/users-access",
    label: "Resolve ownership in Users & Access",
  },
  integrations: { href: "/m365-preview", label: "Open integration workspace" },
  knowledge_sources: { href: "/knowledge", label: "Open Knowledge workspace" },
  intelligence_sources: { href: "/intelligence", label: "Open Intelligence workspace" },
};

export const ACCESS_GAP_RESOLUTION: Record<
  UserAccessGap["category"],
  { href: string; label: string }
> = {
  users_without_roles: {
    href: "/administration/users-access",
    label: "Assign role in Users & Access",
  },
  companies_without_owners: {
    href: "/administration/users-access",
    label: "Assign company owner",
  },
  opportunities_without_owners: {
    href: "/administration/users-access",
    label: "Assign opportunity owner",
  },
  activities_without_owners: {
    href: "/administration/users-access",
    label: "Assign activity owner",
  },
  excessive_permissions: {
    href: "/administration/users-access",
    label: "Review user permissions",
  },
  inactive_users: {
    href: "/administration/users-access",
    label: "Manage inactive user",
  },
  orphaned_records: {
    href: "/administration/users-access",
    label: "Transfer ownership now",
  },
  ownership_requires_transfer: {
    href: "/administration/users-access",
    label: "Start ownership transfer",
  },
};

export function ensureActionableResolution<T extends { href?: string; resolutionLabel?: string }>(
  item: T,
  fallback: { href: string; label: string },
): T & { href: string; resolutionLabel: string } {
  return {
    ...item,
    href: item.href ?? fallback.href,
    resolutionLabel: item.resolutionLabel ?? fallback.label,
  };
}

export function configRecommendationToView(
  recommendation: import("@/types/assisted-configuration").ConfigRecommendation,
): ActionableRecommendationView {
  return {
    id: recommendation.id,
    eyebrow: recommendation.domainLabel,
    title: recommendation.title,
    why: recommendation.why,
    impact: recommendation.impact,
    recommendedAction: recommendation.nextAction,
    resolutionHref: recommendation.href,
    resolutionLabel: recommendation.resolutionLabel,
    severity: recommendation.severity,
    confidencePercent: recommendation.confidencePercent,
  };
}

export function userAccessGapToView(gap: UserAccessGap): ActionableRecommendationView {
  return {
    id: gap.id,
    eyebrow: gap.categoryLabel,
    title: gap.title,
    why: gap.why,
    impact: gap.impact,
    recommendedAction: gap.recommendedAction,
    resolutionHref: gap.href,
    resolutionLabel: gap.resolutionLabel,
    severity: gap.severity,
  };
}
