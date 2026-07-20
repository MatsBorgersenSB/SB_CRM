import { NextResponse } from "next/server";
import { buildUniversalSearchIndex } from "@/lib/universal-search-index";
import {
  readActivities,
  readCommercialPackages,
  readCompanies,
  readInventory,
  readPipelines,
  readResearchReports,
} from "@/lib/pipeline-db";

export async function GET() {
  const [companies, pipelines, activities, inventory, commercialPackages, researchReports] =
    await Promise.all([
    readCompanies(),
    readPipelines(),
    readActivities(),
    readInventory(),
    readCommercialPackages(),
    readResearchReports(),
  ]);

  const index = buildUniversalSearchIndex(
    companies,
    pipelines,
    activities,
    inventory,
    commercialPackages,
    researchReports,
  );

  return NextResponse.json({
    index,
    meta: { companies, pipelines, activities, commercialPackages },
  });
}
