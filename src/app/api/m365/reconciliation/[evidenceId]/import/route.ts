import { NextResponse } from "next/server";
import { executeReconciliationImport } from "@/lib/outlook-reconciliation-actions";
import type { ReconciliationImportMode } from "@/types/outlook-reconciliation";

type RouteContext = { params: Promise<{ evidenceId: string }> };

const VALID_MODES: ReconciliationImportMode[] = [
  "email_summary",
  "create_activities",
  "update_last_interaction",
  "build_timeline",
];

export async function POST(request: Request, context: RouteContext) {
  const { evidenceId } = await context.params;

  let body: { mode?: ReconciliationImportMode };
  try {
    body = (await request.json()) as { mode?: ReconciliationImportMode };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.mode || !VALID_MODES.includes(body.mode)) {
    return NextResponse.json({ error: "Valid mode is required" }, { status: 400 });
  }

  try {
    const result = await executeReconciliationImport(evidenceId, body.mode);
    return NextResponse.json({ result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
