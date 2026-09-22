"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LayoutGrid, Table2 } from "lucide-react";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { FilterTransparencyBar } from "@/components/ui/filter-transparency-bar";
import { WorkspaceHeader } from "@/components/ui/workspace-header";
import { WorkspaceMain, WorkspaceStack } from "@/components/ui/workspace-main";
import {
  WorkspaceTable,
  WorkspaceTableBody,
  WorkspaceTableBodyCell,
  WorkspaceTableBodyRow,
  WorkspaceTableHead,
  WorkspaceTableHeadCell,
  WorkspaceTableHeadRow,
} from "@/components/ui/workspace-table";
import { useAuth } from "@/context/auth-context";
import { withAuthRoleHeaders } from "@/lib/api-auth";
import { canCreateOpportunity } from "@/lib/permissions";
import {
  attioSegmentItemClass,
  ATTIO_SEGMENT_TRACK,
  ATTIO_SURFACE,
} from "@/lib/attio-workspace-surfaces";
import { TENDER_SECTORS } from "@/lib/tenders/thermalFilter";
import type { TenderListItem } from "@/lib/tenders/types";
import type { Company } from "@/types/company";
import type { FilterSummaryChip } from "@/types/workspace-filters";

type RadarView = "table" | "grid";
type SectorFilter = "all" | (typeof TENDER_SECTORS)[number];
type TechFilter = "all" | "Pyrolysis" | "Torrefaction";

function formatBudget(value: number | null): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function countdownLabel(daysLeft: number): string {
  if (daysLeft <= 0) return "⏰ Due today";
  if (daysLeft === 1) return "⏰ 1 Day Left";
  return `⏰ ${daysLeft} Days Left`;
}

function matchesTech(tender: TenderListItem, tech: TechFilter): boolean {
  if (tech === "all") return true;
  if (tender.technologyType === "Both") return true;
  return tender.technologyType === tech;
}

function TechnologyBadges({ type }: { type: TenderListItem["technologyType"] }) {
  const showPyrolysis = type === "Pyrolysis" || type === "Both";
  const showTorrefaction = type === "Torrefaction" || type === "Both";
  return (
    <span className="inline-flex flex-wrap gap-1">
      {showPyrolysis ? (
        <span className="inline-flex rounded-md border border-upcycle-orange/30 bg-upcycle-orange/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-upcycle-orange">
          [ Pyrolysis ]
        </span>
      ) : null}
      {showTorrefaction ? (
        <span className="inline-flex rounded-md border border-carbon-blue/20 bg-carbon-blue/5 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-carbon-blue">
          [ Torrefaction ]
        </span>
      ) : null}
    </span>
  );
}

function SectorBadge({ sector }: { sector: TenderListItem["sectorTag"] }) {
  return (
    <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
      {sector}
    </span>
  );
}

