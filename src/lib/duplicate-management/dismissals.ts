import "server-only";

import { getPrisma } from "@/lib/prisma";
import {
  normalizeCoPilotUserEmail,
  recordCoPilotDismissal,
} from "@/lib/smartassist-copilot-dismissals";
import type { CompanyDuplicateCluster } from "@/lib/duplicate-management/types";

export const COMPANY_CLUSTER_DISMISS_PREFIX = "fs020-company-cluster:";
export const DUPLICATE_MANAGER_DISMISS_ACTOR = "duplicate-manager@system";

/** Stable key from member UUIDs — independent of display codes. */
export function companyClusterDismissKey(memberIds: string[]): string {
  const sorted = [...memberIds].map((id) => id.trim()).filter(Boolean).sort();
  return `${COMPANY_CLUSTER_DISMISS_PREFIX}${sorted.join("|")}`;
}

export function clusterDismissKeyFromCluster(
  cluster: Pick<CompanyDuplicateCluster, "members">,
): string {
  return companyClusterDismissKey(cluster.members.map((m) => m.id));
}

/** Tenant-wide suppressions for FS-020 (not per-user). */
export async function listDismissedCompanyClusterKeys(): Promise<string[]> {
  try {
    const prisma = getPrisma();
    const rows = await prisma.coPilotDismissal.findMany({
      where: { suggestionKey: { startsWith: COMPANY_CLUSTER_DISMISS_PREFIX } },
      select: { suggestionKey: true },
    });
    return [...new Set(rows.map((row) => row.suggestionKey))];
  } catch (error) {
    console.warn("[duplicate-dismissals] list failed", error);
    return [];
  }
}

export async function dismissCompanyCluster(input: {
  memberIds: string[];
  note?: string;
  companyId?: string;
  userEmail?: string | null;
  userDisplayName?: string | null;
}): Promise<{ suggestionKey: string }> {
  const suggestionKey = companyClusterDismissKey(input.memberIds);
  if (!suggestionKey.startsWith(COMPANY_CLUSTER_DISMISS_PREFIX) || input.memberIds.length < 2) {
    throw new Error("A cluster with at least two companies is required to dismiss.");
  }

  await recordCoPilotDismissal({
    suggestionKey,
    note: (input.note?.trim() || "Not the same company").slice(0, 500),
    companyId: input.companyId,
    actionKind: "company_duplicate",
    // Persist under system actor so suppressions are shared for all admins.
    userEmail: DUPLICATE_MANAGER_DISMISS_ACTOR,
    userDisplayName:
      input.userDisplayName?.trim() ||
      normalizeCoPilotUserEmail(input.userEmail) ||
      "Duplicate Manager",
  });

  return { suggestionKey };
}

export function filterDismissedCompanyClusters(
  clusters: CompanyDuplicateCluster[],
  dismissedKeys: string[],
): CompanyDuplicateCluster[] {
  if (dismissedKeys.length === 0) return clusters;
  const dismissed = new Set(dismissedKeys);
  return clusters.filter(
    (cluster) => !dismissed.has(clusterDismissKeyFromCluster(cluster)),
  );
}
