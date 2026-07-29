/**
 * Company 360 — single relationship hub (Phase 4D.3).
 * Contacts, opportunities, documents, and intelligence live on one page.
 */

import type { NextBestAction } from "@/lib/next-best-action-engine";

export const COMPANY_360_TABS = ["overview"] as const;

export type Company360Tab = (typeof COMPANY_360_TABS)[number];

/** Legacy ?tab= URLs redirect to overview with section anchors. */
const LEGACY_TAB_ALIASES: Record<string, Company360Tab> = {
  activities: "overview",
  contacts: "overview",
  people: "overview",
  deals: "overview",
  documents: "overview",
  pipeline: "overview",
  materials: "overview",
  graph: "overview",
  intelligence: "overview",
};

export type Company360TabDefinition = {
  id: Company360Tab;
  label: string;
  description: string;
};

export const COMPANY_360_TAB_DEFINITIONS: Company360TabDefinition[] = [
  {
    id: "overview",
    label: "Overview",
    description: "Company details, contacts, opportunities, and intelligence in one view.",
  },
];

export type RelationshipIntelligenceExtensions = {
  healthScore?: number;
  nextBestAction?: NextBestAction;
  recommendedAction?: NextBestAction;
  aiNextBestAction?: string;
  riskSignals?: string[];
  aiSummary?: string;
  dealIntelligence?: string[];
  meetingIntelligence?: string[];
};

export type Company360Context = {
  companyId: string;
  activeTab: Company360Tab;
  extensions: RelationshipIntelligenceExtensions;
};

export function emptyCompany360Extensions(): RelationshipIntelligenceExtensions {
  return {};
}

export function isCompany360Tab(value: string): value is Company360Tab {
  return (COMPANY_360_TABS as readonly string[]).includes(value);
}

export function resolveCompany360Tab(value: string | null | undefined): Company360Tab {
  if (!value || value === "overview") return "overview";
  if (isCompany360Tab(value)) return value;
  return LEGACY_TAB_ALIASES[value] ?? "overview";
}

/** Prefer persisted code, then CompanyID, then numeric/list id. */
export function companyRouteKey(
  company: { code?: string | null; CompanyID?: string; id?: string | number },
): string {
  const code = company.code?.trim();
  if (code) return code;
  const tracking = company.CompanyID?.trim();
  if (tracking) return tracking;
  if (company.id != null && String(company.id).trim()) return String(company.id).trim();
  return "";
}

export function company360Href(
  companyOrId:
    | string
    | { code?: string | null; CompanyID?: string; id?: string | number },
  section?: Company360Section,
): string {
  const raw =
    typeof companyOrId === "string" ? companyOrId.trim() : companyRouteKey(companyOrId);
  const base = `/companies/${encodeURIComponent(raw)}`;
  if (!section) return base;
  return `${base}#${section}`;
}

/** In-page sections on the relationship hub. */
export type Company360Section =
  | "contacts"
  | "opportunities"
  | "activities"
  | "documents"
  | "attention"
  | "decisions";
