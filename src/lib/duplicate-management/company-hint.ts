import "server-only";

import {
  filterDismissedCompanyClusters,
  findCompanyDuplicateClusters,
  listDismissedCompanyClusterKeys,
} from "@/lib/duplicate-management";
import type { CompanyDuplicateCluster } from "@/lib/duplicate-management";

export type CompanyDuplicateHint = {
  confidence: CompanyDuplicateCluster["confidence"];
  reasons: string[];
  otherNames: string[];
  focus: string;
  managerHref: string;
};

/**
 * FS-020 Phase 2 — if this company sits in an open duplicate cluster, return a compact hint.
 */
export async function loadCompanyDuplicateHint(
  companyKey: string,
): Promise<CompanyDuplicateHint | null> {
  const key = companyKey.trim();
  if (!key) return null;

  try {
    const [clusters, dismissed] = await Promise.all([
      findCompanyDuplicateClusters({ focusCodeOrId: key }),
      listDismissedCompanyClusterKeys(),
    ]);
    const open = filterDismissedCompanyClusters(clusters, dismissed);
    const cluster = open[0];
    if (!cluster) return null;

    const self =
      cluster.members.find(
        (m) =>
          m.id === key ||
          m.code.toLowerCase() === key.toLowerCase() ||
          m.name.toLowerCase() === key.toLowerCase(),
      ) ?? cluster.members[0];

    const others = cluster.members.filter((m) => m.id !== self?.id);
    const focus = self?.code || key;

    return {
      confidence: cluster.confidence,
      reasons: cluster.reasons.map((r) => r.label),
      otherNames: others.map((m) => m.name),
      focus,
      managerHref: `/administration/duplicates?focus=${encodeURIComponent(focus)}`,
    };
  } catch (error) {
    console.warn("[duplicate-hint] failed", error);
    return null;
  }
}
