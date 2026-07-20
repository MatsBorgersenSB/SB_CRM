import growthSeed from "@/data/growth-intelligence.json";
import {
  CONFIG_DOMAIN_RESOLUTION,
  ensureActionableResolution,
} from "@/lib/assistant-actionability";
import { hasCompanyOwner } from "@/lib/company-owner";
import { resolveOpportunityOwner } from "@/lib/opportunity-owner";
import { applySignalBudget } from "@/lib/signal-extraction";
import {
  ASSISTED_CONFIGURATION,
  SMARTASSIST_KNOWLEDGE_SOURCES,
  SMARTASSIST_RESEARCH_EXTERNAL_SOURCES,
  SMARTASSIST_RESEARCH_INTERNAL_SOURCES,
  SMARTCRM_PLATFORM_CONSTITUTION,
} from "@/lib/smart-assist-config";
import { getSharePointEnvironment } from "@/services/sharepoint/config/environment";
import { USER_ROLE_DESCRIPTIONS, USER_ROLE_LABELS, USER_ROLES } from "@/types/auth";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type {
  ConfigGapSeverity,
  ConfigRecommendation,
  ConfigurationDomain,
  ConfigurationDomainStatus,
  ConfigurationSnapshot,
  WorkspaceArchitectureLayer,
} from "@/types/assisted-configuration";
import { CONFIGURATION_DOMAIN_LABELS } from "@/types/assisted-configuration";

const CONFIG_RECOMMENDATION_BUDGET = 5;

type ConfigurationAuditInput = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  commercialPackages: CommercialPackage[];
};

function severityRank(severity: ConfigGapSeverity): number {
  if (severity === "critical") return 0;
  if (severity === "warning") return 1;
  return 2;
}

function buildRecommendation(
  partial: Omit<ConfigRecommendation, "domainLabel" | "href" | "resolutionLabel"> & {
    domain: ConfigurationDomain;
    href?: string;
    resolutionLabel?: string;
  },
): ConfigRecommendation {
  const domainDefault = CONFIG_DOMAIN_RESOLUTION[partial.domain];
  const withPath = ensureActionableResolution(
    {
      ...partial,
      href: partial.href ?? domainDefault.href,
      resolutionLabel: partial.resolutionLabel ?? domainDefault.label,
    },
    domainDefault,
  );
  return {
    ...withPath,
    domainLabel: CONFIGURATION_DOMAIN_LABELS[partial.domain],
  };
}

function scoreFromIssues(critical: number, warning: number, totalChecks: number): number {
  if (totalChecks === 0) return 100;
  const penalty = critical * 35 + warning * 15;
  return Math.max(0, Math.min(100, Math.round(100 - penalty / totalChecks)));
}

