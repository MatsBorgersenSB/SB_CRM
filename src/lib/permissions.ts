import type { Company } from "@/types/company";
import type { AuthUser, UserRole } from "@/types/auth";
import type {
  ColumnKey,
  EditablePipelineField,
  PipelineRow,
} from "@/types/pipeline";
import { EDITABLE_FIELDS } from "@/types/pipeline";

/** Pipeline fields each role may PATCH (SharePoint list item updates). */
const PIPELINE_WRITE_FIELDS: Record<UserRole, readonly EditablePipelineField[]> = {
  superuser: EDITABLE_FIELDS,
  admin: [],
  commercial: ["salesValue", "probability"],
  engineer: [
    "reactorDesignCapacity",
    "targetFeedstock",
    "currentMilestone",
    "status",
  ],
  client_lead: [],
};

/** Company list fields each role may create or update. */
const COMPANY_WRITE_FIELDS: Record<UserRole, readonly string[]> = {
  superuser: [
    "Title",
    "Industry",
    "Status",
    "Domain",
    "Phone",
    "City",
    "AddressLine1",
    "AddressLine2",
    "PostalCode",
    "ParentCompany",
    "AccountOwner",
  ],
  admin: [],
  commercial: ["Status"],
  engineer: [],
  client_lead: [],
};

export function canViewExecutiveKpis(role: UserRole): boolean {
  return role === "admin" || role === "superuser";
}

export function canCreateCompany(role: UserRole): boolean {
  // Enterprise ADMIN/MANAGER (superuser, admin, commercial) may create accounts.
  return role === "superuser" || role === "admin" || role === "commercial";
}

/** FS-013: high-privilege deletes — enterprise ADMIN only. */
export function canDeleteContact(role: UserRole): boolean {
  return role === "superuser" || role === "admin";
}

/** FS-013: high-privilege deletes — enterprise ADMIN only. */
export function canDeleteCompany(role: UserRole): boolean {
  return role === "superuser" || role === "admin";
}

/** FS-020: Duplicate Manager — enterprise ADMIN only. */
export function canAccessDuplicateManager(role: UserRole): boolean {
  return role === "superuser" || role === "admin";
}

export function canWritePipelineField(
  role: UserRole,
  field: EditablePipelineField,
): boolean {
  return PIPELINE_WRITE_FIELDS[role].includes(field);
}

export function canWritePipelineColumn(
  role: UserRole,
  column: ColumnKey,
): boolean {
  if (column === "id" || column === "companyRole") return false;
  if (column === "assetName") return role === "superuser";
  return canWritePipelineField(role, column as EditablePipelineField);
}

export function canWriteCompanyField(role: UserRole, field: string): boolean {
  return COMPANY_WRITE_FIELDS[role].includes(field);
}

export function getWritablePipelineFields(
  role: UserRole,
): readonly EditablePipelineField[] {
  return PIPELINE_WRITE_FIELDS[role];
}

export function assertPipelinePatchAllowed(
  role: UserRole,
  patch: Partial<PipelineRow>,
): void {
  const smartDocKeys = new Set([
    "ClientLookup",
    "DocCategory",
    "DocType",
    "Revision",
    "FileLeafRef",
  ]);

  for (const key of Object.keys(patch) as (keyof PipelineRow)[]) {
    if (key === "id") continue;
    if (patch[key] === undefined) continue;

    if (key === "team") {
      if (!canManageOpportunityStakeholders(role)) {
        throw new Error(`Role "${role}" cannot update opportunity stakeholders`);
      }
      continue;
    }

    if (key === "opportunityOwner") {
      if (!canAssignOpportunityOwner(role)) {
        throw new Error(`Role "${role}" cannot reassign opportunity owner`);
      }
      continue;
    }

    if (key === "expectedCloseDate") {
      if (!canEditExpectedCloseDate(role)) {
        throw new Error(`Role "${role}" cannot update expected close date`);
      }
      continue;
    }

    if (key === "understanding") {
      if (!canCaptureOpportunityUnderstanding(role)) {
        throw new Error(`Role "${role}" cannot update opportunity understanding`);
      }
      continue;
    }

    if (key === "offeringIds") {
      if (!canCaptureOpportunityUnderstanding(role)) {
        throw new Error(`Role "${role}" cannot update opportunity offerings`);
      }
      continue;
    }

    if (smartDocKeys.has(key)) {
      if (!canUploadSmartDocs(role)) {
        throw new Error(`Role "${role}" cannot update SmartDocs metadata`);
      }
      continue;
    }

    if (EDITABLE_FIELDS.includes(key as EditablePipelineField)) {
      if (!canWritePipelineField(role, key as EditablePipelineField)) {
        throw new Error(`Role "${role}" cannot update field: ${key}`);
      }
      continue;
    }

    if (role !== "superuser") {
      throw new Error(`Field is not patchable: ${String(key)}`);
    }
  }
}

