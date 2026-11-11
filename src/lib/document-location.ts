/**
 * Document location continuity — where the user opened a document from,
 * and how to get them back to that workspace's Documents surface.
 *
 * Query shape (Michelin):
 *   ?from=company&companyId=CO-1009
 *   ?from=contact&contactId=CT-1&companyId=CO-1009
 *   ?from=opportunity&dealId=PL-123
 *   ?from=project&projectId=PRJ-X
 */

import { company360Href } from "@/types/company-360";
import { smartDocHref } from "@/types/smartdoc";
import { documentSet360Href } from "@/types/document-set";

/** Mirrors relationship-navigation document deep links — kept local to avoid import cycles. */
function contactDocumentsHref(contactId: string, companyId?: string): string {
  const base = `/contacts/${encodeURIComponent(contactId)}`;
  const params = new URLSearchParams();
  if (companyId) params.set("company", companyId);
  const query = params.toString();
  return `${base}${query ? `?${query}` : ""}#documents`;
}

function dealDocumentsHref(dealId: string): string {
  return `/opportunities/${encodeURIComponent(dealId)}?view=actions&action=documents`;
}

function projectDocumentsHref(projectId: string): string {
  return `/projects/${encodeURIComponent(projectId)}?view=actions&action=documents`;
}

export type DocumentLocationScope =
  | "company"
  | "contact"
  | "opportunity"
  | "project";

export type DocumentLocationFrom = {
  scope: DocumentLocationScope;
  companyId?: string;
  contactId?: string;
  dealId?: string;
  projectId?: string;
};

export type WorkspaceDocumentsLocationInput = {
  scope: DocumentLocationScope;
  companyId?: string;
  contactId?: string;
  dealId?: string;
  projectId?: string;
};

const SCOPES = new Set<DocumentLocationScope>([
  "company",
  "contact",
  "opportunity",
  "project",
]);

function trimId(value: string | null | undefined): string | undefined {
  const next = value?.trim();
  return next || undefined;
}

export function isDocumentLocationScope(
  value: string | null | undefined,
): value is DocumentLocationScope {
  return Boolean(value && SCOPES.has(value as DocumentLocationScope));
}

/** Read `from` + id params from a URLSearchParams / query object. */
export function parseDocumentLocationFrom(
  params: URLSearchParams | Record<string, string | string[] | undefined | null>,
): DocumentLocationFrom | null {
  const get = (key: string): string | undefined => {
    if (params instanceof URLSearchParams) {
      return trimId(params.get(key));
    }
    const raw = params[key];
    if (Array.isArray(raw)) return trimId(raw[0]);
    return trimId(raw ?? undefined);
  };

  const scope = get("from");
  if (!isDocumentLocationScope(scope)) return null;

  const companyId = get("companyId") ?? get("fromCompany");
  const contactId = get("contactId") ?? get("fromContact");
  const dealId = get("dealId") ?? get("fromDeal");
  const projectId = get("projectId") ?? get("fromProject");

  if (scope === "company" && !companyId) return null;
  if (scope === "contact" && !contactId) return null;
  if (scope === "opportunity" && !dealId) return null;
  if (scope === "project" && !projectId) return null;

  return { scope, companyId, contactId, dealId, projectId };
}

/** Build location from a workspace documents context (open-from panel). */
export function documentLocationFromWorkspace(
  context: WorkspaceDocumentsLocationInput,
): DocumentLocationFrom | null {
  switch (context.scope) {
    case "company":
      return context.companyId
        ? { scope: "company", companyId: context.companyId }
        : null;
    case "contact":
      return context.contactId
        ? {
            scope: "contact",
            contactId: context.contactId,
            companyId: context.companyId,
          }
        : null;
    case "opportunity":
      return context.dealId
        ? {
            scope: "opportunity",
            dealId: context.dealId,
            companyId: context.companyId,
          }
        : null;
    case "project":
      return context.projectId
        ? {
            scope: "project",
            projectId: context.projectId,
            companyId: context.companyId,
            dealId: context.dealId,
          }
        : null;
    default:
      return null;
  }
}

/** Append `from` query params to a document / document-set href. */
export function withDocumentLocationFrom(
  href: string,
  from: DocumentLocationFrom | null | undefined,
): string {
  if (!from) return href;
  const url = new URL(href, "https://smartcrm.local");
  url.searchParams.set("from", from.scope);
  if (from.companyId) url.searchParams.set("companyId", from.companyId);
  if (from.contactId) url.searchParams.set("contactId", from.contactId);
  if (from.dealId) url.searchParams.set("dealId", from.dealId);
  if (from.projectId) url.searchParams.set("projectId", from.projectId);
  return `${url.pathname}${url.search}${url.hash}`;
}

export function documentHrefWithLocation(
  documentId: string,
  from?: DocumentLocationFrom | null,
): string {
  return withDocumentLocationFrom(smartDocHref(documentId), from);
}

