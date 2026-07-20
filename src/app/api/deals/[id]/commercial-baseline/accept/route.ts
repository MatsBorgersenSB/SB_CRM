import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { buildDealCommercialBaselineView } from "@/lib/commercial-baseline-engine";
import { acceptTransmissionPackage } from "@/lib/commercial-package-actions";
import { assertCommercialPackageActionAllowed } from "@/lib/permissions";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";
import type { AcceptTransmissionInput } from "@/types/commercial-package-input";
import {
  readActivities,
  readCommercialPackages,
  readCompanies,
  readPipelines,
} from "@/lib/pipeline-db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const role = getRequestRole(request);

  try {
    assertCommercialPackageActionAllowed(role);
    const body = (await request.json().catch(() => ({}))) as AcceptTransmissionInput;

    await acceptTransmissionPackage(id, body.transmissionPackageId);

    const [pipelines, packages, activities, companies] = await Promise.all([
      readPipelines(),
      readCommercialPackages(),
      readActivities(),
      readCompanies(),
    ]);

    const pipeline = pipelines.find((row) => row.id === id);
    if (!pipeline) {
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    }

    const view = buildDealCommercialBaselineView(
      pipeline,
      packages,
      activities,
      companies,
    );

    return NextResponse.json(view);
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
