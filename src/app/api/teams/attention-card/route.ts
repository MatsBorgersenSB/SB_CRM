import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { buildTeamsAttentionCard } from "@/lib/m365/teams-attention-card";
import { postAdaptiveCardToTeamsChannel } from "@/lib/m365/teams-attention-post";
import { resolveAuditActor } from "@/lib/security/audit-logger";
import {
  listTeamsChannelBindings,
} from "@/lib/teams-channel-binding";

export const dynamic = "force-dynamic";

/**
 * FS-018 Phase 4 — Adaptive Card JSON for channel attention (≤4 items).
 * GET ?teamId=&channelId= — card for bots/Flow.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const teamId = searchParams.get("teamId")?.trim() || "";
  const channelId = searchParams.get("channelId")?.trim() || "";

  try {
    const result = await buildTeamsAttentionCard({ teamId, channelId });
    return NextResponse.json({ card: result.card, facts: result.facts });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Card build failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST — deliver weekly attention card(s) to bound Teams channels.
 * Body: { teamId?, channelId?, all?: true }
 * Requires ChannelMessage.Send on the signed-in M365 session.
 */
export async function POST(request: Request) {
  const role = getRequestRole(request);
  resolveAuditActor(request, role);

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const deliverAll = body.all === true;
  const teamId = typeof body.teamId === "string" ? body.teamId.trim() : "";
  const channelId = typeof body.channelId === "string" ? body.channelId.trim() : "";

  try {
    const targets = deliverAll
      ? await listTeamsChannelBindings()
      : teamId && channelId
        ? [{ teamId, channelId }]
        : [];

    if (targets.length === 0) {
      return NextResponse.json(
        { error: "Provide teamId+channelId or all:true with existing bindings" },
        { status: 400 },
      );
    }

    const results: Array<{
      teamId: string;
      channelId: string;
      ok: boolean;
      messageId?: string;
      error?: string;
    }> = [];

    for (const target of targets) {
      const cardResult = await buildTeamsAttentionCard({
        teamId: target.teamId,
        channelId: target.channelId,
      });
      const posted = await postAdaptiveCardToTeamsChannel({
        teamId: target.teamId,
        channelId: target.channelId,
        card: cardResult.card,
        fallbackText: `SmartCRM: ${cardResult.title}`,
      });
      if (posted) {
        results.push({
          teamId: target.teamId,
          channelId: target.channelId,
          ok: true,
          messageId: posted.messageId,
        });
      } else {
        results.push({
          teamId: target.teamId,
          channelId: target.channelId,
          ok: false,
          error: "Post failed or no M365 token",
        });
      }
    }

    const delivered = results.filter((row) => row.ok).length;
    return NextResponse.json({
      success: delivered > 0,
      delivered,
      total: results.length,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Delivery failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
