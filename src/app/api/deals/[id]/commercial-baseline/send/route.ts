import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { buildDealCommercialBaselineView } from "@/lib/commercial-baseline-engine";
import { sendQuotationPackage } from "@/lib/commercial-package-actions";
import { assertCommercialPackageActionAllowed } from "@/lib/permissions";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";
import type { SendQuotationInput } from "@/types/commercial-package-input";
import {
  readLiveActivities,
  readLiveCommercialPackages,
  readLiveCompanies,
  readLivePipelines,
} from "@/lib/prisma-data";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const role = getRequestRole(request);

  try {
    assertCommercialPackageActionAllowed(role);
    const body = (await request.json()) as SendQuotationInput;

    if (!body.quotationPackageId?.trim() || !body.recipient?.trim()) {
      return NextResponse.json(
        { error: "quotationPackageId and recipient are required" },
        { status: 400 },
      );
    }

    await sendQuotationPackage(id, body.quotationPackageId, body.recipient);

    const [pipelines, packages, activities, companies] = await Promise.all([
      readLivePipelines(),
      readLiveCommercialPackages(),
      readLiveActivities(),
      readLiveCompanies(),
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
