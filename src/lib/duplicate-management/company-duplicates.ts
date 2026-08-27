import "server-only";

import type { CompanyStatus, OpportunityStatus } from "@/generated/prisma";
import { prismaDemoSeedCompanyWhere } from "@/lib/demo-seed-markers";
import { withPrismaRetry } from "@/lib/prisma";
import type {
  CompanyDuplicateCluster,
  CompanyMatchReason,
  DuplicateCompanyMember,
  DuplicateConfidence,
} from "@/lib/duplicate-management/types";
import {
  confidenceRank,
  domainFromEmail,
  domainFromWebsite,
  isPersonalEmailDomain,
  maxConfidence,
  normalizeLegalCompanyName,
  normalizeOrgNumber,
  normalizePhone,
  normalizeVatNumber,
  primaryEmailFromJson,
  primaryPhoneFromJson,
} from "@/lib/duplicate-management/normalize";

type CompanyScanRow = {
  id: string;
  code: string | null;
  name: string;
  types: string[];
  companyType: string | null;
  organizationNumber: string | null;
  vatNumber: string | null;
  website: string | null;
  city: string | null;
  country: string | null;
  ownerId: string | null;
  status: CompanyStatus;
  emails: unknown;
  phoneNumbers: unknown;
  createdAt: Date;
  _count: {
    contacts: number;
    opportunities: number;
  };
  opportunities: { status: OpportunityStatus | string }[];
};

type Edge = {
  a: string;
  b: string;
  reasons: CompanyMatchReason[];
  confidence: DuplicateConfidence;
};

class UnionFind {
  private parent = new Map<string, string>();

  find(id: string): string {
    const current = this.parent.get(id) ?? id;
    if (current === id) {
      this.parent.set(id, id);
      return id;
    }
    const root = this.find(current);
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra === rb) return;
    this.parent.set(rb, ra);
  }
}

function publicCode(row: CompanyScanRow): string {
  return row.code?.trim() || row.id;
}

function typesFor(row: CompanyScanRow): string[] {
  const fromArray = row.types?.filter(Boolean) ?? [];
  if (fromArray.length > 0) return fromArray;
  return row.companyType ? [row.companyType] : [];
}

function survivorshipScore(row: CompanyScanRow): number {
  const openOpps = row.opportunities.filter((o) => o.status === "open").length;
  let score = 0;
  if (normalizeOrgNumber(row.organizationNumber)) score += 40;
  if (domainFromWebsite(row.website)) score += 10;
  if (normalizeVatNumber(row.vatNumber)) score += 8;
  score += openOpps * 12;
  score += row._count.opportunities * 4;
  score += row._count.contacts * 5;
  score += typesFor(row).length * 2;
  // Prefer older established records when tied.
  score += Math.max(0, 5 - Math.floor((Date.now() - row.createdAt.getTime()) / (1000 * 60 * 60 * 24 * 365)));
  return score;
}

function toMember(row: CompanyScanRow): DuplicateCompanyMember {
  const domain = domainFromWebsite(row.website) || null;
  return {
    id: row.id,
    code: publicCode(row),
    name: row.name,
    types: typesFor(row),
    organizationNumber: row.organizationNumber,
    vatNumber: row.vatNumber,
    website: row.website,
    domain,
    city: row.city,
    country: row.country,
    ownerId: row.ownerId,
    status: row.status,
    contactCount: row._count.contacts,
    opportunityCount: row._count.opportunities,
    openOpportunityCount: row.opportunities.filter((o) => o.status === "open").length,
    createdAt: row.createdAt.toISOString(),
    survivorshipScore: survivorshipScore(row),
  };
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

function addReason(
  edgeMap: Map<string, Edge>,
  a: string,
  b: string,
  reason: CompanyMatchReason,
): void {
  if (a === b) return;
  const key = pairKey(a, b);
  const existing = edgeMap.get(key);
  if (!existing) {
    edgeMap.set(key, {
      a: a < b ? a : b,
      b: a < b ? b : a,
      reasons: [reason],
      confidence: reason.confidence,
    });
    return;
  }
  if (!existing.reasons.some((r) => r.code === reason.code)) {
    existing.reasons.push(reason);
  }
  existing.confidence = maxConfidence(existing.confidence, reason.confidence);
}

function indexByKey(
  rows: CompanyScanRow[],
  keyFn: (row: CompanyScanRow) => string | null,
): Map<string, CompanyScanRow[]> {
  const map = new Map<string, CompanyScanRow[]>();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return map;
}

function connectGroups(
  edgeMap: Map<string, Edge>,
  groups: Map<string, CompanyScanRow[]>,
  reasonFor: (value: string) => CompanyMatchReason,
): void {
  for (const [value, members] of groups) {
    if (members.length < 2) continue;
    const reason = reasonFor(value);
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        addReason(edgeMap, members[i]!.id, members[j]!.id, reason);
      }
    }
  }
}

