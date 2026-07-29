import { NextResponse } from "next/server";
import {
  generateMicroCampaign,
  type MicroCampaignType,
} from "@/lib/marketing/thought-leadership";

type GenerateBody = {
  companyId?: string;
  campaignType?: MicroCampaignType;
  targetRole?: string;
};

const ALLOWED_TYPES = new Set<MicroCampaignType>([
  "LINKEDIN_POST",
  "COLD_OUTREACH_SEQUENCE",
  "SOLUTION_BRIEF",
]);

/**
 * POST /api/marketing/generate-campaign
 * Body: { companyId, campaignType, targetRole? }
 */
export async function POST(request: Request) {
  let body: GenerateBody;
  try {
    body = (await request.json()) as GenerateBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const companyId = body.companyId?.trim();
  const campaignType = body.campaignType;

  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }
  if (!campaignType || !ALLOWED_TYPES.has(campaignType)) {
    return NextResponse.json(
      {
        error:
          "campaignType must be LINKEDIN_POST | COLD_OUTREACH_SEQUENCE | SOLUTION_BRIEF",
      },
      { status: 400 },
    );
  }

  try {
    const campaign = await generateMicroCampaign(companyId, {
      campaignType,
      targetRole: body.targetRole?.trim() || undefined,
    });

    if (campaign.generatedAssets.length === 0 && campaign.title === "Company not found") {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({ campaign });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate campaign";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
