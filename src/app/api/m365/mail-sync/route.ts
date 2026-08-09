import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { syncMailDeltaForIntegration } from "@/lib/m365/mail-delta-ingest";

/**
 * Manual mailbox sync for the signed-in user's M365 Connect integration.
 * POST /api/m365/mail-sync
 */
export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const prisma = getPrisma();
  const oid = session.azureOid?.trim() || null;

  const integration = await prisma.externalIntegration.findFirst({
    where: {
      provider: "m365_graph",
      status: "active",
      ...(oid ? { userObjectId: oid } : {}),
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });

  const fallback =
    !integration && !oid
      ? await prisma.externalIntegration.findFirst({
          where: { provider: "m365_graph", status: "active" },
          orderBy: { updatedAt: "desc" },
          select: { id: true },
        })
      : null;

  const target = integration ?? fallback;
  if (!target) {
    return NextResponse.json(
      {
        error:
          "No active Microsoft 365 connection. Connect on /m365-preview first.",
      },
      { status: 404 },
    );
  }

  try {
    const result = await syncMailDeltaForIntegration(target.id);
    if (result.status === "error") {
      return NextResponse.json(
        { error: result.error ?? "Mail sync failed", result },
        { status: 502 },
      );
    }
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[m365/mail-sync]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Mail sync failed" },
      { status: 500 },
    );
  }
}
