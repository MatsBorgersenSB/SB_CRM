import { NextResponse } from "next/server";
import { auditOutlookReconciliation } from "@/lib/outlook-reconciliation-actions";

export async function GET() {
  try {
    const audit = await auditOutlookReconciliation();
    return NextResponse.json(audit);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reconciliation audit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
