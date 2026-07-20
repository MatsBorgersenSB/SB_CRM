import { hasCompanyOwner } from "@/lib/company-owner";
import { resolveOpportunityOwner } from "@/lib/opportunity-owner";
import { ACCESS_GAP_RESOLUTION, ensureActionableResolution } from "@/lib/assistant-actionability";
import { analyzeUserOwnership, findOrphanedRecords } from "@/lib/user-lifecycle-analysis";
import { getWritablePipelineFields } from "@/lib/permissions";
import { USER_ROLE_LABELS } from "@/types/auth";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type {
  StandardBioUserRecord,
  UserAccessGap,
  UsersAccessAudit,
} from "@/types/user-access";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";

type UsersAccessAuditInput = {
  users: StandardBioUserRecord[];
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  smartDocs?: SmartDocLibraryRecord[];
};

function severityRank(severity: UserAccessGap["severity"]): number {
  return severity === "critical" ? 0 : 1;
}

function buildGap(
  partial: Omit<UserAccessGap, "categoryLabel" | "href" | "resolutionLabel" | "recommendedAction"> & {
    category: UserAccessGap["category"];
    href?: string;
    resolutionLabel?: string;
    recommendedAction?: string;
    correctiveAction?: string;
    what?: string;
    why?: string;
  },
): UserAccessGap {
  const labels: Record<UserAccessGap["category"], string> = {
    users_without_roles: "Users without roles",
    companies_without_owners: "Companies without owners",
    opportunities_without_owners: "Opportunities without owners",
    activities_without_owners: "Activities without owners",
    excessive_permissions: "Excessive permissions",
    inactive_users: "Inactive users",
    orphaned_records: "Orphaned records",
    ownership_requires_transfer: "Ownership requires transfer",
  };

  const categoryDefault = ACCESS_GAP_RESOLUTION[partial.category];
  const why = partial.why ?? partial.what ?? "";
  const recommendedAction =
    partial.recommendedAction ?? partial.correctiveAction ?? "Review in Users & Access.";

  const withPath = ensureActionableResolution(
    {
      ...partial,
      why,
      recommendedAction,
      href: partial.href ?? categoryDefault.href,
      resolutionLabel: partial.resolutionLabel ?? categoryDefault.label,
    },
    categoryDefault,
  );

  return {
    ...withPath,
    categoryLabel: labels[partial.category],
  };
}

const INACTIVE_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000;

