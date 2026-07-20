import { NextResponse } from "next/server";
import { createResearchReport, readResearchReports } from "@/lib/pipeline-db";
import type { DeepResearchBriefing } from "@/types/deep-research";

export async function GET() {
  const reports = await readResearchReports();
  return NextResponse.json({ reports });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      briefing: DeepResearchBriefing;
      generatedBy?: string;
      companyId?: string;
      dealId?: string;
      contactId?: string;
    };

    if (!body.briefing) {
      return NextResponse.json({ error: "briefing is required" }, { status: 400 });
    }

    const report = await createResearchReport(body.briefing, {
      generatedBy: body.generatedBy ?? "SmartAssist",
      companyId: body.companyId,
      dealId: body.dealId,
      contactId: body.contactId,
    });

    return NextResponse.json({ report });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create report" },
      { status: 500 },
    );
  }
}