function buildRoleRecommendations(input: ConfigurationAuditInput): ConfigRecommendation[] {
  const recommendations: ConfigRecommendation[] = [];
  const { companies, pipelines } = input;
  const activeDeals = input.pipelines.filter(
    (deal) => deal.status !== "Live Production" && deal.status !== "Scheduled Maintenance",
  );

  if (companies.length >= 4 && activeDeals.length >= 2) {
    recommendations.push(
      buildRecommendation({
        id: "roles-commercial-coverage",
        domain: "roles",
        title: "Assign commercial account managers to active portfolio",
        what: "Your CRM has enough companies and live opportunities to justify dedicated commercial roles.",
        why: `${companies.length} companies and ${activeDeals.length} active opportunities need day-to-day relationship ownership beyond IT administration.`,
        impact:
          "Without commercial roles, follow-ups, quotations and deal progression depend on a single superuser.",
        nextAction:
          `Map ${USER_ROLE_LABELS.commercial} users to company owners and opportunity owners in SharePoint security groups.`,
        expectedOutcome:
          "Each account has a named commercial owner; SmartAssist routes attention to the right person.",
        severity: companies.length >= 8 ? "critical" : "warning",
        confidencePercent: 88,
        href: "/administration/users-access",
        resolutionLabel: "Assign commercial roles in Users & Access",
      }),
    );
  }

  if (activeDeals.some((deal) => deal.status === "Live Production" || deal.currentMilestone)) {
    recommendations.push(
      buildRecommendation({
        id: "roles-engineer-delivery",
        domain: "roles",
        title: "Enable deployment engineers on live opportunities",
        what: "Production-stage deals need engineering visibility separate from commercial ownership.",
        why: "Engineering fields (capacity, feedstock, milestone) should be owned by plant/deployment staff.",
        impact: "Commercial-only access creates handoff friction during manufacturing and commissioning.",
        nextAction: `Provision ${USER_ROLE_LABELS.engineer} access for delivery teams on active reactor projects.`,
        expectedOutcome:
          "Engineers update technical fields; commercial users retain financial and probability control.",
        severity: "warning",
        confidencePercent: 82,
        href: "/administration/users-access",
        resolutionLabel: "Provision engineer access in Users & Access",
      }),
    );
  }

  if (companies.length >= 3) {
    recommendations.push(
      buildRecommendation({
        id: "roles-executive-visibility",
        domain: "roles",
        title: "Grant executive read access for portfolio oversight",
        what: "Leadership needs macro KPI visibility without schema control.",
        why: USER_ROLE_DESCRIPTIONS.admin,
        impact: "Executives cannot monitor pipeline health without superuser credentials.",
        nextAction: `Assign ${USER_ROLE_LABELS.admin} to C-suite stakeholders for intelligence and revenue views.`,
        expectedOutcome: "Executive dashboard and KPIs available without configuration risk.",
        severity: "warning",
        confidencePercent: 76,
        href: "/intelligence",
        resolutionLabel: "Open Intelligence for executive views",
      }),
    );
  }

  return recommendations;
}

function buildPermissionRecommendations(input: ConfigurationAuditInput): ConfigRecommendation[] {
  const recommendations: ConfigRecommendation[] = [];
  const prospectCount = input.companies.filter((company) => company.Status === "Prospecting").length;

  if (prospectCount >= 3) {
    recommendations.push(
      buildRecommendation({
        id: "permissions-commercial-status",
        domain: "permissions",
        title: "Let commercial users advance prospect status",
        what: "Prospecting companies need status updates as relationships mature.",
        why: `${prospectCount} companies are still in Prospecting — only superusers can change company status today.`,
        impact: "Commercial teams must ask IT for every qualification step, slowing BD velocity.",
        nextAction: "Confirm commercial role can write company Status in SharePoint field permissions.",
        expectedOutcome: "Account managers qualify prospects without administrative bottlenecks.",
        severity: "warning",
        confidencePercent: 84,
        href: "/administration/users-access",
        resolutionLabel: "Review commercial permissions",
      }),
    );
  }

  recommendations.push(
    buildRecommendation({
      id: "permissions-deal-team",
      domain: "permissions",
      title: "Restrict deal team assignment to engineering leads",
      what: "Deal team changes affect delivery accountability and should not be open to all roles.",
      why: "Engineering and superuser roles already gate deal team assignment — verify this matches org policy.",
      impact: "Loose permissions create silent ownership drift on complex reactor projects.",
      nextAction: "Audit SharePoint groups so only superuser and engineer roles assign deal teams.",
      expectedOutcome: "Delivery accountability stays with technical leads.",
      severity: "healthy",
      confidencePercent: 90,
      href: "/administration/users-access",
      resolutionLabel: "Audit deal team permissions",
    }),
  );

  return recommendations.filter((item) => item.severity !== "healthy");
}

