/**
 * Visual Buying Center — aggregate contacts by buying role + coverage analysis.
 * Reality First: only known contacts; never invent stakeholders.
 */

import { findPrismaCompanyByRouteKey } from "@/lib/data/companies";
import { withPrismaRetry } from "@/lib/prisma";
import {
  mapPrismaContactToApp,
  stableNumericId,
  toContactTrackingId,
} from "@/lib/prisma-mappers";
import { companyRouteKey } from "@/types/company-360";
import type { BuyingRole } from "@/types/contact";
import { getContactDisplayName } from "@/types/contact";
import {
  BUYING_CENTER_KEY_ROLES,
  BUYING_CENTER_ROLE_CODES,
  BUYING_CENTER_ROLE_LABELS,
  type BuyingCenterColumn,
  type BuyingCenterContact,
  type BuyingCenterCoverage,
  type BuyingCenterRoleCode,
  type CompanyBuyingCenter,
} from "@/lib/assistant/buying-center-types";

export type {
  BuyingCenterColumn,
  BuyingCenterContact,
  BuyingCenterCoverage,
  BuyingCenterRoleCode,
  CompanyBuyingCenter,
} from "@/lib/assistant/buying-center-types";
export {
  BUYING_CENTER_KEY_ROLES,
  BUYING_CENTER_ROLE_CODES,
  BUYING_CENTER_ROLE_LABELS,
} from "@/lib/assistant/buying-center-types";

const CODE_ALIASES: Record<string, BuyingCenterRoleCode> = {
  ECONOMIC_BUYER: "ECONOMIC_BUYER",
  "ECONOMIC BUYER": "ECONOMIC_BUYER",
  CHAMPION: "CHAMPION",
  TECHNICAL_EVALUATOR: "TECHNICAL_EVALUATOR",
  "TECHNICAL EVALUATOR": "TECHNICAL_EVALUATOR",
  BLOCKER: "BLOCKER",
  END_USER: "END_USER",
  "END USER": "END_USER",
  UNASSIGNED: "UNASSIGNED",
  // Legacy display / adjacent tags
  "LEGAL/PROCUREMENT": "UNASSIGNED",
  "EXECUTIVE SPONSOR": "ECONOMIC_BUYER",
  EXECUTIVE: "ECONOMIC_BUYER",
};

function primaryEmail(emails: unknown): string {
  if (!Array.isArray(emails)) return "";
  for (const entry of emails) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as { address?: string; isPrimary?: boolean };
    if (row.isPrimary && row.address?.trim()) return row.address.trim();
  }
  for (const entry of emails) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as { address?: string };
    if (row.address?.trim()) return row.address.trim();
  }
  return "";
}

function primaryPhone(phones: unknown): string {
  if (!Array.isArray(phones)) return "";
  for (const entry of phones) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as { number?: string; isPrimary?: boolean };
    if (row.isPrimary && row.number?.trim()) return row.number.trim();
  }
  for (const entry of phones) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as { number?: string };
    if (row.number?.trim()) return row.number.trim();
  }
  return "";
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function scoreFromInfluence(influence: string | null | undefined): number | null {
  if (!influence) return null;
  const lower = influence.toLowerCase();
  if (lower === "high") return 80;
  if (lower === "medium") return 50;
  if (lower === "low") return 25;
  return null;
}

/** Normalize any stored/API role value to a canonical code. */
export function normalizeBuyingCenterRole(
  value: string | null | undefined,
): BuyingCenterRoleCode {
  if (!value?.trim()) return "UNASSIGNED";
  const key = value.trim().replace(/[_-]+/g, " ").replace(/\s+/g, " ").toUpperCase();
  const underscored = value.trim().toUpperCase().replace(/[\s-]+/g, "_");
  return (
    CODE_ALIASES[key] ??
    CODE_ALIASES[underscored] ??
    (BUYING_CENTER_ROLE_CODES.includes(underscored as BuyingCenterRoleCode)
      ? (underscored as BuyingCenterRoleCode)
      : "UNASSIGNED")
  );
}

