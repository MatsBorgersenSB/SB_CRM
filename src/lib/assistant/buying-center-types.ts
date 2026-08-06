/** Buying Center types & labels — safe for client components. */

export type BuyingCenterRoleCode =
  | "ECONOMIC_BUYER"
  | "CHAMPION"
  | "TECHNICAL_EVALUATOR"
  | "BLOCKER"
  | "END_USER"
  | "UNASSIGNED";

export const BUYING_CENTER_ROLE_CODES: BuyingCenterRoleCode[] = [
  "ECONOMIC_BUYER",
  "CHAMPION",
  "TECHNICAL_EVALUATOR",
  "BLOCKER",
  "END_USER",
  "UNASSIGNED",
];

/** Roles required for a "complete committee" coverage score. */
export const BUYING_CENTER_KEY_ROLES: BuyingCenterRoleCode[] = [
  "ECONOMIC_BUYER",
  "CHAMPION",
  "TECHNICAL_EVALUATOR",
];

export const BUYING_CENTER_ROLE_LABELS: Record<BuyingCenterRoleCode, string> = {
  ECONOMIC_BUYER: "Economic Buyer",
  CHAMPION: "Champion",
  TECHNICAL_EVALUATOR: "Technical Evaluator",
  BLOCKER: "Blocker",
  END_USER: "End User",
  UNASSIGNED: "Unassigned",
};

export type BuyingCenterContact = {
  contactId: string;
  prismaId: string;
  displayName: string;
  jobTitle: string;
  email: string;
  phone: string;
  buyingRole: BuyingCenterRoleCode;
  buyingRoleLabel: string;
  relationshipScore: number | null;
  initials: string;
};

export type BuyingCenterColumn = {
  role: BuyingCenterRoleCode;
  label: string;
  isKeyRole: boolean;
  contacts: BuyingCenterContact[];
};

export type BuyingCenterCoverage = {
  score: number;
  filledKeyRoles: BuyingCenterRoleCode[];
  missingKeyRoles: BuyingCenterRoleCode[];
  status: "complete" | "gaps";
  statusLabel: string;
};

export type CompanyBuyingCenter = {
  companyId: string;
  companyName: string;
  columns: BuyingCenterColumn[];
  contacts: BuyingCenterContact[];
  coverage: BuyingCenterCoverage;
  totalContacts: number;
};