export async function findCompanyDuplicateClusters(options?: {
  focusCodeOrId?: string;
}): Promise<CompanyDuplicateCluster[]> {
  const rows = await withPrismaRetry((prisma) =>
    prisma.company.findMany({
      where: {
        status: "active",
        NOT: prismaDemoSeedCompanyWhere,
      },
      select: {
        id: true,
        code: true,
        name: true,
        types: true,
        companyType: true,
        organizationNumber: true,
        vatNumber: true,
        website: true,
        city: true,
        country: true,
        ownerId: true,
        status: true,
        emails: true,
        phoneNumbers: true,
        createdAt: true,
        _count: {
          select: {
            contacts: { where: { status: "active" } },
            opportunities: true,
          },
        },
        opportunities: { select: { status: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
  );

  const edgeMap = new Map<string, Edge>();

  connectGroups(
    edgeMap,
    indexByKey(rows, (row) => normalizeOrgNumber(row.organizationNumber) || null),
    (value) => ({
      code: "organization_number",
      label: "Same organization number",
      confidence: "certain",
      value,
    }),
  );

  connectGroups(
    edgeMap,
    indexByKey(rows, (row) => normalizeVatNumber(row.vatNumber) || null),
    (value) => ({
      code: "vat_number",
      label: "Same VAT number",
      confidence: "high",
      value,
    }),
  );

  connectGroups(
    edgeMap,
    indexByKey(rows, (row) => domainFromWebsite(row.website) || null),
    (value) => ({
      code: "website_domain",
      label: "Same website domain",
      confidence: "high",
      value,
    }),
  );

  connectGroups(
    edgeMap,
    indexByKey(rows, (row) => {
      const name = normalizeLegalCompanyName(row.name);
      return name.length >= 3 ? name : null;
    }),
    (value) => ({
      code: "normalized_name",
      label: "Same normalized company name",
      confidence: "medium",
      value,
    }),
  );

  connectGroups(
    edgeMap,
    indexByKey(rows, (row) => {
      const email = primaryEmailFromJson(row.emails);
      const domain = domainFromEmail(email);
      if (!domain || isPersonalEmailDomain(domain)) return null;
      return domain;
    }),
    (value) => ({
      code: "email_domain",
      label: "Same company email domain",
      confidence: "medium",
      value,
    }),
  );

  connectGroups(
    edgeMap,
    indexByKey(rows, (row) => {
      const phone = normalizePhone(primaryPhoneFromJson(row.phoneNumbers));
      return phone.length >= 7 ? phone : null;
    }),
    (value) => ({
      code: "phone",
      label: "Same phone number",
      confidence: "medium",
      value,
    }),
  );

  const uf = new UnionFind();
  for (const edge of edgeMap.values()) {
    uf.union(edge.a, edge.b);
  }

  const byRoot = new Map<string, Set<string>>();
  for (const edge of edgeMap.values()) {
    const root = uf.find(edge.a);
    const set = byRoot.get(root) ?? new Set<string>();
    set.add(edge.a);
    set.add(edge.b);
    byRoot.set(root, set);
  }

  const byId = new Map(rows.map((row) => [row.id, row as CompanyScanRow]));
  const clusters: CompanyDuplicateCluster[] = [];

  for (const memberIds of byRoot.values()) {
    if (memberIds.size < 2) continue;
    const memberRows: CompanyScanRow[] = [];
    for (const id of memberIds) {
      const row = byId.get(id);
      if (row) memberRows.push(row as CompanyScanRow);
    }
    const members = memberRows
      .map(toMember)
      .sort((a, b) => b.survivorshipScore - a.survivorshipScore);

    const reasons: CompanyMatchReason[] = [];
    let confidence: DuplicateConfidence = "medium";
    for (const edge of edgeMap.values()) {
      if (!memberIds.has(edge.a) || !memberIds.has(edge.b)) continue;
      confidence = maxConfidence(confidence, edge.confidence);
      for (const reason of edge.reasons) {
        if (!reasons.some((r) => r.code === reason.code && r.value === reason.value)) {
          reasons.push(reason);
        }
      }
    }
    reasons.sort((a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence));

    const suggestedPrimaryId = members[0]!.id;
    clusters.push({
      id: `company-cluster-${members.map((m) => m.code).sort().join("-")}`,
      confidence,
      reasons,
      suggestedPrimaryId,
      members,
    });
  }

  clusters.sort((a, b) => {
    const conf = confidenceRank(b.confidence) - confidenceRank(a.confidence);
    if (conf !== 0) return conf;
    return b.members.length - a.members.length;
  });

  const focus = options?.focusCodeOrId?.trim().toLowerCase();
  if (!focus) return clusters;

  return clusters.filter((cluster) =>
    cluster.members.some(
      (m) =>
        m.id.toLowerCase() === focus ||
        m.code.toLowerCase() === focus ||
        m.name.toLowerCase().includes(focus),
    ),
  );
}
