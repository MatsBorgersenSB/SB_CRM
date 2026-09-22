import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { canAccessIntelligenceCenter } from "@/lib/permissions";
import { dismissTender } from "@/lib/tenders/promote";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ tenderId: string }> },
) {
  const role = await resolveRequestRole(request);
  if (!canAccessIntelligenceCenter(role)) {
    return NextResponse.json({ error: "Insufficient role to dismiss tenders" }, { status: 403 });
  }

  const { tenderId } = await context.params;
  if (!tenderId?.trim()) {
    return NextResponse.json({ error: "tenderId is required" }, { status: 400 });
  }

  try {
    const dismissed = await dismissTender(tenderId.trim());
    return NextResponse.json({ ok: true, ...dismissed });
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status?: number }).status)
        : 500;
    const message = error instanceof Error ? error.message : "Dismiss failed";
    return NextResponse.json({ error: message }, { status: Number.isFinite(status) ? status : 500 });
  }
}
