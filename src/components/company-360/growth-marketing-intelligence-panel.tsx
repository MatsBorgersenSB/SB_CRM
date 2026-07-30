"use client";

import { useState } from "react";
import { DecisionJournalPanel } from "@/components/assistant/DecisionJournalPanel";
import { ReconBattlecardPanel } from "@/components/assistant/ReconBattlecardPanel";
import { MicroCampaignGenerator } from "@/components/marketing/MicroCampaignGenerator";
import { NicheChannelRadarPanel } from "@/components/marketing/NicheChannelRadarPanel";
import { WorkspaceModeNav } from "@/components/ui/workspace-mode-nav";

const GROWTH_TABS = [
  { id: "recon", label: "Executive Recon" },
  { id: "campaigns", label: "Micro-Campaigns" },
  { id: "channels", label: "Niche Channels" },
  { id: "decisions", label: "Decision Journal" },
] as const;

type GrowthTabId = (typeof GROWTH_TABS)[number]["id"];

export function GrowthMarketingIntelligencePanel({
  companyId,
  companyName,
  domain,
}: {
  companyId: string;
  companyName: string;
  domain?: string;
}) {
  const [tab, setTab] = useState<GrowthTabId>("recon");

  return (
    <div className="flex flex-col gap-4">
      <WorkspaceModeNav
        ariaLabel="Growth and marketing intelligence"
        items={GROWTH_TABS.map((entry) => ({ id: entry.id, label: entry.label }))}
        active={tab}
        onChange={(id) => setTab(id as GrowthTabId)}
      />

      {tab === "recon" ? (
        <ReconBattlecardPanel
          companyId={companyId}
          companyName={companyName}
          domain={domain}
        />
      ) : null}

      {tab === "campaigns" ? (
        <MicroCampaignGenerator companyId={companyId} companyName={companyName} />
      ) : null}

      {tab === "channels" ? (
        <NicheChannelRadarPanel companyId={companyId} companyName={companyName} />
      ) : null}

      {tab === "decisions" ? (
        <DecisionJournalPanel companyId={companyId} companyName={companyName} />
      ) : null}
    </div>
  );
}
