export type ConfigurationDomain =
  | "roles"
  | "permissions"
  | "ownership"
  | "integrations"
  | "knowledge_sources"
  | "intelligence_sources";

export type ConfigGapSeverity = "critical" | "warning" | "healthy";

export type ConfigRecommendation = {
  id: string;
  domain: ConfigurationDomain;
  domainLabel: string;
  title: string;
  what: string;
  why: string;
  impact: string;
  nextAction: string;
  expectedOutcome: string;
  severity: ConfigGapSeverity;
  confidencePercent: number;
  /** Direct resolution path — every recommendation must have one. */
  href: string;
  resolutionLabel: string;
};

export type ConfigurationDomainStatus = {
  domain: ConfigurationDomain;
  label: string;
  summary: string;
  healthy: boolean;
  score: number;
  recommendationCount: number;
};

export type WorkspaceArchitectureLayer = {
  id: string;
  label: string;
  summary: string;
  healthy: boolean;
};

export type ConfigurationSnapshot = {
  generatedAt: string;
  readinessScore: number;
  readinessLabel: string;
  primaryGap: string;
  primaryAction: string;
  primaryActionHref?: string;
  objective: string;
  platformSummary: string;
  architectureLayers: WorkspaceArchitectureLayer[];
  domains: ConfigurationDomainStatus[];
  recommendations: ConfigRecommendation[];
  vitals: Array<{ label: string; value: string; highlight?: boolean }>;
};

export const CONFIGURATION_DOMAIN_LABELS: Record<ConfigurationDomain, string> = {
  roles: "Roles",
  permissions: "Permissions",
  ownership: "Ownership",
  integrations: "Integrations",
  knowledge_sources: "Knowledge Sources",
  intelligence_sources: "Intelligence Sources",
};