function buildOwnershipRecommendations(input: ConfigurationAuditInput): ConfigRecommendation[] {
  const recommendations: ConfigRecommendation[] = [];
  const unownedCompanies = input.companies.filter((company) => !hasCompanyOwner(company));

  if (unownedCompanies.length > 0) {
    recommendations.push(
      buildRecommendation({
        id: "ownership-company-gaps",
        domain: "ownership",
        title: "Assign company owners to incomplete accounts",
        what: `${unownedCompanies.length} compan${unownedCompanies.length === 1 ? "y has" : "ies have"} no internal owner.`,
        why: "Every company must have exactly one accountable relationship owner.",
        impact: "SmartAssist cannot route follow-ups, alerts or recommendations without ownership.",
        nextAction: "Open each company and assign a Standard Bio user as Company Owner.",
        expectedOutcome: "100% company ownership — relationship accountability is explicit.",
        severity: "critical",
        confidencePercent: 97,
        href: `/companies/${unownedCompanies[0]!.CompanyID}`,
        resolutionLabel: "Assign company owner now",
      }),
    );
  }

  const dealsMissingOwner = input.pipelines.filter((pipeline) => {
    const company = input.companies.find((record) => record.pipelineIds.includes(pipeline.id));
    return !resolveOpportunityOwner(pipeline, company)?.Title;
  });

  if (dealsMissingOwner.length > 0) {
    recommendations.push(
      buildRecommendation({
        id: "ownership-opportunity-gaps",
        domain: "ownership",
        title: "Set opportunity owners on open deals",
        what: `${dealsMissingOwner.length} opportunit${dealsMissingOwner.length === 1 ? "y lacks" : "ies lack"} a named owner.`,
        why: "Opportunity owners inherit from company owners when unset — gaps mean both are missing.",
        impact: "Pipeline alerts and quotation follow-ups have no accountable recipient.",
        nextAction: "Assign opportunity owners on deal headers or fix company ownership first.",
        expectedOutcome: "Every open opportunity routes notifications to a responsible commercial lead.",
        severity: "critical",
        confidencePercent: 94,
        href: dealsMissingOwner[0] ? `/deals/${dealsMissingOwner[0].id}` : "/deals",
        resolutionLabel: "Assign opportunity owner now",
      }),
    );
  }

  return recommendations;
}

function buildIntegrationRecommendations(): ConfigRecommendation[] {
  const recommendations: ConfigRecommendation[] = [];
  const env = getSharePointEnvironment();

  if (env.transport === "local") {
    recommendations.push(
      buildRecommendation({
        id: "integrations-sharepoint-local",
        domain: "integrations",
        title: "Connect SharePoint Graph transport for production",
        what: "SmartCRM is running on local demo transport instead of Microsoft Graph.",
        why: "Production BD workspaces need live SharePoint lists, SmartDocs and M365 context.",
        impact: "Knowledge capture, document intelligence and Teams meeting briefings stay disconnected.",
        nextAction: "Set SHAREPOINT_TRANSPORT=graph and configure AZURE_TENANT_ID + SHAREPOINT_SITE_ID.",
        expectedOutcome: "CRM reads and writes real SharePoint data; M365 integrations activate.",
        severity: "warning",
        confidencePercent: 91,
      }),
    );
  } else if (!env.siteId.trim() || !env.tenantId.trim()) {
    recommendations.push(
      buildRecommendation({
        id: "integrations-sharepoint-incomplete",
        domain: "integrations",
        title: "Complete SharePoint site configuration",
        what: "Graph transport is selected but tenant or site identifiers are missing.",
        why: "Without site and tenant IDs, list provisioning and SmartDocs sync cannot run.",
        impact: "Integrations appear enabled but API calls will fail silently in admin workflows.",
        nextAction: "Populate SHAREPOINT_SITE_ID and AZURE_TENANT_ID in environment configuration.",
        expectedOutcome: "SharePoint-backed knowledge sources connect reliably.",
        severity: "critical",
        confidencePercent: 95,
      }),
    );
  }

  recommendations.push(
    buildRecommendation({
      id: "integrations-m365-surfaces",
      domain: "integrations",
      title: "Deploy M365 relationship surfaces for daily focus",
      what: "Outlook and Teams add-ins extend SmartAssist into email and meetings.",
      why: "Business development happens in M365 — CRM intelligence should meet users there.",
      impact: "Users fall back to manual CRM updates without in-context relationship cards.",
      nextAction: "Review M365 preview workspace and deploy daily focus + meeting briefing add-ins.",
      expectedOutcome: "SmartAssist guides users inside Outlook and Teams, not only in the browser.",
      severity: "warning",
      confidencePercent: 78,
      href: "/m365-preview",
      resolutionLabel: "Configure M365 integrations",
    }),
  );

  return recommendations;
}