export function filterPipelinesForUser(
  pipelines: PipelineRow[],
  user: AuthUser,
  companies: Company[],
): PipelineRow[] {
  if (user.role !== "client_lead" || !user.companyId) {
    return pipelines;
  }

  const company = companies.find(
    (record) => record.CompanyID === user.companyId,
  );
  if (!company) return [];

  const allowed = new Set(company.pipelineIds);
  return pipelines.filter((row) => allowed.has(row.id));
}

export function filterCompaniesForUser(
  companies: Company[],
  user: AuthUser,
): Company[] {
  if (user.role !== "client_lead" || !user.companyId) {
    return companies;
  }

  return companies.filter((company) => company.CompanyID === user.companyId);
}

export function canAccessIntelligenceCenter(role: UserRole): boolean {
  return role !== "client_lead";
}

export function canAccessAssistedConfiguration(role: UserRole): boolean {
  return role === "superuser" || role === "admin";
}

export function canAccessWorkspaceArchitect(role: UserRole): boolean {
  return role === "superuser" || role === "admin";
}

export function canAccessUsersAccess(role: UserRole): boolean {
  return role === "superuser" || role === "admin";
}

export function canManageUsers(role: UserRole): boolean {
  return role === "superuser";
}

export function canAccessRoute(role: UserRole, href: string): boolean {
  if (role === "client_lead") {
    return (
      href === "/" ||
      href === "/companies" ||
      href === "/contacts" ||
      href === "/activities" ||
      href === "/deals" ||
      href === "/projects" ||
      href === "/knowledge"
    );
  }

  if (href === "/analytics" || href.startsWith("/analytics")) {
    return canAccessIntelligenceCenter(role);
  }

  if (href === "/intelligence" || href.startsWith("/intelligence")) {
    return canAccessIntelligenceCenter(role);
  }

  if (href === "/workflows" || href.startsWith("/workflows")) {
    return canAccessIntelligenceCenter(role);
  }

  if (href === "/growth" || href.startsWith("/growth")) {
    return canAccessIntelligenceCenter(role);
  }

  if (href === "/revenue" || href.startsWith("/revenue")) {
    return canAccessIntelligenceCenter(role);
  }

  if (href.startsWith("/administration/assisted-configuration")) {
    return canAccessAssistedConfiguration(role);
  }

  if (href.startsWith("/administration/workspace-architect")) {
    return canAccessWorkspaceArchitect(role);
  }

  if (href.startsWith("/administration/users-access")) {
    return canAccessUsersAccess(role);
  }

  if (href.startsWith("/administration")) {
    return canAccessIntelligenceCenter(role);
  }

  return true;
}

export function canUploadSmartDocs(role: UserRole): boolean {
  return role === "superuser" || role === "commercial" || role === "engineer";
}

export function canManageCommercialPackages(role: UserRole): boolean {
  return role === "superuser" || role === "commercial";
}

export function assertCommercialPackageActionAllowed(role: UserRole): void {
  if (!canManageCommercialPackages(role)) {
    throw new Error(`Role "${role}" cannot manage commercial packages`);
  }
}

export function canAssignDealTeam(role: UserRole): boolean {
  return role === "superuser" || role === "engineer";
}

/** Commercial and delivery users may associate contacts with opportunities and projects. */
export function canManageOpportunityStakeholders(role: UserRole): boolean {
  return role === "superuser" || role === "commercial" || role === "engineer";
}

export function canManageProjectStakeholders(role: UserRole): boolean {
  return canManageOpportunityStakeholders(role);
}

export function canAssignProjectOwner(role: UserRole): boolean {
  return role === "superuser" || role === "commercial";
}

export function canCreateProject(role: UserRole): boolean {
  return canAssignProjectOwner(role);
}

export function canAssignOpportunityOwner(role: UserRole): boolean {
  return role === "superuser" || role === "commercial";
}

export function canCreateOpportunity(role: UserRole): boolean {
  return canAssignOpportunityOwner(role);
}

export function canEditExpectedCloseDate(role: UserRole): boolean {
  return role === "superuser" || role === "commercial";
}

/** Capture answers that drive Gaps / Understanding (not financial ledger fields). */
export function canCaptureOpportunityUnderstanding(role: UserRole): boolean {
  return (
    role === "superuser" ||
    role === "admin" ||
    role === "commercial" ||
    role === "engineer"
  );
}

export function canEditOpportunityValue(role: UserRole): boolean {
  return canWritePipelineField(role, "salesValue");
}

/** @deprecated Use canAssignDealTeam */
export const canAssignProjectTeam = canAssignDealTeam;
