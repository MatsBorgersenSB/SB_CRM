import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { m365OAuthScopes } from "@/lib/m365-client";
import { getSharePointEnvironment } from "@/services/sharepoint/config/environment";

/**
 * GET /api/m365/status — connection health for Graph + SharePoint backend.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json(
      { error: "Unauthorized", code: "AUTH_REQUIRED" },
      { status: 401 },
    );
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
    select: {
      id: true,
      status: true,
      userObjectId: true,
      tokenExpiresAt: true,
      lastSyncedAt: true,
      updatedAt: true,
    },
  });

  // If oid-scoped lookup missed (legacy row without oid match), fall back once.
  const fallback =
    !integration && !oid
      ? await prisma.externalIntegration.findFirst({
          where: { provider: "m365_graph", status: "active" },
          orderBy: { updatedAt: "desc" },
          select: {
            id: true,
            status: true,
            userObjectId: true,
            tokenExpiresAt: true,
            lastSyncedAt: true,
            updatedAt: true,
          },
        })
      : null;

  const active = integration ?? fallback;
  const sp = getSharePointEnvironment();

  return NextResponse.json({
    connected: Boolean(active),
    integrationId: active?.id ?? null,
    tokenExpiresAt: active?.tokenExpiresAt?.toISOString() ?? null,
    lastSyncedAt: active?.lastSyncedAt?.toISOString() ?? null,
    scopes: m365OAuthScopes(),
    sharePoint: {
      transport: sp.transport,
      siteConfigured: Boolean(sp.siteId.trim()),
      ready: sp.transport === "graph" && Boolean(sp.siteId.trim()),
    },
    connectUrl: "/api/auth/m365/login",
    outlookAddIn: {
      relationshipCard: "/outlook-addin",
      meetingBriefing: "/outlook/meeting-briefing",
      manifestHint: "Sideload outlook/relationship-card/manifest.xml in Outlook",
    },
  });
}
