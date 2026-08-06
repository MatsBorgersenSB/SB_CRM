"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CATEGORY_LABELS,
  FOCUS_AREA_LABELS,
  type ChannelFocusArea,
  type NicheChannel,
  type NicheChannelRadarResult,
} from "@/lib/marketing/channel-radar-types";
import { copyTextToClipboard } from "@/lib/compose-actions";

type NicheChannelRadarPanelProps = {
  companyId: string;
  companyName?: string;
  className?: string;
};

const FOCUS_AREA_COLORS: Record<ChannelFocusArea, string> = {
  METALLURGY: "border-sky-600/30 bg-sky-50 text-sky-800",
  BATTERY_STORAGE: "border-violet-600/30 bg-violet-50 text-violet-800",
  CONSTRUCTION: "border-amber-600/30 bg-amber-50 text-amber-800",
  WATER_TREATMENT: "border-cyan-600/30 bg-cyan-50 text-cyan-800",
  BIOCHAR_CDR: "border-emerald-600/30 bg-emerald-50 text-emerald-800",
  FEEDSTOCK: "border-orange-600/30 bg-orange-50 text-orange-800",
};

const ALL_FOCUS_AREAS: ChannelFocusArea[] = [
  "METALLURGY",
  "BATTERY_STORAGE",
  "CONSTRUCTION",
  "WATER_TREATMENT",
  "BIOCHAR_CDR",
  "FEEDSTOCK",
];

function relevanceBar(score: number): string {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 60) return "bg-upcycle-orange";
  return "bg-carbon-blue/30";
}

export function NicheChannelRadarPanel({
  companyId,
  companyName,
  className = "",
}: NicheChannelRadarPanelProps) {
  const [data, setData] = useState<NicheChannelRadarResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<ChannelFocusArea | null>(null);
  const [copiedName, setCopiedName] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/marketing/niche-channels?companyId=${encodeURIComponent(companyId)}`,
      );
      const body = (await response.json()) as {
        result?: NicheChannelRadarResult;
        error?: string;
      };
      if (!response.ok || !body.result) {
        setError(body.error ?? "Failed to load channel radar");
        setData(null);
        return;
      }
      setData(body.result);
    } catch {
      setError("Channel radar unavailable");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const copyChannel = async (channel: NicheChannel) => {
    const text = [
      `Channel: ${channel.channelName}`,
      `Category: ${CATEGORY_LABELS[channel.category]}`,
      `Sector: ${FOCUS_AREA_LABELS[channel.focusArea]}`,
      `Relevance: ${channel.relevanceScore}/100`,
      ``,
      `Strategic advice: ${channel.strategicAdvice}`,
    ].join("\n");
    const ok = await copyTextToClipboard(text);
    if (ok) {
      setCopiedName(channel.channelName);
      window.setTimeout(() => setCopiedName(null), 1600);
    }
  };

  const filtered: NicheChannel[] =
    data?.channels.filter(
      (ch) => !activeFilter || ch.focusArea === activeFilter,
    ) ?? [];

  const focusAreasPresent = new Set(data?.channels.map((ch) => ch.focusArea) ?? []);

  if (loading) {
    return (
      <div className={`${className}`}>
        <p className="text-[11px] text-carbon-blue/40">Loading channel radar…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${className}`}>
        <p className="text-[11px] text-thermal-red">{error}</p>
      </div>
    );
  }

  if (!data || data.channels.length === 0) {
    return (
      <div className={`${className}`}>
        <p className="text-[11px] text-carbon-blue/40">
          No channel intelligence available for this account.
        </p>
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Niche Channel & Gathering Radar
        </p>
        <p className="text-[13px] font-semibold text-carbon-blue">
          {companyName ?? data.companyName} — sector channels
        </p>
        {data.groundedIn.length > 0 ? (
          <p className="mt-0.5 text-[10px] text-carbon-blue/40">
            Grounded in: {data.groundedIn.join(" · ")}
          </p>
        ) : null}
      </div>

      {/* Sector filter chips */}
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => setActiveFilter(null)}
          className={`border px-2 py-1 text-[10px] font-semibold ${
            !activeFilter
              ? "border-carbon-blue bg-carbon-blue text-white"
              : "border-carbon-blue/15 text-carbon-blue/65 hover:border-carbon-blue/25"
          }`}
        >
          All ({data.channels.length})
        </button>
        {ALL_FOCUS_AREAS.filter((fa) => focusAreasPresent.has(fa)).map((fa) => {
          const count = data.channels.filter((ch) => ch.focusArea === fa).length;
          return (
            <button
              key={fa}
              type="button"
              onClick={() => setActiveFilter(activeFilter === fa ? null : fa)}
              className={`border px-2 py-1 text-[10px] font-semibold ${
                activeFilter === fa
                  ? "border-carbon-blue bg-carbon-blue text-white"
                  : "border-carbon-blue/15 text-carbon-blue/65 hover:border-carbon-blue/25"
              }`}
            >
              {FOCUS_AREA_LABELS[fa].split(" &")[0].split(" (")[0]} ({count})
            </button>
          );
        })}
      </div>

      {/* Channel cards */}
      <div className="space-y-2">
        {filtered.map((channel) => (
          <div
            key={channel.channelName}
            className="border border-carbon-blue/10 bg-[var(--dashboard-surface)]"
          >
            <div className="flex items-start justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold leading-snug text-carbon-blue">
                  {channel.channelName}
                </p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span
                    className={`inline-block border px-1.5 py-0.5 text-[9px] font-semibold ${FOCUS_AREA_COLORS[channel.focusArea]}`}
                  >
                    {FOCUS_AREA_LABELS[channel.focusArea]}
                  </span>
                  <span className="inline-block border border-carbon-blue/15 bg-carbon-blue/[0.04] px-1.5 py-0.5 text-[9px] font-semibold text-carbon-blue/60">
                    {CATEGORY_LABELS[channel.category]}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 pt-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="h-1.5 w-12 overflow-hidden bg-carbon-blue/10">
                    <div
                      className={`h-full ${relevanceBar(channel.relevanceScore)}`}
                      style={{ width: `${channel.relevanceScore}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-carbon-blue/60">
                    {channel.relevanceScore}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => void copyChannel(channel)}
                  className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-0.5 text-[9px] font-semibold text-upcycle-orange hover:bg-upcycle-orange/15"
                >
                  {copiedName === channel.channelName ? "Copied" : "Add to Campaign"}
                </button>
              </div>
            </div>
            <div className="border-t border-carbon-blue/8 px-3 py-2">
              <p className="text-[11px] leading-relaxed text-carbon-blue/60">
                {channel.strategicAdvice}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
