import type { ActivityWorkspaceContext } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import { isQuotationKind } from "@/types/commercial-package";
import { company360Href } from "@/types/company-360";
import { documentSet360Href } from "@/types/document-set";
import { smartDocHref } from "@/types/smartdoc";

export type Deal360Tab =
  | "intelligence"
  | "commercial"
  | "documents"
  | "overview"
  | "activities";

export type Contact360Section =
  | "reach"
  | "attention"
  | "opportunities"
  | "timeline"
  | "master";

/** Contact 360 — living relationship workspace. */
export function contact360Href(
  contactId: string,
  companyId?: string,
  section?: Contact360Section,
): string {
  const base = `/contacts/${encodeURIComponent(contactId)}`;
  const params = new URLSearchParams();
  if (companyId) params.set("company", companyId);
  if (section === "opportunities") params.set("view", "work");
  else if (section === "timeline") params.set("view", "actions");
  else if (section === "attention" || section === "reach") params.set("view", "overview");
  else if (section === "master") params.set("view", "overview");
  const query = params.toString();
  return `${base}${query ? `?${query}` : ""}`;
}

/** Opportunity list — canonical path. `/deals` redirects here. */
export const OPPORTUNITY_LIST_HREF = "/opportunities";

/** Deal / Opportunity 360 — canonical path is `/opportunities/{id}`. `/deals/{id}` redirects. */
export function deal360Href(
  dealId: string,
  tab?: Deal360Tab,
  options?: { packageId?: string },
): string {
  const params = new URLSearchParams();
  if (tab) params.set("tab", tab);
  if (options?.packageId) params.set("package", options.packageId);
  const query = params.toString();
  const base = `/opportunities/${encodeURIComponent(dealId)}`;
  return query ? `${base}?${query}` : base;
}

/** Associated SmartDocs for this opportunity — last action on every mission-control view. */
export function dealDocumentsHref(dealId: string): string {
  return `/opportunities/${encodeURIComponent(dealId)}?view=actions&action=documents`;
}

/** Read an opportunity id from either canonical or legacy `/deals/` hrefs. */
export function parseDealIdFromHref(href: string | undefined | null): string | undefined {
  if (!href) return undefined;
  const match = href.match(/\/(?:opportunities|deals)\/([^/?#]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

export function hrefTouchesOpportunity(href: string, dealId: string): boolean {
  const encoded = encodeURIComponent(dealId);
  return (
    href.includes(`/opportunities/${dealId}`) ||
    href.includes(`/opportunities/${encoded}`) ||
    href.includes(`/deals/${dealId}`) ||
    href.includes(`/deals/${encoded}`)
  );
}

/** Project Workspace Light — coordinated effort toward a defined outcome. */
export function project360Href(
  projectId: string,
  options?: { view?: string },
): string {
  const base = `/projects/${encodeURIComponent(projectId)}`;
  if (options?.view) {
    return `${base}?view=${encodeURIComponent(options.view)}`;
  }
  return base;
}

export function projectEmailsHref(projectId: string): string {
  return project360Href(projectId, { view: "emails" });
}

/** Associated SmartDocs for this project — last action on every mission-control view. */
export function projectDocumentsHref(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}?view=actions&action=documents`;
}

export function contactDocumentsHref(contactId: string, companyId?: string): string {
  return `${contact360Href(contactId, companyId)}#documents`;
}

/**
 * Documents for the current workspace — opportunity, then project, then person, then company.
 */
export function workspaceDocumentsHref(
  context: Pick<
    ActivityWorkspaceContext,
    "dealId" | "projectId" | "contactId" | "companyId"
  >,
): string | null {
  if (context.dealId) return dealDocumentsHref(context.dealId);
  if (context.projectId) return projectDocumentsHref(context.projectId);
  if (context.contactId) return contactDocumentsHref(context.contactId, context.companyId);
  if (context.companyId) return company360Href(context.companyId, "documents");
  return null;
}

export function companyHref(companyId: string) {
  return company360Href(companyId);
}

export function documentHref(documentId: string) {
  return smartDocHref(documentId);
}

export function documentSetHref(setId: string) {
  return documentSet360Href(setId);
}

/** Transmission, baseline, and quotation packages → document set or deal commercial tab. */
export function commercialPackageHref(pkg: CommercialPackage): string {
  if (pkg.DocumentSetID && (isQuotationKind(pkg.kind) || pkg.kind === "execution")) {
    return documentSet360Href(pkg.DocumentSetID);
  }

  if (pkg.kind === "transmission" || pkg.kind === "commercial_baseline") {
    return deal360Href(pkg.DealId, "commercial", { packageId: pkg.PackageID });
  }

  if (pkg.DocumentSetID) {
    return documentSet360Href(pkg.DocumentSetID);
  }

  return deal360Href(pkg.DealId, "commercial", { packageId: pkg.PackageID });
}
