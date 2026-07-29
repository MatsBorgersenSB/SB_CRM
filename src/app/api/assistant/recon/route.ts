import { NextResponse } from "next/server";
import { getAccountReconBrief } from "@/lib/assistant/web-recon";

/**
 * GET /api/assistant/recon?companyId=CO-1001
 * Returns cached or freshly generated recon brief.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId")?.trim();
  const domain = url.searchParams.get("domain")?.trim() || undefined;
  const companyName = url.searchParams.get("companyName")?.trim() || undefined;
  const refresh = url.searchParams.get("refresh") === "1";

  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  try {
    const brief = await getAccountReconBrief(companyId, {
      forceRefresh: refresh,
      domain,
      companyName,
    });
    return NextResponse.json({ brief });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load recon brief";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