/** Persist display label compatible with existing Contact.buyingRole UI. */
export function buyingCenterRoleToStorage(
  role: BuyingCenterRoleCode | string,
): BuyingRole | null {
  const code = normalizeBuyingCenterRole(role);
  if (code === "UNASSIGNED") return null;
  return BUYING_CENTER_ROLE_LABELS[code] as BuyingRole;
}

export function clampRelationshipScore(
  value: number | null | undefined,
): number | null {
  if (value == null || Number.isNaN(value)) return null;
  return Math.max(1, Math.min(100, Math.round(value)));
}

function buildCoverage(
  filled: Set<BuyingCenterRoleCode>,
): BuyingCenterCoverage {
  const filledKeyRoles = BUYING_CENTER_KEY_ROLES.filter((role) => filled.has(role));
  const missingKeyRoles = BUYING_CENTER_KEY_ROLES.filter((role) => !filled.has(role));
  const score = Math.round(
    (filledKeyRoles.length / BUYING_CENTER_KEY_ROLES.length) * 100,
  );
  const status = missingKeyRoles.length === 0 ? "complete" : "gaps";
  const statusLabel =
    status === "complete"
      ? "Complete Committee"
      : missingKeyRoles
          .map((role) => `Missing ${BUYING_CENTER_ROLE_LABELS[role]}`)
          .join(" · ");

  return {
    score,
    filledKeyRoles,
    missingKeyRoles,
    status,
    statusLabel,
  };
}

/**
 * Fetch company contacts, group by buying role, compute coverage score.
 */
export async function getCompanyBuyingCenter(
  companyId: string,
): Promise<CompanyBuyingCenter | null> {
  const prismaCompany = await findPrismaCompanyByRouteKey(companyId);
  if (!prismaCompany) return null;

  const contacts = await withPrismaRetry((prisma) =>
    prisma.contact.findMany({
      where: {
        companyId: prismaCompany.id,
        status: "active",
      },
      orderBy: [{ fullName: "asc" }, { createdAt: "asc" }],
    }),
  );

  const companyLookup = {
    Id: stableNumericId(prismaCompany.id),
    Title: prismaCompany.name,
  };

  const mapped: BuyingCenterContact[] = contacts.map((contact) => {
    const app = mapPrismaContactToApp(contact, companyLookup);
    const role = normalizeBuyingCenterRole(contact.buyingRole);
    const score =
      clampRelationshipScore(contact.relationshipScore) ??
      scoreFromInfluence(contact.influenceLevel);
    const displayName = getContactDisplayName(app);

    return {
      contactId: toContactTrackingId(contact.id),
      prismaId: contact.id,
      displayName,
      jobTitle: contact.jobTitle?.trim() || app.JobTitle || "",
      email: primaryEmail(contact.emails) || app.Email || "",
      phone:
        primaryPhone(contact.phoneNumbers) || app.Phone || app.Mobile || "",
      buyingRole: role,
      buyingRoleLabel: BUYING_CENTER_ROLE_LABELS[role],
      relationshipScore: score,
      initials: initialsFromName(displayName),
    };
  });

  const filled = new Set<BuyingCenterRoleCode>();
  const columns: BuyingCenterColumn[] = BUYING_CENTER_ROLE_CODES.map((role) => {
    const columnContacts = mapped.filter((contact) => contact.buyingRole === role);
    if (role !== "UNASSIGNED" && columnContacts.length > 0) {
      filled.add(role);
    }
    return {
      role,
      label: BUYING_CENTER_ROLE_LABELS[role],
      isKeyRole: BUYING_CENTER_KEY_ROLES.includes(role),
      contacts: columnContacts,
    };
  });

  // Key roles filled even if we only count presence
  for (const role of BUYING_CENTER_KEY_ROLES) {
    if (mapped.some((contact) => contact.buyingRole === role)) {
      filled.add(role);
    }
  }

  const routeKey =
    prismaCompany.code?.trim() ||
    companyRouteKey({
      code: prismaCompany.code,
      CompanyID: undefined,
      id: prismaCompany.id,
    }) ||
    prismaCompany.id;

  return {
    companyId: routeKey,
    companyName: prismaCompany.name,
    columns,
    contacts: mapped,
    coverage: buildCoverage(filled),
    totalContacts: mapped.length,
  };
}
