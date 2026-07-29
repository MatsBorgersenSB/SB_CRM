import { NextResponse } from "next/server";
import {
  evaluateAccountNudges,
  evaluatePortfolioNudges,
} from "@/lib/assistant/nudge-engine";

/**
 * GET /api/assistant/nudges?companyId=CO-1001
 * GET /api/assistant/nudges  (portfolio summary for account overview)
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId")?.trim();
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : undefined;

  try {
    const nudges = companyId
      ? await evaluateAccountNudges(companyId)
      : await evaluatePortfolioNudges(
          Number.isFinite(limit) && (limit as number) > 0 ? (limit as number) : 8,
        );

    return NextResponse.json({ nudges });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to evaluate nudges";
    return NextResponse.json({ error: message, nudges: [] }, { status: 500 });
  }
}
