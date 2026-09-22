import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { canAccessIntelligenceCenter } from "@/lib/permissions";
import { ingestThermalTenders, parseIngestNotices } from "@/lib/tenders/ingest";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const role = await resolveRequestRole(request);
  if (!canAccessIntelligenceCenter(role)) {
    return NextResponse.json({ error: "Insufficient role to ingest tenders" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const notices = parseIngestNotices(body);
  const summary = await ingestThermalTenders(notices);

  return NextResponse.json({
    ok: true,
    ...summary,
  });
}
