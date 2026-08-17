import { NextResponse } from "next/server";
import { buildUniversalSearchIndex } from "@/lib/universal-search-index";
import { readLiveFocusContext, readLiveInventory, readLiveResearchReports } from "@/lib/prisma-data";

/**
 * Global Search / Ask index — same live portfolio as Contacts / Company 360.
 * Never build from JSON seed alone when Prisma holds the registry (Halvor bug).
 */
export async function GET() {
  const [focus, inventory, researchReports] = await Promise.all([
    readLiveFocusContext(),
    readLiveInventory(),
    readLiveResearchReports(),
  ]);

  const index = buildUniversalSearchIndex(
    focus.companies,
    focus.pipelines,
    focus.activities,
    inventory,
    focus.commercialPackages,
    researchReports,
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
