import { NextResponse } from "next/server";
import { buildDealCommercialBaselineView } from "@/lib/commercial-baseline-engine";
import {
  readActivities,
  readCommercialPackages,
  readCompanies,
  readPipelines,
} from "@/lib/pipeline-db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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
}
