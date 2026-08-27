import { NextResponse } from "next/server";
import {
  findCompanyDuplicateClusters,
  findPortfolioContactDuplicates,
  filterDismissedCompanyClusters,
  listDismissedCompanyClusterKeys,
} from "@/lib/duplicate-management";
import type { DuplicateScanResult } from "@/lib/duplicate-management";
import { requireAdminRole } from "@/lib/security/require-admin";

export const dynamic = "force-dynamic";

/**
 * FS-020 — scan company + contact duplicate clusters.
 * GET /api/administration/duplicates?focus=Antec&entity=all|company|contact
 */
export async function GET(request: Request) {
  const gate = requireAdminRole(request);
  if ("error" in gate) return gate.error;

  const url = new URL(request.url);
  const focus = url.searchParams.get("focus")?.trim() || undefined;
  const entity = (url.searchParams.get("entity") || "all").toLowerCase();
  const includeDismissed = url.searchParams.get("includeDismissed") === "1";

  try {
    const [rawCompanyClusters, contactPairs, dismissedKeys] = await Promise.all([
      entity === "contact"
        ? Promise.resolve([])
        : findCompanyDuplicateClusters({ focusCodeOrId: focus }),
      entity === "company"
        ? Promise.resolve([])
        : findPortfolioContactDuplicates(),
      listDismissedCompanyClusterKeys(),
    ]);

    const companyClusters = includeDismissed
      ? rawCompanyClusters
      : filterDismissedCompanyClusters(rawCompanyClusters, dismissedKeys);

    const payload: DuplicateScanResult = {
      generatedAt: new Date().toISOString(),
      companies: {
        clusterCount: companyClusters.length,
        certainCount: companyClusters.filter((c) => c.confidence === "certain")
          .length,
        highCount: companyClusters.filter((c) => c.confidence === "high").length,
        mediumCount: companyClusters.filter((c) => c.confidence === "medium")
          .length,
        clusters: companyClusters,
      },
      contacts: {
        pairCount: contactPairs.length,
        pairs: contactPairs,
      },
    };

    return NextResponse.json(payload);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Duplicate scan failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
