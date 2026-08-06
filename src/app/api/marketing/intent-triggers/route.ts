import { NextResponse } from "next/server";
import { evaluateAccountIntentTriggers } from "@/lib/marketing/intent-radar";

/**
 * GET /api/marketing/intent-triggers?companyId=CO-1001
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId")?.trim();

  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  try {
    const triggers = await evaluateAccountIntentTriggers(companyId);
    return NextResponse.json({ triggers });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to evaluate intent triggers";
    return NextResponse.json({ error: message, triggers: [] }, { status: 500 });
  }
}