export function buildUsersAccessAudit(input: UsersAccessAuditInput): UsersAccessAudit {
  const gaps: UserAccessGap[] = [];
  const { users, companies, pipelines, activities } = input;
  const now = Date.now();

  for (const user of users) {
    if (user.status === "active" && !user.role) {
      gaps.push(
        buildGap({
          id: `user-no-role-${user.id}`,
          category: "users_without_roles",
          title: `${user.displayName} has no role`,
          why: "An active user exists without a CRM role assignment.",
          impact: "They cannot access pipelines, companies, or SmartAssist features correctly.",
          recommendedAction: "Assign a role based on their business function, or disable the account.",
          severity: "critical",
          href: "/administration/users-access",
          resolutionLabel: `Assign role for ${user.displayName}`,
          entityId: String(user.id),
        }),
      );
    }
  }

  for (const company of companies) {
    if (!hasCompanyOwner(company)) {
      gaps.push(
        buildGap({
          id: `company-no-owner-${company.CompanyID}`,
          category: "companies_without_owners",
          title: `${company.Title} has no company owner`,
          why: "Every company requires a named Standard Bio owner.",
          impact: "SmartAssist cannot route attention; commercial accountability is unclear.",
          recommendedAction: "Assign a company owner from Users & Access or the company record.",
          severity: "critical",
          href: `/companies/${company.CompanyID}`,
          resolutionLabel: `Assign owner for ${company.Title}`,
          entityId: company.CompanyID,
        }),
      );
    }
  }

  for (const pipeline of pipelines) {
    const company = companies.find((record) => record.pipelineIds.includes(pipeline.id));
    const owner = resolveOpportunityOwner(pipeline, company);
    if (!owner?.Title?.trim()) {
      gaps.push(
        buildGap({
          id: `opp-no-owner-${pipeline.id}`,
          category: "opportunities_without_owners",
          title: `${pipeline.assetName ?? pipeline.id} has no opportunity owner`,
          why: "Active opportunities need a named commercial owner.",
          impact: "Deal progression and follow-ups lack accountability.",
          recommendedAction: "Assign an opportunity owner from a commercial user with portfolio scope.",
          severity: "warning",
          href: `/deals/${pipeline.id}`,
          resolutionLabel: `Assign owner on ${pipeline.assetName ?? pipeline.id}`,
          entityId: pipeline.id,
        }),
      );
    }
  }

  for (const activity of activities) {
    if (!activity.ActivityOwner?.Title?.trim()) {
      gaps.push(
        buildGap({
          id: `activity-no-owner-${activity.ActivityID}`,
          category: "activities_without_owners",
          title: `Activity ${activity.Subject ?? activity.ActivityID} has no owner`,
          why: "Activities without owners stall in mission control.",
          impact: "Follow-ups and tasks may be missed.",
          recommendedAction: "Assign an activity owner from the deal team or company owner.",
          severity: "warning",
          href: `/activities/${activity.ActivityID}`,
          resolutionLabel: "Assign activity owner now",
          entityId: activity.ActivityID,
        }),
      );
    }
  }

  const superusers = users.filter((user) => user.role === "superuser" && user.status === "active");
  if (superusers.length > 2) {
    gaps.push(
      buildGap({
        id: "excessive-superusers",
        category: "excessive_permissions",
        title: `${superusers.length} active superusers detected`,
        why: "Too many IT Admin accounts increases security and audit risk.",
        impact: "Schema changes and data overrides are not tightly controlled.",
        recommendedAction: "Review superuser accounts and downgrade to admin or commercial where possible.",
        severity: "warning",
        href: "/administration/users-access",
        resolutionLabel: "Review superuser accounts",
      }),
    );
  }

  for (const user of users) {
    if (user.role === "commercial" && user.ownershipScope === "global" && user.status === "active") {
      gaps.push(
        buildGap({
          id: `excessive-scope-${user.id}`,
          category: "excessive_permissions",
          title: `${user.displayName} has global scope on commercial role`,
          why: "Commercial users should typically have portfolio or company scope, not global.",
          impact: "Unnecessary access to accounts outside their responsibility.",
          recommendedAction: "Narrow ownership scope to portfolio and assign specific company IDs.",
          severity: "warning",
          href: "/administration/users-access",
          resolutionLabel: `Adjust scope for ${user.displayName}`,
          entityId: String(user.id),
        }),
      );
    }

    if (user.role && user.status === "active") {
      const writableCount = getWritablePipelineFields(user.role).length;
      if (writableCount >= 6 && user.role !== "superuser") {
        gaps.push(
          buildGap({
            id: `broad-write-${user.id}`,
            category: "excessive_permissions",
            title: `${user.displayName} has broad pipeline write access`,
            why: `${USER_ROLE_LABELS[user.role]} can write ${writableCount} pipeline fields.`,
            impact: "Consider whether this matches their business function.",
            recommendedAction: `Verify role assignment matches ${user.businessFunction ?? "their function"}.`,
            severity: "warning",
            href: "/administration/users-access",
            resolutionLabel: `Review permissions for ${user.displayName}`,
            entityId: String(user.id),
          }),
        );
      }
    }
  }

  for (const user of users) {
    const lastActive = user.lastActiveAt ? Date.parse(user.lastActiveAt) : 0;
    const isStale = lastActive > 0 && now - lastActive > INACTIVE_THRESHOLD_MS;
    if (user.status === "inactive" || user.status === "disabled" || user.status === "archived" || isStale) {
      gaps.push(
        buildGap({
          id: `inactive-${user.id}`,
          category: "inactive_users",
          title: `${user.displayName} is inactive`,
          why:
            user.status === "disabled" || user.status === "archived"
              ? `Account is ${user.status} but may still hold business ownership.`
              : "No recent CRM activity detected in 90+ days.",
          impact: "License waste and stale ownership references in the directory.",
          recommendedAction:
            user.status === "disabled" || user.status === "archived"
              ? "Transfer ownership before deletion, or re-enable with a fresh role assignment."
              : "Disable the account or confirm they still need access.",
          severity: "warning",
          href: "/administration/users-access",
          resolutionLabel: `Manage ${user.displayName}`,
          entityId: String(user.id),
        }),
      );
    }
  }

  const lifecycleContext = {
    users,
    companies,
    pipelines,
    activities,
    smartDocs: input.smartDocs ?? [],
  };

  for (const user of users) {
    if (user.status === "active") continue;
    const analysis = analyzeUserOwnership(user, lifecycleContext);
    if (!analysis.hasOwnership) continue;
    gaps.push(
      buildGap({
        id: `transfer-required-${user.id}`,
        category: "ownership_requires_transfer",
        title: `${user.displayName} still owns ${analysis.ownedCompanies.length} companies`,
        why: "A non-active user retains company, opportunity, or activity ownership.",
        impact: "SmartAssist routes attention to someone who cannot act. Records may break on departure.",
        recommendedAction: `Transfer ownership to an active successor before archiving or deleting ${user.displayName}.`,
        severity: "critical",
        href: "/administration/users-access",
        resolutionLabel: `Transfer ownership from ${user.displayName}`,
        entityId: String(user.id),
      }),
    );
  }

  const orphaned = findOrphanedRecords(lifecycleContext);
  for (const record of orphaned.slice(0, 5)) {
    gaps.push(
      buildGap({
        id: `orphaned-${record.id}`,
        category: "orphaned_records",
        title: record.label,
        why: "A record is owned by a disabled, archived, or inactive user.",
        impact: "Follow-ups and deal progression stall without a named business owner.",
        recommendedAction: "Use Transfer Ownership to assign an active successor.",
        severity: "critical",
        href: record.href ?? "/administration/users-access",
        resolutionLabel: "Transfer ownership to active user",
        entityId: record.id,
      }),
    );
  }

  gaps.sort((a, b) => severityRank(a.severity) - severityRank(b.severity));

  const criticalCount = gaps.filter((gap) => gap.severity === "critical").length;
  const summary =
    gaps.length === 0
      ? "All users, roles, and ownership structures look healthy."
      : `${gaps.length} access gap${gaps.length === 1 ? "" : "s"} detected — ${criticalCount} critical.`;

  const primaryGap = gaps[0];
  const primaryAction = primaryGap
    ? primaryGap.recommendedAction
    : "Continue monitoring — SmartAssist will flag new gaps automatically.";
  const primaryActionHref = primaryGap?.href;

  return {
    generatedAt: new Date().toISOString(),
    gaps: gaps.slice(0, 12),
    summary,
    primaryAction,
    primaryActionHref,
  };
}
