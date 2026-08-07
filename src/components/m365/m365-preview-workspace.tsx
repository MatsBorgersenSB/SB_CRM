"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import {
  AccountWorkspace,
  DailyFocus,
  MeetingBriefing,
  RelationshipCard,
} from "@/components/m365";
import { M365ValidationPanel } from "@/components/m365/m365-validation-panel";
import { validateM365Payload } from "@/lib/m365/validation";
import type {
  M365AccountWorkspacePayload,
  M365DailyFocusPayload,
  M365MeetingBriefingPayload,
  M365Payload,
  M365RelationshipCardPayload,
} from "@/types/m365";
import type { Company } from "@/types/company";
import type { Activity } from "@/types/activity";
import type { OutlookEvidenceRecord } from "@/types/outlook-reconciliation";
import type { PipelineRow } from "@/types/pipeline";
import { OutlookReconciliationWorkspace } from "@/components/m365/outlook-reconciliation-workspace";
import { M365ConnectPanel } from "@/components/m365/m365-connect-panel";

type SurfaceId =
  | "relationship-card"
  | "meeting-briefing"
  | "daily-focus"
  | "account-workspace"
  | "reconciliation";

type SurfaceConfig = {
  id: SurfaceId;
  label: string;
  hostLabel: string;
  maxWidth: string;
  needsCompany: boolean;
};

const SURFACES: SurfaceConfig[] = [
  {
    id: "relationship-card",
    label: "Relationship Card",
    hostLabel: "Outlook · ~360px pane",
    maxWidth: "max-w-sm",
    needsCompany: true,
  },
  {
    id: "meeting-briefing",
    label: "Meeting Briefing",
    hostLabel: "Outlook / Teams · ~480px",
    maxWidth: "max-w-lg",
    needsCompany: true,
  },
  {
    id: "daily-focus",
    label: "Daily Focus",
    hostLabel: "Outlook · ~400px pane",
    maxWidth: "max-w-md",
    needsCompany: false,
  },
  {
    id: "account-workspace",
    label: "Account Workspace",
    hostLabel: "Teams tab · ~720px",
    maxWidth: "max-w-2xl",
    needsCompany: true,
  },
  {
    id: "reconciliation",
    label: "Outlook Reconciliation",
    hostLabel: "SmartAssist · Phase 1.26",
    maxWidth: "max-w-2xl",
    needsCompany: false,
  },
];

type M365PreviewWorkspaceProps = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  outlookEvidence: OutlookEvidenceRecord[];
  defaultCompanyId: string;
};

export function M365PreviewWorkspace({
  companies,
  pipelines,
  activities,
  outlookEvidence,
  defaultCompanyId,
}: M365PreviewWorkspaceProps) {
  const [surface, setSurface] = useState<SurfaceId>("relationship-card");
  const [companyId, setCompanyId] = useState(defaultCompanyId);
  const [payload, setPayload] = useState<M365Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const activeSurface = SURFACES.find((item) => item.id === surface)!;

  const fetchPayload = useCallback(async () => {
    if (surface === "reconciliation") {
      setPayload(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const query = activeSurface.needsCompany ? `?companyId=${encodeURIComponent(companyId)}` : "";
    const response = await fetch(`/api/m365/${surface}${query}`);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setPayload(null);
      setError(body?.error ?? `Request failed (${response.status})`);
      setLoading(false);
      return;
    }

    const data = (await response.json()) as M365Payload;
    setPayload(data);
    setLoading(false);
  }, [activeSurface.needsCompany, companyId, surface]);

  useEffect(() => {
    void fetchPayload();
  }, [fetchPayload]);

  const validation = useMemo(
    () => (payload ? validateM365Payload(payload) : null),
    [payload],
  );

  return (
    <WorkspaceChrome>
      <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-carbon-blue/8 bg-white px-6 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-upcycle-orange">
            Phase 1A · M365 Preview
          </p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-carbon-blue">
            Microsoft 365 Experience Validation
          </h1>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-carbon-blue/50">
            Preview intelligence surfaces exactly as Outlook and Teams will consume them.
            Validate hierarchy, clarity, scanability, and actionability before host development.
          </p>

          <div className="mt-4">
            <M365ConnectPanel />
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-4">
            <nav className="flex flex-wrap gap-1 border border-carbon-blue/10 bg-carbon-blue/[0.02] p-1">
              {SURFACES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSurface(item.id)}
                  className={`px-3 py-1.5 text-[11px] font-semibold transition-colors ${
                    surface === item.id
                      ? "bg-carbon-blue text-white"
                      : "text-carbon-blue/60 hover:text-carbon-blue"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {activeSurface.needsCompany ? (
              <label className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-carbon-blue/40">
                  Account context
                </span>
                <select
                  value={companyId}
                  onChange={(event) => setCompanyId(event.target.value)}
                  className="min-w-[220px] border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
                >
                  {companies.map((company) => (
                    <option key={company.CompanyID} value={company.CompanyID}>
                      {company.Title}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </header>

        <div className="grid min-h-0 flex-1 gap-6 overflow-auto p-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
                Live preview
              </p>
              <p className="text-[10px] text-carbon-blue/35">{activeSurface.hostLabel}</p>
            </div>

            {surface === "reconciliation" ? (
              <div className={activeSurface.maxWidth}>
                <OutlookReconciliationWorkspace
                  companies={companies}
                  pipelines={pipelines}
                  activities={activities}
                  outlookEvidence={outlookEvidence}
                />
              </div>
            ) : loading ? (
              <div className={`dashboard-card ${activeSurface.maxWidth} px-5 py-8`}>
                <p className="text-[12px] text-carbon-blue/45">Loading intelligence payload…</p>
              </div>
            ) : error ? (
              <div className={`dashboard-card ${activeSurface.maxWidth} border-red-200/60 px-5 py-8`}>
                <p className="text-sm font-medium text-red-800">Preview unavailable</p>
                <p className="mt-1 text-[11px] text-red-700/70">{error}</p>
              </div>
            ) : payload ? (
              <div className={activeSurface.maxWidth}>
                {payload.kind === "relationship-card" ? (
                  <RelationshipCard payload={payload as M365RelationshipCardPayload} />
                ) : null}
                {payload.kind === "meeting-briefing" ? (
                  <MeetingBriefing payload={payload as M365MeetingBriefingPayload} />
                ) : null}
                {payload.kind === "daily-focus" ? (
                  <DailyFocus payload={payload as M365DailyFocusPayload} />
                ) : null}
                {payload.kind === "account-workspace" ? (
                  <AccountWorkspace payload={payload as M365AccountWorkspacePayload} />
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="min-w-0 lg:sticky lg:top-0 lg:self-start">
            {validation ? <M365ValidationPanel validation={validation} /> : null}
          </section>
        </div>
      </main>
    </WorkspaceChrome>
  );
}
