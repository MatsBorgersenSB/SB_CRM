import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { pullAndIngestThermalTenders } from "@/lib/tenders/pull";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Pull pyrolysis/torrefaction notices from TED (always), plus Doffin/SAM/Mercell when keys exist.
 * Protected by CRON_SECRET (Bearer or x-cron-secret).
 */
async function runTenderIngest() {
  const summary = await pullAndIngestThermalTenders();
  return NextResponse.json({
    ok: true,
    ...summary,
  });
}

export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  try {
    return await runTenderIngest();
  } catch (error) {
    console.error("[cron tender-ingest GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Tender ingest failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  try {
    return await runTenderIngest();
  } catch (error) {
    console.error("[cron tender-ingest POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Tender ingest failed" },
      { status: 500 },
    );
  }
}