function buildKnowledgeSourceRecommendations(input: ConfigurationAuditInput): ConfigRecommendation[] {
  const recommendations: ConfigRecommendation[] = [];
  const hasActivities = input.activities.length > 0;
  const hasDocuments = input.commercialPackages.length > 0;
  const env = getSharePointEnvironment();
  const graphReady = env.transport === "graph" && Boolean(env.siteId.trim());

  const inactiveSources: string[] = [];
  if (!hasActivities) inactiveSources.push("Activities");
  if (!hasDocuments) inactiveSources.push("Quotations");
  if (!graphReady) inactiveSources.push("SharePoint");

  if (inactiveSources.length > 0) {
    recommendations.push(
      buildRecommendation({
        id: "knowledge-source-gaps",
        domain: "knowledge_sources",
        title: "Activate dormant knowledge sources",
        what: `Catalog declares ${SMARTASSIST_KNOWLEDGE_SOURCES.length} sources — ${inactiveSources.length} are not yet contributing data.`,
        why: `Missing signal from: ${inactiveSources.join(", ")}.`,
        impact: "SmartAssist recommendations lack context — answers become generic instead of org-specific.",
        nextAction: "Log activities, upload commercial packages, and connect SharePoint document libraries.",
        expectedOutcome: "Knowledge graph covers CRM, activities, documents and SharePoint together.",
        severity: inactiveSources.includes("SharePoint") ? "warning" : "warning",
        confidencePercent: 86,
        href: "/knowledge",
        resolutionLabel: "Activate knowledge sources",
      }),
    );
  }

  if (input.companies.every((company) => company.contacts.length === 0)) {
    recommendations.push(
      buildRecommendation({
        id: "knowledge-contacts-empty",
        domain: "knowledge_sources",
        title: "Build contact coverage across accounts",
        what: "No contacts are linked to companies in the CRM.",
        why: "Contacts are a primary knowledge source for relationship intelligence and outreach.",
        impact: "Activity routing, email discovery and stakeholder mapping cannot function.",
        nextAction: "Run Quick Import or Website Discovery on priority accounts.",
        expectedOutcome: "Contact graph enables SmartAssist relationship and outreach recommendations.",
        severity: "critical",
        confidencePercent: 92,
        href: "/companies",
        resolutionLabel: "Import contacts on companies",
      }),
    );
  }

  return recommendations;
}