export function ProspectingRadarWorkspace({
  tenders,
  companies,
}: {
  tenders: TenderListItem[];
  companies: Company[];
}) {
  const router = useRouter();
  const { user } = useAuth();
  const canPromote = canCreateOpportunity(user.role);
  const [view, setView] = useState<RadarView>("table");
  const [sector, setSector] = useState<SectorFilter>("all");
  const [tech, setTech] = useState<TechFilter>("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  const visible = useMemo(() => {
    const hidden = new Set(hiddenIds);
    return tenders.filter((tender) => {
      if (hidden.has(tender.id)) return false;
      if (sector !== "all" && tender.sectorTag !== sector) return false;
      return matchesTech(tender, tech);
    });
  }, [tenders, hiddenIds, sector, tech]);

  const chips: FilterSummaryChip[] = [];
  if (sector !== "all") {
    chips.push({
      id: "sector",
      label: "Sector",
      value: sector,
      onRemove: () => setSector("all"),
    });
  }
  if (tech !== "all") {
    chips.push({
      id: "tech",
      label: "Tech",
      value: tech,
      onRemove: () => setTech("all"),
    });
  }

  async function runAction(tenderId: string, kind: "promote" | "dismiss") {
    setBusyId(tenderId);
    setError(null);
    try {
      const path =
        kind === "promote"
          ? "/api/prospecting/promote"
          : `/api/tenders/${encodeURIComponent(tenderId)}/dismiss`;
      const response = await fetch(path, {
        method: "POST",
        cache: "no-store",
        headers: withAuthRoleHeaders(user.role, { "Content-Type": "application/json" }),
        body: JSON.stringify(kind === "promote" ? { tenderId } : {}),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(payload?.error || `Unable to ${kind} this tender.`);
      }
      setHiddenIds((current) => [...current, tenderId]);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : `Unable to ${kind} this tender.`);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <WorkspaceChrome>
      <WorkspaceHeader
        scope="Prospecting Radar"
        title="Thermal tenders"
        context="What deserves attention: pyrolysis and torrefaction notices still open. You decide what becomes an opportunity."
        actions={<RoleSwitcher companies={companies} />}
      />
      <WorkspaceMain>
        <WorkspaceStack>
          <section className={`${ATTIO_SURFACE} overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 px-4 py-3 dark:border-slate-800">
              <div className={ATTIO_SEGMENT_TRACK} role="tablist" aria-label="Sector">
                <button
                  type="button"
                  className={attioSegmentItemClass(sector === "all")}
                  onClick={() => setSector("all")}
                >
                  All sectors
                </button>
                {TENDER_SECTORS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={attioSegmentItemClass(sector === item)}
                    onClick={() => setSector(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className={ATTIO_SEGMENT_TRACK} role="tablist" aria-label="Technology">
                  <button
                    type="button"
                    className={attioSegmentItemClass(tech === "all")}
                    onClick={() => setTech("all")}
                  >
                    All tech
                  </button>
                  <button
                    type="button"
                    className={attioSegmentItemClass(tech === "Pyrolysis")}
                    onClick={() => setTech("Pyrolysis")}
                  >
                    Pyrolysis
                  </button>
                  <button
                    type="button"
                    className={attioSegmentItemClass(tech === "Torrefaction")}
                    onClick={() => setTech("Torrefaction")}
                  >
                    Torrefaction
                  </button>
                </div>
                <div className={ATTIO_SEGMENT_TRACK} role="tablist" aria-label="View">
                  <button
                    type="button"
                    className={attioSegmentItemClass(view === "table")}
                    onClick={() => setView("table")}
                    aria-label="Table view"
                  >
                    <Table2 className="size-3.5" strokeWidth={1.75} />
                  </button>
                  <button
                    type="button"
                    className={attioSegmentItemClass(view === "grid")}
                    onClick={() => setView("grid")}
                    aria-label="Grid view"
                  >
                    <LayoutGrid className="size-3.5" strokeWidth={1.75} />
                  </button>
                </div>
              </div>
            </div>

            <FilterTransparencyBar
              entityLabel="tenders"
              filteredCount={visible.length}
              totalCount={tenders.length}
              activeFilters={chips}
              onClearAll={
                chips.length > 0
                  ? () => {
                      setSector("all");
                      setTech("all");
                    }
                  : undefined
              }
            />

            {error ? (
              <p className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-[12px] text-rose-700">
                {error}
              </p>
            ) : null}

            {visible.length === 0 ? (
              <p className="px-4 py-8 text-sm text-carbon-blue/50">
                No pending thermal tenders match this view. Ingest notices from TED, Doffin,
                Mercell, or SAM — SmartCRM does not invent tenders.
              </p>
            ) : view === "table" ? (
              <div className="overflow-x-auto px-2 pb-3 pt-1">
                <WorkspaceTable>
                  <colgroup>
                    <col className="w-[28%]" />
                    <col className="w-[16%]" />
                    <col className="w-[14%]" />
                    <col className="w-[12%]" />
                    <col className="w-[10%]" />
                    <col className="w-[20%]" />
                  </colgroup>
                  <WorkspaceTableHead>
                    <WorkspaceTableHeadRow>
                      <WorkspaceTableHeadCell>Tender</WorkspaceTableHeadCell>
                      <WorkspaceTableHeadCell>Authority</WorkspaceTableHeadCell>
                      <WorkspaceTableHeadCell>Technology</WorkspaceTableHeadCell>
                      <WorkspaceTableHeadCell>Sector</WorkspaceTableHeadCell>
                      <WorkspaceTableHeadCell>Deadline</WorkspaceTableHeadCell>
                      <WorkspaceTableHeadCell>Next</WorkspaceTableHeadCell>
                    </WorkspaceTableHeadRow>
                  </WorkspaceTableHead>
                  <WorkspaceTableBody>
                    {visible.map((tender) => (
                      <WorkspaceTableBodyRow key={tender.id}>
                        <WorkspaceTableBodyCell>
                          <p className="font-medium text-carbon-blue">{tender.title}</p>
                          <p className="mt-0.5 text-[11px] text-carbon-blue/45">
                            {tender.source} · {tender.country}
                            {tender.estimatedBudget != null
                              ? ` · ${formatBudget(tender.estimatedBudget)}`
                              : ""}
                          </p>
                        </WorkspaceTableBodyCell>
                        <WorkspaceTableBodyCell>{tender.authorityName}</WorkspaceTableBodyCell>
                        <WorkspaceTableBodyCell>
                          <TechnologyBadges type={tender.technologyType} />
                        </WorkspaceTableBodyCell>
                        <WorkspaceTableBodyCell>
                          <SectorBadge sector={tender.sectorTag} />
                        </WorkspaceTableBodyCell>
                        <WorkspaceTableBodyCell>
                          <span className="text-[12px] font-medium text-carbon-blue">
                            {countdownLabel(tender.daysLeft)}
                          </span>
                        </WorkspaceTableBodyCell>
                        <WorkspaceTableBodyCell>
                          <TenderActions
                            tenderId={tender.id}
                            busy={busyId === tender.id}
                            canPromote={canPromote}
                            onPromote={() => void runAction(tender.id, "promote")}
                            onDismiss={() => void runAction(tender.id, "dismiss")}
                          />
                        </WorkspaceTableBodyCell>
                      </WorkspaceTableBodyRow>
                    ))}
                  </WorkspaceTableBody>
                </WorkspaceTable>
              </div>
            ) : (
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((tender) => (
                  <article
                    key={tender.id}
                    className="flex flex-col gap-3 rounded-lg border border-slate-200/80 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <TechnologyBadges type={tender.technologyType} />
                      <SectorBadge sector={tender.sectorTag} />
                    </div>
                    <div>
                      <h2 className="text-sm font-semibold text-carbon-blue">{tender.title}</h2>
                      <p className="mt-1 text-[12px] text-carbon-blue/55">
                        {tender.authorityName} · {tender.country} · {tender.source}
                      </p>
                    </div>
                    <p className="line-clamp-3 text-[12px] leading-relaxed text-carbon-blue/70">
                      {tender.summary}
                    </p>
                    <p className="text-[12px] font-medium text-carbon-blue">
                      {countdownLabel(tender.daysLeft)}
                      {tender.estimatedBudget != null
                        ? ` · ${formatBudget(tender.estimatedBudget)}`
                        : ""}
                    </p>
                    <TenderActions
                      tenderId={tender.id}
                      busy={busyId === tender.id}
                      canPromote={canPromote}
                      onPromote={() => void runAction(tender.id, "promote")}
                      onDismiss={() => void runAction(tender.id, "dismiss")}
                    />
                  </article>
                ))}
              </div>
            )}
          </section>
        </WorkspaceStack>
      </WorkspaceMain>
    </WorkspaceChrome>
  );
}

function TenderActions({
  tenderId,
  busy,
  canPromote,
  onPromote,
  onDismiss,
}: {
  tenderId: string;
  busy: boolean;
  canPromote: boolean;
  onPromote: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5" data-tender-id={tenderId}>
      {canPromote ? (
        <button
          type="button"
          disabled={busy}
          onClick={onPromote}
          className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-800 disabled:opacity-50"
        >
          ✓ Promote to Opportunity
        </button>
      ) : null}
      <button
        type="button"
        disabled={busy}
        onClick={onDismiss}
        className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      >
        ✕ Dismiss
      </button>
    </div>
  );
}
