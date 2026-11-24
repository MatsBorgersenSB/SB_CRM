import "server-only";

import { buildM365DailyFocus } from "@/lib/m365";
import { buildM365AccountWorkspace } from "@/lib/m365/account-workspace";
import { loadM365PaneContext } from "@/lib/m365/pane-context";
import { loadM365DataContext } from "@/lib/m365/resolve-context";
import { readProjectById } from "@/lib/project-db";
import { getTeamsChannelBinding } from "@/lib/teams-channel-binding";

export type TeamsAttentionCardResult = {
  card: Record<string, unknown>;
  facts: Array<{ title: string; value: string }>;
  title: string;
  openUrl: string;
};

/** Build FS-018 Adaptive Card JSON for a bound channel (or Daily Focus fallback). */
export async function buildTeamsAttentionCard(input: {
  teamId?: string;
  channelId?: string;
}): Promise<TeamsAttentionCardResult> {
  const teamId = input.teamId?.trim() || "";
  const channelId = input.channelId?.trim() || "";

  let title = "What deserves attention";
  let facts: Array<{ title: string; value: string }> = [];
  let openUrl = "https://sb-crm-seven.vercel.app";

  if (teamId && channelId) {
    const binding = await getTeamsChannelBinding(teamId, channelId);
    let companyId = binding?.companyId?.trim() || "";
    let contextLabel: string | undefined;

    if (!companyId && binding?.projectId) {
      const project = await readProjectById(binding.projectId);
      companyId =
        project?.linkedCompanyId?.trim() ||
        project?.relatedOrganizations?.find((o) => o.isPrimary)?.companyId ||
        project?.relatedOrganizations?.[0]?.companyId ||
        "";
      if (project) contextLabel = `Project · ${project.name}`;
    }

    if (companyId) {
      const { ctx, resolved } = await loadM365PaneContext({ companyId });
      if (resolved) {
        const workspace = buildM365AccountWorkspace(resolved.company, ctx);
        title = contextLabel
          ? `${contextLabel} — attention`
          : `${workspace.companyName} — attention`;
        openUrl = workspace.deepLink;
        facts = [
          { title: "What matters", value: workspace.meta.whatMatters },
          { title: "At risk", value: workspace.meta.whatIsAtRisk },
          { title: "Next", value: workspace.meta.whatShouldHappenNext },
          workspace.topRisk
            ? { title: "Top risk", value: workspace.topRisk.label }
            : { title: "Health", value: `${workspace.health.status}` },
        ].slice(0, 4);
      }
    }
  }

  if (facts.length === 0) {
    const focus = buildM365DailyFocus(await loadM365DataContext());
    facts = [
      {
        title: "Who to engage",
        value: focus.whoToEngage?.action ?? "No external engagement ranked",
      },
      {
        title: "At risk",
        value: focus.workAtRisk?.label ?? "Nothing urgent at risk",
      },
      {
        title: "Commitment",
        value: focus.openCommitmentDue?.title ?? "No due commitments",
      },
      { title: "Next", value: focus.nextBestAction.action },
    ];
  }

  const card = {
    type: "AdaptiveCard",
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    version: "1.5",
    body: [
      {
        type: "TextBlock",
        text: "SmartCRM",
        size: "Small",
        weight: "Bolder",
        color: "Accent",
      },
      {
        type: "TextBlock",
        text: title,
        size: "Medium",
        weight: "Bolder",
        wrap: true,
      },
      {
        type: "FactSet",
        facts,
      },
    ],
    actions: [
      {
        type: "Action.OpenUrl",
        title: "Open in SmartCRM",
        url: openUrl,
      },
    ],
  };

  return { card, facts, title, openUrl };
}