function buildIntelligenceSourceRecommendations(input: ConfigurationAuditInput): ConfigRecommendation[] {
  const recommendations: ConfigRecommendation[] = [];
  const competitorCount = Object.keys(
    (growthSeed as { competitorProfiles?: Record<string, unknown> }).competitorProfiles ?? {},
  ).length;
  const eventCount = (growthSeed as { events?: unknown[] }).events?.length ?? 0;
  const hasGrowthRoutes = competitorCount > 0 && eventCount > 0;

  if (!hasGrowthRoutes) {
    recommendations.push(
      buildRecommendation({
        id: "intelligence-growth-seed",
        domain: "intelligence_sources",
        title: "Load growth intelligence baseline",
        what: "Competitive landscape and event planning seeds are empty or incomplete.",
        why: "Growth Intelligence powers market positioning, event BD and competitor tracking.",
        impact: "Strategic recommendations fall back to CRM-only signals.",
        nextAction: "Seed growth-intelligence.json with competitors, events and market shifts.",
        expectedOutcome: "Growth dashboard surfaces strategic pulse alongside CRM operations.",
        severity: "warning",
        confidencePercent: 80,
        href: "/growth",
        resolutionLabel: "Open Growth Intelligence",
      }),
    );
  } else {
    const missingCompetitors =
      (growthSeed as { potentialMissingCompetitors?: unknown[] }).potentialMissingCompetitors
        ?.length ?? 0;

    if (missingCompetitors > 0) {
      recommendations.push(
        buildRecommendation({
          id: "intelligence-competitor-gaps",
          domain: "intelligence_sources",
          title: "Register missing competitors in CRM",
          what: `${missingCompetitors} potential competitor${missingCompetitors === 1 ? "" : "s"} flagged in intelligence seed but not in CRM.`,
          why: "Competitive intelligence requires both market seed data and CRM company records.",
          impact: "Win/loss analysis and displacement strategy lack a complete competitor set.",
          nextAction: "Review Growth Intelligence competitor gaps and add or link CRM records.",
          expectedOutcome: "Competitive landscape workspace covers known and emerging rivals.",
          severity: "warning",
          confidencePercent: 85,
          href: "/growth/competitors",
          resolutionLabel: "Review competitor gaps",
        }),
      );
    }
  }

  const internalCount = SMARTASSIST_RESEARCH_INTERNAL_SOURCES.length;
  const externalCount = SMARTASSIST_RESEARCH_EXTERNAL_SOURCES.length;

  recommendations.push(
    buildRecommendation({
      id: "intelligence-research-coverage",
      domain: "intelligence_sources",
      title: "Align deep research with declared source catalog",
      what: `SmartAssist declares ${internalCount} internal and ${externalCount} external research sources.`,
      why: `${input.companies.filter((c) => c.Domain?.trim()).length} companies have websites suitable for external research enrichment.`,
      impact: "Under-used research sources mean missed trigger events and market signals.",
      nextAction: "Run Website Discovery on key accounts and enable deep research on strategic prospects.",
      expectedOutcome: "Internal CRM knowledge merges with external market intelligence automatically.",
      severity: "warning",
      confidencePercent: 79,
      href: "/intelligence",
      resolutionLabel: "Run deep research on accounts",
    }),
  );

  return recommendations;
}

function summarizeDomain(
  domain: ConfigurationDomain,
  items: ConfigRecommendation[],
): ConfigurationDomainStatus {
  const domainItems = items.filter((item) => item.domain === domain);
  const critical = domainItems.filter((item) => item.severity === "critical").length;
  const warning = domainItems.filter((item) => item.severity === "warning").length;
  const score = scoreFromIssues(critical, warning, Math.max(domainItems.length, 1));

  let summary = "Configured and contributing to the BD workspace.";
  if (critical > 0) {
    summary = `${critical} critical gap${critical === 1 ? "" : "s"} — relationship or integration risk.`;
  } else if (warning > 0) {
    summary = `${warning} improvement${warning === 1 ? "" : "s"} recommended for optimal guidance.`;
  }

  return {
    domain,
    label: CONFIGURATION_DOMAIN_LABELS[domain],
    summary,
    healthy: critical === 0 && warning === 0,
    score,
    recommendationCount: domainItems.length,
  };
}

function readinessLabel(score: number): string {
  if (score >= 90) return "Workspace architecture aligned";
  if (score >= 70) return "Architecture nearly complete — review recommendations";
  if (score >= 50) return "Architecture evolving — guided setup recommended";
  return "Architecture incomplete — workspace guidance limited";
}

