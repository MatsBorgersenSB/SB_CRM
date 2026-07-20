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
  const query = companyId ? `?company=${encodeURIComponent(companyId)}` : "";
  const hash = section ? `#${section}` : "";
  return `${base}${query}${hash}`;
}

/** Deal / Opportunity 360. */
export function deal360Href(
  dealId: string,
  tab?: Deal360Tab,
  options?: { packageId?: string },
): string {
  const params = new URLSearchParams();
  if (tab) params.set("tab", tab);
  if (options?.packageId) params.set("package", options.packageId);
  const query = params.toString();
  const base = `/deals/${encodeURIComponent(dealId)}`;
  return query ? `${base}?${query}` : base;
}

/** Project Workspace Light — coordinated effort toward a defined outcome. */
export function project360Href(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}`;
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
