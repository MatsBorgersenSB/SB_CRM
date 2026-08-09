import { NextResponse } from "next/server";
import { assertCronAuthorized } from "@/lib/cron-auth";
import { syncAllConnectedMailboxes } from "@/lib/m365/mail-delta-ingest";

/**
 * Poll Microsoft Graph inbox delta for all connected M365 integrations.
 * Protected by CRON_SECRET (Bearer or x-cron-secret).
 */
async function runMailSync() {
  const summary = await syncAllConnectedMailboxes();
  const ok = summary.results.filter((row) => row.status === "ok").length;
  const errors = summary.results.filter((row) => row.status === "error").length;
  return NextResponse.json({
    ok: true,
    integrations: summary.integrations,
    synced: ok,
    errors,
    results: summary.results,
  });
}

export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  try {
    return await runMailSync();
  } catch (error) {
    console.error("[cron m365-mail-sync GET]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mail sync failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  try {
    return await runMailSync();
  } catch (error) {
    console.error("[cron m365-mail-sync POST]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mail sync failed" },
      { status: 500 },
    );
  }
}
