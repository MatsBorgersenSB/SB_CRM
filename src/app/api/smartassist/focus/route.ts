import { NextResponse } from "next/server";
import { buildSmartAssistFocus } from "@/lib/smart-assist-engine";
import {
  readActivities,
  readCommercialPackages,
  readCompanies,
  readPipelines,
} from "@/lib/pipeline-db";
import { DEFAULT_AUTH_USER } from "@/types/auth";

export async function GET() {
  const [companies, pipelines, activities, commercialPackages] = await Promise.all([
    readCompanies(),
    readPipelines(),
    readActivities(),
    readCommercialPackages(),
  ]);

  const focus = buildSmartAssistFocus(
    companies,
    pipelines,
    activities,
    commercialPackages,
    DEFAULT_AUTH_USER,
  );

  return NextResponse.json({
    focus,
    meta: { companies, pipelines, activities, commercialPackages },
  });
}
