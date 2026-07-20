/**
 * Enterprise permission tiers — aligned with SharePoint security groups.
 */
export type UserRole =
  | "superuser"
  | "admin"
  | "commercial"
  | "engineer"
  | "client_lead";

export type AuthUser = {
  /** SharePoint user / person field ID */
  id: number;
  displayName: string;
  role: UserRole;
  /** Required for client_lead — maps to Company.CompanyID */
  companyId?: string;
};

export const USER_ROLES: UserRole[] = [
  "superuser",
  "admin",
  "commercial",
  "engineer",
  "client_lead",
];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  superuser: "IT Admin (Superuser)",
  admin: "Executive / C-Suite",
  commercial: "Sales / Account Manager",
  engineer: "Deployment / Plant Engineer",
  client_lead: "External Client Lead",
};

export const USER_ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  superuser:
    "Full schema control, data overrides, and SharePoint field provisioning.",
  admin:
    "Executive dashboard, macro KPIs, and read-only financial/operational ledgers.",
  commercial:
    "Read/write on financial fields; read-only on engineering metrics.",
  engineer:
    "Read/write on mechanical and commissioning fields; read-only on financials.",
  client_lead:
    "Read-only portal scoped to own company assets and sanitized SmartDocs.",
};

export const DEFAULT_AUTH_USER: AuthUser = {
  id: 1,
  displayName: "Mats Borgersen",
  role: "superuser",
};

export function isUserRole(value: string): value is UserRole {
  return USER_ROLES.includes(value as UserRole);
}
