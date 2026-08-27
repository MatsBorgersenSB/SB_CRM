import { NextResponse } from "next/server";
import {
  deleteTeamsChannelBinding,
  getTeamsChannelBinding,
  upsertTeamsChannelBinding,
} from "@/lib/teams-channel-binding";
import { resolveRequestRole } from "@/lib/api-auth";
import { canAccessDuplicateManager } from "@/lib/permissions";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";

export const dynamic = "force-dynamic";

/** FS-018 — channel binding. GET ?teamId=&channelId= */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId")?.trim() || "";
  const channelId = searchParams.get("channelId")?.trim() || "";
  if (!teamId || !channelId) {
    return NextResponse.json({ error: "teamId and channelId are required" }, { status: 400 });
  }
  try {
    const binding = await getTeamsChannelBinding(teamId, channelId);
    return NextResponse.json({ binding });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lookup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST { teamId, channelId, companyId?, projectId? } — explicit bind. */
export async function POST(request: Request) {
  const role = await resolveRequestRole(request);
  if (!canAccessDuplicateManager(role) && role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: {
    teamId?: string;
    channelId?: string;
    companyId?: string | null;
    projectId?: string | null;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const actor = resolveAuditActor(request, role);
    const binding = await upsertTeamsChannelBinding({
      teamId: body.teamId ?? "",
      channelId: body.channelId ?? "",
      companyId: body.companyId,
      projectId: body.projectId,
      boundBy: actor.userEmail,
    });
    await logAuditEvent({
      ...actor,
      action: "TEAMS_CHANNEL_BOUND",
      entityType: "TeamsChannelBinding",
      entityId: binding.id,
      ipAddress: clientIpFromRequest(request),
      metadata: {
        teamId: binding.teamId,
        channelId: binding.channelId,
        companyId: binding.companyId,
        projectId: binding.projectId,
      },
    });
    return NextResponse.json({ binding });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bind failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

/** DELETE ?teamId=&channelId= — unbind. */
export async function DELETE(request: Request) {
  const role = await resolveRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId")?.trim() || "";
  const channelId = searchParams.get("channelId")?.trim() || "";
  if (!teamId || !channelId) {
    return NextResponse.json({ error: "teamId and channelId are required" }, { status: 400 });
  }
  const ok = await deleteTeamsChannelBinding(teamId, channelId);
  if (ok) {
    const actor = resolveAuditActor(request, role);
    await logAuditEvent({
      ...actor,
      action: "TEAMS_CHANNEL_UNBOUND",
      entityType: "TeamsChannelBinding",
      entityId: `${teamId}:${channelId}`,
      ipAddress: clientIpFromRequest(request),
      metadata: { teamId, channelId },
    });
  }
  return NextResponse.json({ ok });
}
