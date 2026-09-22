import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { canAccessIntelligenceCenter } from "@/lib/permissions";
import { listPendingTenders } from "@/lib/tenders/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const role = await resolveRequestRole(request);
  if (!canAccessIntelligenceCenter(role)) {
    return NextResponse.json({ error: "Insufficient role to view tenders" }, { status: 403 });
  }

  const url = new URL(request.url);
  const takeRaw = Number(url.searchParams.get("take") ?? "");
  const take = Number.isFinite(takeRaw) && takeRaw > 0 ? Math.min(50, Math.floor(takeRaw)) : undefined;

  const tenders = await listPendingTenders({ take });
  return NextResponse.json({ tenders });
}
