import { NextResponse } from "next/server";
import { loadCorrespondenceEvidenceByCompanyId } from "@/lib/company-correspondence-data";
import { buildUniversalSearchIndex } from "@/lib/universal-search-index";
import {
  readLiveFocusContext,
  readLiveInventory,
  readLiveResearchReports,
  readLiveSmartDocsLibrary,
} from "@/lib/prisma-data";
import { listPendingTenders } from "@/lib/tenders/queries";

/**
 * Global Search / Ask index — same live portfolio as Contacts / Company 360.
 * Includes SmartDocs, mail correspondence, and open tenders as knowledge.
 */
export async function GET() {
  const [focus, inventory, researchReports] = await Promise.all([
    readLiveFocusContext(),
    readLiveInventory(),
    readLiveResearchReports(),
  ]);

  const [correspondenceByCompanyId, smartDocs, tenders] = await Promise.all([
    loadCorrespondenceEvidenceByCompanyId(focus.companies, { take: 100 }).catch(
      () => new Map(),
    ),
    readLiveSmartDocsLibrary().catch(() => []),
    listPendingTenders({ take: 20 }).catch(() => []),
  ]);

  const index = buildUniversalSearchIndex(
    focus.companies,
    focus.pipelines,
    focus.activities,
    inventory,
    focus.commercialPackages,
    researchReports,
    { correspondenceByCompanyId, smartDocs, tenders },
  );

  return NextResponse.json({
    index,
    meta: {
      companies: focus.companies,
      pipelines: focus.pipelines,
      activities: focus.activities,
      commercialPackages: focus.commercialPackages,
      source: focus.source,
    },
  });
}
