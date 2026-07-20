import { NextResponse } from "next/server";
import { buildConfigurationSnapshot } from "@/lib/assisted-configuration-engine";
import {
  readActivities,
  readCommercialPackages,
  readCompanies,
  readPipelines,
} from "@/lib/pipeline-db";

export async function GET() {
  const [companies, pipelines, activities, commercialPackages] = await Promise.all([
    readCompanies(),
    readPipelines(),
    readActivities(),
    readCommercialPackages(),
  ]);

  const snapshot = buildConfigurationSnapshot({
    companies,
    pipelines,
    activities,
    commercialPackages,
  });

  return NextResponse.json(snapshot);
}
