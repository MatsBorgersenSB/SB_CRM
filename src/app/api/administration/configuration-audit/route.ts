import { requireAdminRole } from "@/lib/security/require-admin";
import { NextResponse } from "next/server";
import { buildConfigurationSnapshot } from "@/lib/assisted-configuration-engine";
import {
  readLiveActivities,
  readLiveCommercialPackages,
  readLiveCompanies,
  readLivePipelines,
} from "@/lib/prisma-data";

export async function GET(request: Request) {
  const gate = requireAdminRole(request);
  if ("error" in gate) return gate.error;

  const [companies, pipelines, activities, commercialPackages] = await Promise.all([
    readLiveCompanies(),
    readLivePipelines(),
    readLiveActivities(),
    readLiveCommercialPackages(),
  ]);

  const snapshot = buildConfigurationSnapshot({
    companies,
    pipelines,
    activities,
    commercialPackages,
  });

  return NextResponse.json(snapshot);
}