function buildArchitectureLayers(input: ConfigurationAuditInput): WorkspaceArchitectureLayer[] {
  const { companies, pipelines, activities, commercialPackages } = input;
  const env = getSharePointEnvironment();
  const contactCount = companies.reduce((sum, company) => sum + company.contacts.length, 0);
  const linkedDeals = companies.reduce((sum, company) => sum + company.pipelineIds.length, 0);
  const ownedCount = companies.filter((company) => hasCompanyOwner(company)).length;
  const metadataRich = companies.filter(
    (company) => company.Industry && (company.Tags?.length ?? 0) > 0,
  ).length;
  const graphReady = env.transport === "graph" && Boolean(env.siteId.trim());

  return [
    {
      id: "entities",
      label: "Entities",
      summary: `${companies.length} companies · ${contactCount} contacts · ${pipelines.length} opportunities`,
      healthy: companies.length > 0 && contactCount > 0,
    },
    {
      id: "relationships",
      label: "Relationships",
      summary: `${ownedCount}/${companies.length} owned accounts · ${linkedDeals} company–deal links`,
      healthy: ownedCount === companies.length && linkedDeals > 0,
    },
    {
      id: "metadata",
      label: "Metadata",
      summary: `${metadataRich} accounts with industry and tags · ${USER_ROLES.length} role tiers defined`,
      healthy: metadataRich >= Math.floor(companies.length / 2),
    },
    {
      id: "permissions",
      label: "Permissions",
      summary: "Role-based access for commercial, engineering, executive and client portal tiers",
      healthy: true,
    },
    {
      id: "integrations",
      label: "Integrations",
      summary: graphReady
        ? "SharePoint Graph connected · M365 surfaces available"
        : "Local demo transport — connect SharePoint Graph for production",
      healthy: graphReady,
    },
    {
      id: "storage",
      label: "Storage structures",
      summary: `${activities.length} activities · ${commercialPackages.length} commercial packages · SharePoint lists`,
      healthy: activities.length > 0 || commercialPackages.length > 0,
    },
  ];
}

export function buildConfigurationSnapshot(input: ConfigurationAuditInput): ConfigurationSnapshot {
  const allRecommendations = [
    ...buildRoleRecommendations(input),
    ...buildPermissionRecommendations(input),
    ...buildOwnershipRecommendations(input),
    ...buildIntegrationRecommendations(),
    ...buildKnowledgeSourceRecommendations(input),
    ...buildIntelligenceSourceRecommendations(input),
  ].sort((a, b) => {
    const severityDiff = severityRank(a.severity) - severityRank(b.severity);
    if (severityDiff !== 0) return severityDiff;
    return b.confidencePercent - a.confidencePercent;
  });

  const recommendations = applySignalBudget(allRecommendations, CONFIG_RECOMMENDATION_BUDGET);
  const domains: ConfigurationDomain[] = [
    "roles",
    "permissions",
    "ownership",
    "integrations",
    "knowledge_sources",
    "intelligence_sources",
  ];

  const domainStatuses = domains.map((domain) => summarizeDomain(domain, allRecommendations));
  const readinessScore = Math.round(
    domainStatuses.reduce((sum, status) => sum + status.score, 0) / domainStatuses.length,
  );

  const primary = recommendations[0];
  const unownedCount = input.companies.filter((company) => !hasCompanyOwner(company)).length;
  const ownedCount = input.companies.length - unownedCount;

  const architectureLayers = buildArchitectureLayers(input);

  return {
    generatedAt: new Date().toISOString(),
    readinessScore,
    readinessLabel: readinessLabel(readinessScore),
    primaryGap: primary?.what ?? "Workspace architecture is aligned with current business needs.",
    primaryAction:
      primary?.nextAction ?? "Review architecture layers and confirm alignment with business goals.",
    primaryActionHref: primary?.href,
    objective: ASSISTED_CONFIGURATION.objective,
    platformSummary: SMARTCRM_PLATFORM_CONSTITUTION.platformRole,
    architectureLayers,
    domains: domainStatuses,
    recommendations,
    vitals: [
      { label: "Architecture", value: `${readinessScore}%`, highlight: readinessScore < 70 },
      { label: "Company ownership", value: `${ownedCount}/${input.companies.length}` },
      { label: "Active deals", value: String(input.pipelines.length) },
      { label: "Role tiers", value: String(USER_ROLES.length) },
      {
        label: "SharePoint",
        value: getSharePointEnvironment().transport === "graph" ? "Graph" : "Local demo",
        highlight: getSharePointEnvironment().transport === "local",
      },
    ],
  };
}
