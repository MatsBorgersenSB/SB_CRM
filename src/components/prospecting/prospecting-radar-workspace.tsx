"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, LayoutGrid, Table2, X } from "lucide-react";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { WorkspaceHeader } from "@/components/ui/workspace-header";
import { WorkspaceMain, WorkspaceStack } from "@/components/ui/workspace-main";
import {
  DeadlineBadge,
  formatTenderBudget,
  SectorBadge,
  TechnologyBadges,
} from "@/components/prospecting/tender-chrome";
import { useAuth } from "@/context/auth-context";
import { withAuthRoleHeaders } from "@/lib/api-auth";
import { cn } from "@/lib/cn";
import { canCreateOpportunity } from "@/lib/permissions";
import { TENDER_SECTORS } from "@/lib/tenders/thermalFilter";
import type { TenderListItem } from "@/lib/tenders/types";
import type { Company } from "@/types/company";
import type { FilterSummaryChip } from "@/types/workspace-filters";

type RadarView = "table" | "grid";
type SectorFilter = "all" | (typeof TENDER_SECTORS)[number];
type TechFilter = "all" | "Pyrolysis" | "Torrefaction";

function matchesTech(tender: TenderListItem, tech: TechFilter): boolean {
  if (tech === "all") return true;
  if (tender.technologyType === "Both") return true;
  return tender.technologyType === tech;
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
          <section className="overflow-hidden rounded-xl border border-border/60 bg-card/50 backdrop-blur-sm">
            <div className="flex flex-col gap-4 border-b border-border/60 px-5 py-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <h1 className="text-lg font-semibold tracking-tight text-foreground">
                    Open thermal notices
                  </h1>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    TED is pulled every morning. Promote only when this should become a deal.
                  </p>
                </div>
                <SegmentedControl
                  ariaLabel="View"
                  value={view}
                  onChange={setView}
                  options={[
                    {
                      value: "table",
                      label: <Table2 className="size-3.5" strokeWidth={1.75} />,
                      ariaLabel: "Table view",
                    },
                    {
                      value: "grid",
                      label: <LayoutGrid className="size-3.5" strokeWidth={1.75} />,
                      ariaLabel: "Grid view",
                    },
                  ]}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl
                  ariaLabel="Sector"
                  value={sector}
                  onChange={setSector}
                  options={[
                    { value: "all", label: "All sectors" },
                    ...TENDER_SECTORS.map((item) => ({ value: item, label: item })),
                  ]}
                />
                <SegmentedControl
                  ariaLabel="Technology"
                  value={tech}
                  onChange={setTech}
                  options={[
                    { value: "all", label: "All tech" },
                    { value: "Pyrolysis", label: "Pyrolysis" },
                    { value: "Torrefaction", label: "Torrefaction" },
                  ]}
                />
              </div>
            </div>

            <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-3" aria-live="polite">
              <p className="text-sm text-muted-foreground">
                Showing{" "}
                <span className="font-medium tabular-nums text-foreground">{visible.length}</span> of{" "}
                <span className="font-medium tabular-nums text-foreground">{tenders.length}</span>{" "}
                tenders
              </p>
              {chips.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  {chips.map((chip) => (
                    <Button
                      key={chip.id}
                      variant="outline"
                      size="sm"
                      onClick={chip.onRemove}
                      aria-label={`Remove filter ${chip.label}: ${chip.value}`}
                    >
                      {chip.label}: {chip.value}
                      <X className="size-3" strokeWidth={2} />
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSector("all");
                      setTech("all");
                    }}
                  >
                    Clear filters
                  </Button>
                </div>
              ) : null}
            </div>

            {error ? (
              <p className="border-b border-destructive/20 bg-destructive/10 px-5 py-2.5 text-sm text-destructive">
                {error}
              </p>
            ) : null}

            {visible.length === 0 ? (
              <div className="px-5 py-12">
                <p className="font-semibold tracking-tight text-foreground">No matching tenders</p>
                <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  SmartCRM pulls TED every morning, keeps only pyrolysis and torrefaction notices,
                  and does not invent tenders.
                </p>
              </div>
            ) : view === "table" ? (
              <div className="overflow-x-auto">
                <table className="w-full table-fixed border-collapse text-left">
                  <colgroup>
                    <col className="w-[28%]" />
                    <col className="w-[16%]" />
                    <col className="w-[16%]" />
                    <col className="w-[14%]" />
                    <col className="w-[12%]" />
                    <col className="w-[14%]" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-border/60">
                      {["Tender", "Authority", "Technology", "Sector", "Deadline", "Next"].map(
                        (heading) => (
                          <th
                            key={heading}
                            className="px-5 py-2.5 text-xs font-semibold tracking-tight text-muted-foreground"
                          >
                            {heading}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((tender) => (
                      <tr
                        key={tender.id}
                        className="border-b border-border/40 transition-all duration-200 last:border-b-0 hover:bg-accent/80"
                      >
                        <td className="px-5 py-3.5 align-top">
                          <p className="font-semibold tracking-tight text-foreground">
                            {tender.title}
                          </p>
                          <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
                            {tender.source} · {tender.country}
                            {formatTenderBudget(tender.estimatedBudget)
                              ? ` · ${formatTenderBudget(tender.estimatedBudget)}`
                              : ""}
                          </p>
                        </td>
                        <td className="px-5 py-3.5 align-top text-sm leading-relaxed text-muted-foreground">
                          {tender.authorityName}
                        </td>
                        <td className="px-5 py-3.5 align-top">
                          <TechnologyBadges type={tender.technologyType} />
                        </td>
                        <td className="px-5 py-3.5 align-top">
                          <SectorBadge sector={tender.sectorTag} />
                        </td>
                        <td className="px-5 py-3.5 align-top">
                          <DeadlineBadge daysLeft={tender.daysLeft} />
                        </td>
                        <td className="px-5 py-3.5 align-top">
                          <TenderActions
                            tenderId={tender.id}
                            busy={busyId === tender.id}
                            canPromote={canPromote}
                            onPromote={() => void runAction(tender.id, "promote")}
                            onDismiss={() => void runAction(tender.id, "dismiss")}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-3">
                {visible.map((tender) => (
                  <article
                    key={tender.id}
                    className={cn(
                      "flex flex-col gap-4 rounded-xl border border-border/60 bg-card/50 p-5 backdrop-blur-sm",
                      "transition-all duration-200 hover:bg-accent/80",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <TechnologyBadges type={tender.technologyType} />
                      <SectorBadge sector={tender.sectorTag} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <h2 className="font-semibold tracking-tight text-foreground">
                        {tender.title}
                      </h2>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {tender.authorityName} · {tender.country} · {tender.source}
                      </p>
                    </div>
                    <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                      {tender.summary}
                    </p>
                    <div className="mt-auto flex flex-col gap-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <DeadlineBadge daysLeft={tender.daysLeft} />
                        {formatTenderBudget(tender.estimatedBudget) ? (
                          <Badge variant="outline">
                            {formatTenderBudget(tender.estimatedBudget)}
                          </Badge>
                        ) : null}
                      </div>
                      <TenderActions
                        tenderId={tender.id}
                        busy={busyId === tender.id}
                        canPromote={canPromote}
                        onPromote={() => void runAction(tender.id, "promote")}
                        onDismiss={() => void runAction(tender.id, "dismiss")}
                      />
                    </div>
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
        <Button size="sm" disabled={busy} onClick={onPromote}>
          <Check className="size-3.5" strokeWidth={2} />
          Promote
        </Button>
      ) : null}
      <Button variant="outline" size="sm" disabled={busy} onClick={onDismiss}>
        <X className="size-3.5" strokeWidth={2} />
        Dismiss
      </Button>
    </div>
  );
}
