import { NextResponse } from "next/server";
import { findNicheGatheringChannels } from "@/lib/marketing/channel-radar";

/**
 * GET /api/marketing/niche-channels?companyId=...
 * Returns sector-matched biochar/pyrolysis channels for an account.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("companyId")?.trim();

  if (!companyId) {
    return NextResponse.json(
      { error: "companyId query parameter is required" },
      { status: 400 },
    );
  }

  try {
    const result = await findNicheGatheringChannels(companyId);

    if (result.channels.length === 0 && result.companyName === companyId) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    return NextResponse.json({ result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to evaluate niche channels";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
