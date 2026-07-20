import type { UserRole } from "@/types/auth";

export type BusinessFunction =
  | "Sales"
  | "Marketing"
  | "Management"
  | "Engineering"
  | "Service"
  | "Administration";

export const BUSINESS_FUNCTIONS: BusinessFunction[] = [
  "Sales",
  "Marketing",
  "Management",
  "Engineering",
  "Service",
  "Administration",
];

export type UserTeam =
  | "Commercial"
  | "Engineering"
  | "Executive"
  | "Service"
  | "IT";

export const USER_TEAMS: UserTeam[] = [
  "Commercial",
  "Engineering",
  "Executive",
  "Service",
  "IT",
];

export type UserLicense =
  | "SmartCRM Standard"
  | "SmartCRM Professional"
  | "SmartCRM Intelligence";

export const USER_LICENSES: UserLicense[] = [
  "SmartCRM Standard",
  "SmartCRM Professional",
  "SmartCRM Intelligence",
];

export type UserStatus = "active" | "disabled" | "inactive" | "archived";

export type OwnedEntityRef = {
  id: string;
  label: string;
  href?: string;
};

export type UserOwnershipAnalysis = {
  userId: number;
  displayName: string;
  ownedCompanies: OwnedEntityRef[];
  ownedContacts: OwnedEntityRef[];
  ownedOpportunities: OwnedEntityRef[];
  ownedActivities: OwnedEntityRef[];
  ownedDocuments: OwnedEntityRef[];
  openCommitments: OwnedEntityRef[];
  totalRecords: number;
  hasOwnership: boolean;
  canDelete: boolean;
  deleteBlockedReason?: string;
};

export type SuccessorRecommendation = {
  user: Pick<
    StandardBioUserRecord,
    "id" | "userId" | "displayName" | "role" | "team" | "businessFunction"
  >;
  confidencePercent: number;
  rationale: string;
  factors: {
    teamMatch: boolean;
    roleMatch: boolean;
    territoryOverlap: number;
    relationshipScore: number;
    workloadScore: number;
    opportunityOverlap: number;
  };
};

export type TransferRiskLevel = "low" | "medium" | "high";

export type OwnershipTransferPreview = {
  currentOwner: Pick<StandardBioUserRecord, "id" | "displayName" | "userId">;
  suggestedNewOwner: SuccessorRecommendation | null;
  selectedNewOwner: Pick<StandardBioUserRecord, "id" | "displayName" | "userId"> | null;
  riskLevel: TransferRiskLevel;
  riskAssessment: string;
  affectedRecords: {
    companies: number;
    contacts: number;
    opportunities: number;
    activities: number;
    documents: number;
    openCommitments: number;
  };
  previewChanges: Array<{
    entityType: string;
    entityId: string;
    entityLabel: string;
    field: string;
    from: string;
    to: string;
  }>;
  successorRecommendations: SuccessorRecommendation[];
};

export type OwnershipTransferResult = {
  transferred: OwnershipTransferPreview["affectedRecords"];
  fromUserId: number;
  toUserId: number;
  completedAt: string;
};

export type ReplaceUserInput = {
  toUserId: number;
  archiveDeparting?: boolean;
};

export type OwnershipScope = "global" | "portfolio" | "company" | "none";

export type StandardBioUserRecord = {
  id: number;
  userId: string;
  displayName: string;
  email: string;
  role: UserRole | null;
  businessFunction: BusinessFunction | null;
  team: UserTeam;
  license: UserLicense;
  status: UserStatus;
  ownershipScope: OwnershipScope;
  ownedCompanyIds: string[];
  lastActiveAt: string | null;
  createdAt: string;
};

export type CreateUserInput = {
  displayName: string;
  email: string;
  role?: UserRole | null;
  businessFunction?: BusinessFunction | null;
  team?: UserTeam;
  license?: UserLicense;
  ownershipScope?: OwnershipScope;
  ownedCompanyIds?: string[];
};

export type UpdateUserInput = Partial<
  Pick<
    StandardBioUserRecord,
    | "displayName"
    | "email"
    | "role"
    | "businessFunction"
    | "team"
    | "license"
    | "status"
    | "ownershipScope"
    | "ownedCompanyIds"
    | "lastActiveAt"
  >
>;

export type AccessRecommendation = {
  role: UserRole;
  roleLabel: string;
  permissionsSummary: string;
  ownershipScope: OwnershipScope;
  ownershipScopeLabel: string;
  team: UserTeam;
  license: UserLicense;
  rationale: string;
  confidencePercent: number;
};

export type UserAccessGapSeverity = "critical" | "warning";

export type UserAccessGap = {
  id: string;
  category:
    | "users_without_roles"
    | "companies_without_owners"
    | "opportunities_without_owners"
    | "activities_without_owners"
    | "excessive_permissions"
    | "inactive_users"
    | "orphaned_records"
    | "ownership_requires_transfer";
  categoryLabel: string;
  title: string;
  /** @deprecated use why — kept for migration */
  what?: string;
  why: string;
  impact: string;
  recommendedAction: string;
  /** @deprecated use recommendedAction */
  correctiveAction?: string;
  severity: UserAccessGapSeverity;
  /** Direct resolution path — every gap must have one. */
  href: string;
  resolutionLabel: string;
  entityId?: string;
};

export type UsersAccessAudit = {
  generatedAt: string;
  gaps: UserAccessGap[];
  summary: string;
  primaryAction: string;
  primaryActionHref?: string;
};
