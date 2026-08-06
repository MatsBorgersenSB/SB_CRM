"use client";

import { useState } from "react";
import { copyTextToClipboard } from "@/lib/compose-actions";
import {
  MICRO_CAMPAIGN_ROLES,
  MICRO_CAMPAIGN_TYPES,
  type MicroCampaignResult,
  type MicroCampaignType,
} from "@/lib/marketing/micro-campaign-types";

type MicroCampaignGeneratorProps = {
  companyId: string;
  companyName?: string;
  className?: string;
};

export function MicroCampaignGenerator({
  companyId,
  companyName,
  className = "",
}: MicroCampaignGeneratorProps) {
  const [campaignType, setCampaignType] =
    useState<MicroCampaignType>("LINKEDIN_POST");
  const [targetRole, setTargetRole] = useState<string>("Economic Buyer");
  const [campaign, setCampaign] = useState<MicroCampaignResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedLabel, setCopiedLabel] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/marketing/generate-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId, campaignType, targetRole }),
      });
      const body = (await response.json()) as {
        campaign?: MicroCampaignResult;
        error?: string;
      };
      if (!response.ok || !body.campaign) {
        setError(body.error ?? "Generation failed");
        setCampaign(null);
        return;
      }
      setCampaign(body.campaign);
    } catch {
      setError("Campaign generator unavailable");
      setCampaign(null);
    } finally {
      setLoading(false);
    }
  };

  const copyAsset = async (label: string, content: string) => {
    const ok = await copyTextToClipboard(content);
    if (ok) {
      setCopiedLabel(label);
      window.setTimeout(() => setCopiedLabel(null), 1600);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Thought Leadership & Micro-Campaigns
        </p>
        <p className="text-[13px] font-semibold text-carbon-blue">
          {companyName ?? "Account"} content studio
        </p>
        <p className="mt-0.5 text-[11px] text-carbon-blue/50">
          Grounded in industry, Decision Journal, and intent signals — not invented
          customer claims.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {MICRO_CAMPAIGN_TYPES.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => setCampaignType(type.id)}
            className={`border px-2.5 py-1.5 text-[11px] font-semibold ${
              campaignType === type.id
                ? "border-upcycle-orange/40 bg-upcycle-orange/10 text-upcycle-orange"
                : "border-carbon-blue/15 bg-carbon-blue/[0.03] text-carbon-blue/70 hover:border-carbon-blue/25"
            }`}
          >
            {type.label}
          </button>
        ))}
      </div>

      <label className="block">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Target role
        </span>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {MICRO_CAMPAIGN_ROLES.map((role) => (
            <button
              key={role}
              type="button"
              onClick={() => setTargetRole(role)}
              className={`border px-2 py-1 text-[10px] font-semibold ${
                targetRole === role
                  ? "border-carbon-blue bg-carbon-blue text-white"
                  : "border-carbon-blue/15 text-carbon-blue/65 hover:border-carbon-blue/25"
              }`}
            >
              {role}
            </button>
          ))}
        </div>
      </label>

      <button
        type="button"
        onClick={() => void generate()}
        disabled={loading}
        className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-3 py-1.5 text-[11px] font-semibold text-upcycle-orange hover:bg-upcycle-orange/15 disabled:opacity-50"
      >
        {loading ? "Generating…" : "Generate Campaign"}
      </button>

      {error ? <p className="text-[11px] text-thermal-red">{error}</p> : null}

      {campaign ? (
        <div className="space-y-3">
          <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-3">
            <p className="text-[12px] font-semibold text-carbon-blue">
              {campaign.title}
            </p>
            {campaign.keyAngles.length > 0 ? (
              <ul className="mt-2 space-y-1">
                {campaign.keyAngles.map((angle) => (
                  <li
                    key={angle}
                    className="text-[11px] leading-relaxed text-carbon-blue/60"
                  >
                    • {angle}
                  </li>
                ))}
              </ul>
            ) : null}
            {campaign.groundedIn.length > 0 ? (
              <p className="mt-2 text-[10px] text-carbon-blue/40">
                Grounded in: {campaign.groundedIn.join(" · ")}
              </p>
            ) : null}
          </div>

          {campaign.generatedAssets.map((asset) => (
            <div
              key={asset.label}
              className="border border-carbon-blue/10 bg-[var(--dashboard-surface)]"
            >
              <div className="flex items-center justify-between gap-2 border-b border-carbon-blue/8 px-3 py-2">
                <p className="text-[11px] font-semibold text-carbon-blue">
                  {asset.label}
                </p>
                <button
                  type="button"
                  onClick={() => void copyAsset(asset.label, asset.content)}
                  className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-1 text-[10px] font-semibold text-upcycle-orange hover:bg-upcycle-orange/15"
                >
                  {copiedLabel === asset.label ? "Copied" : "Copy to Clipboard"}
                </button>
              </div>
              <pre className="max-h-80 overflow-auto whitespace-pre-wrap px-3 py-3 text-[11px] leading-relaxed text-carbon-blue/75">
                {asset.content}
              </pre>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