export function documentSetHrefWithLocation(
  setId: string,
  from?: DocumentLocationFrom | null,
): string {
  return withDocumentLocationFrom(documentSet360Href(setId), from);
}

/**
 * Return to the Documents surface the user came from.
 * Falls back to owner documents when `from` is missing.
 */
export function documentLocationReturnHref(
  from: DocumentLocationFrom | null | undefined,
  fallback?: {
    ownershipKind?: "company" | "opportunity" | "project" | string;
    companyId?: string | null;
    dealId?: string | null;
    projectId?: string | null;
  },
): string {
  if (from?.scope === "contact" && from.contactId) {
    return contactDocumentsHref(from.contactId, from.companyId);
  }
  if (from?.scope === "company" && from.companyId) {
    return company360Href(from.companyId, "documents");
  }
  if (from?.scope === "opportunity" && from.dealId) {
    return dealDocumentsHref(from.dealId);
  }
  if (from?.scope === "project" && from.projectId) {
    return projectDocumentsHref(from.projectId);
  }

  if (fallback?.ownershipKind === "project" && fallback.projectId) {
    return projectDocumentsHref(fallback.projectId);
  }
  if (fallback?.ownershipKind === "company" && fallback.companyId) {
    return company360Href(fallback.companyId, "documents");
  }
  if (fallback?.dealId) {
    return dealDocumentsHref(fallback.dealId);
  }
  if (fallback?.companyId) {
    return company360Href(fallback.companyId, "documents");
  }
  return "/knowledge";
}

export type DocumentLocationTrail = {
  /** Short back label, e.g. "Back to DorsetGM · Documents" */
  backLabel: string;
  href: string;
  /** Scope chip: Company / Contact / Opportunity / Project */
  scopeLabel: string;
  /** Ownership line when different from viewing scope */
  ownershipLabel?: string;
};

const SCOPE_LABELS: Record<DocumentLocationScope, string> = {
  company: "Company",
  contact: "Contact",
  opportunity: "Opportunity",
  project: "Project",
};

/**
 * Build the sticky trail. Prefer explicit names from the page; fall back to
 * generic scope nouns — never invent company/deal names.
 */
export function buildDocumentLocationTrail(input: {
  from: DocumentLocationFrom | null | undefined;
  labels?: {
    companyName?: string | null;
    contactName?: string | null;
    dealName?: string | null;
    projectName?: string | null;
  };
  ownershipKind?: "company" | "opportunity" | "project" | string | null;
  fallback?: {
    companyId?: string | null;
    dealId?: string | null;
    projectId?: string | null;
  };
}): DocumentLocationTrail {
  const { from, labels, ownershipKind, fallback } = input;
  const href = documentLocationReturnHref(from, {
    ownershipKind: ownershipKind ?? undefined,
    companyId: from?.companyId ?? fallback?.companyId,
    dealId: from?.dealId ?? fallback?.dealId,
    projectId: from?.projectId ?? fallback?.projectId,
  });

  const scope: DocumentLocationScope | "knowledge" = from?.scope ??
    (ownershipKind === "project"
      ? "project"
      : ownershipKind === "company"
        ? "company"
        : ownershipKind === "opportunity"
          ? "opportunity"
          : "knowledge");

  const subject =
    scope === "contact"
      ? labels?.contactName?.trim() || "Contact"
      : scope === "company"
        ? labels?.companyName?.trim() || "Company"
        : scope === "opportunity"
          ? labels?.dealName?.trim() || "Opportunity"
          : scope === "project"
            ? labels?.projectName?.trim() || "Project"
            : "Knowledge";

  const scopeLabel =
    scope === "knowledge" ? "Knowledge" : SCOPE_LABELS[scope];

  let ownershipLabel: string | undefined;
  if (
    from?.scope === "contact" &&
    (ownershipKind === "company" || ownershipKind === "opportunity")
  ) {
    const ownerName =
      ownershipKind === "opportunity"
        ? labels?.dealName?.trim()
        : labels?.companyName?.trim();
    ownershipLabel = ownerName
      ? `Owned by ${ownershipKind === "opportunity" ? "opportunity" : "company"} · ${ownerName}`
      : `Owned by ${ownershipKind}`;
  } else if (
    from &&
    ownershipKind &&
    ownershipKind !== from.scope &&
    ownershipKind !== "opportunity" &&
    !(from.scope === "opportunity" && ownershipKind === "opportunity")
  ) {
    // Viewing from project/company while ownership differs — only when useful.
    if (
      (from.scope === "opportunity" || from.scope === "project") &&
      ownershipKind === "company"
    ) {
      const ownerName = labels?.companyName?.trim();
      ownershipLabel = ownerName
        ? `Company knowledge · ${ownerName}`
        : "Company knowledge";
    }
  }

  return {
    backLabel: `Back to ${subject} · Documents`,
    href,
    scopeLabel,
    ownershipLabel,
  };
}
