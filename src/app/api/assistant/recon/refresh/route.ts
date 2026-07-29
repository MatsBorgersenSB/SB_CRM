import { NextResponse } from "next/server";
import { generateAccountReconBrief } from "@/lib/assistant/web-recon";

type RefreshBody = {
  companyId?: string;
  domain?: string;
  companyName?: string;
};

/**
 * POST /api/assistant/recon/refresh
 * Triggers a fresh website scan and updates the recon cache.
 */
export async function POST(request: Request) {
  let body: RefreshBody;
  try {
    body = (await request.json()) as RefreshBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const companyId = body.companyId?.trim();
  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  try {
    const brief = await generateAccountReconBrief(
      companyId,
      body.domain?.trim() || undefined,
      body.companyName?.trim() || undefined,
    );
    return NextResponse.json({ brief, refreshed: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to refresh recon brief";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
