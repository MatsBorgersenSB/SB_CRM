import { USER_ROLE_DESCRIPTIONS, USER_ROLE_LABELS } from "@/types/auth";
import type {
  AccessRecommendation,
  BusinessFunction,
  OwnershipScope,
  StandardBioUserRecord,
} from "@/types/user-access";

/** Client-safe access recommendations — no Node.js / fs dependencies. */

export const OWNERSHIP_SCOPE_LABELS: Record<OwnershipScope, string> = {
  global: "Global — all companies and opportunities",
  portfolio: "Portfolio — assigned company accounts",
  company: "Company-scoped — single account focus",
  none: "No ownership — read-only or support role",
};

const BUSINESS_FUNCTION_PROFILES: Record<
  BusinessFunction,
  Omit<AccessRecommendation, "rationale" | "confidencePercent">
> = {
  Sales: {
    role: "commercial",
    roleLabel: USER_ROLE_LABELS.commercial,
    permissionsSummary:
      "Read/write sales value and probability; assign opportunity owners; upload SmartDocs.",
    ownershipScope: "portfolio",
    ownershipScopeLabel: OWNERSHIP_SCOPE_LABELS.portfolio,
    team: "Commercial",
    license: "SmartCRM Professional",
  },
  Marketing: {
    role: "commercial",
    roleLabel: USER_ROLE_LABELS.commercial,
    permissionsSummary:
      "Read portfolio intelligence; update company status; limited pipeline write on early-stage deals.",
    ownershipScope: "portfolio",
    ownershipScopeLabel: OWNERSHIP_SCOPE_LABELS.portfolio,
    team: "Commercial",
    license: "SmartCRM Standard",
  },
  Management: {
    role: "admin",
    roleLabel: USER_ROLE_LABELS.admin,
    permissionsSummary:
      "Executive KPIs and read-only financial/operational ledgers across the portfolio.",
    ownershipScope: "global",
    ownershipScopeLabel: OWNERSHIP_SCOPE_LABELS.global,
    team: "Executive",
    license: "SmartCRM Intelligence",
  },
  Engineering: {
    role: "engineer",
    roleLabel: USER_ROLE_LABELS.engineer,
    permissionsSummary:
      "Read/write reactor capacity, feedstock, milestone and status; assign deal teams.",
    ownershipScope: "company",
    ownershipScopeLabel: OWNERSHIP_SCOPE_LABELS.company,
    team: "Engineering",
    license: "SmartCRM Professional",
  },
  Service: {
    role: "engineer",
    roleLabel: USER_ROLE_LABELS.engineer,
    permissionsSummary:
      "Read/write commissioning fields; manage activities on assigned service accounts.",
    ownershipScope: "company",
    ownershipScopeLabel: OWNERSHIP_SCOPE_LABELS.company,
    team: "Service",
    license: "SmartCRM Standard",
  },
  Administration: {
    role: "superuser",
    roleLabel: USER_ROLE_LABELS.superuser,
    permissionsSummary:
      "Full schema control, user management, data overrides, and SharePoint provisioning.",
    ownershipScope: "global",
    ownershipScopeLabel: OWNERSHIP_SCOPE_LABELS.global,
    team: "IT",
    license: "SmartCRM Intelligence",
  },
};

const FUNCTION_RATIONALE: Record<BusinessFunction, string> = {
  Sales:
    "Commercial roles own relationships, quotations, and deal progression. Portfolio scope keeps focus on assigned accounts.",
  Marketing:
    "Marketing needs visibility across accounts without deep pipeline write access. Commercial role with standard license fits.",
  Management:
    "Executive users need macro KPIs without day-to-day CRM edits. Admin role with global read scope is appropriate.",
  Engineering:
    "Deployment engineers update technical fields on assigned reactor projects. Company-scoped access limits risk.",
  Service:
    "Service staff maintain commissioning and support activities on live assets. Engineer role with company scope fits.",
  Administration:
    "IT administrators configure workspace architecture, users, and integrations. Superuser with global scope is required.",
};

export function recommendAccessForFunction(
  businessFunction: BusinessFunction,
): AccessRecommendation {
  const profile = BUSINESS_FUNCTION_PROFILES[businessFunction];
  return {
    ...profile,
    rationale: FUNCTION_RATIONALE[businessFunction],
    confidencePercent: businessFunction === "Administration" ? 95 : 88,
  };
}

export function describeRolePermissions(role: StandardBioUserRecord["role"]): string {
  if (!role) return "No role assigned — user cannot access CRM features.";
  return USER_ROLE_DESCRIPTIONS[role];
}
