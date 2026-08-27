"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { withAuthRoleHeaders } from "@/lib/api-auth";
import { useAuth } from "@/context/auth-context";
import { canAccessDuplicateManager } from "@/lib/permissions";
import type {
  CompanyDuplicateCluster,
  ContactDuplicatePair,
  DuplicateScanResult,
} from "@/lib/duplicate-management/types";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { WorkspaceMain, WorkspaceStack } from "@/components/ui/workspace-main";
import { WorkspacePanel } from "@/components/ui/smartcrm-icon";

type Tab = "companies" | "contacts";

function confidenceStyles(confidence: string): string {
  if (confidence === "certain") return "border-red-200/70 bg-red-50/50 text-red-800";
  if (confidence === "high") return "border-upcycle-orange/30 bg-upcycle-orange/[0.06] text-carbon-blue";
  return "border-carbon-blue/15 bg-carbon-blue/[0.02] text-carbon-blue/70";
}

export function DuplicateManagerShell() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const focusParam = searchParams.get("focus")?.trim() || "";
  const allowed = canAccessDuplicateManager(user.role);

  const [tab, setTab] = useState<Tab>("companies");
  const [scan, setScan] = useState<DuplicateScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [secondaryId, setSecondaryId] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [mergeMessage, setMergeMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!allowed) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (focusParam) params.set("focus", focusParam);
      const response = await fetch(
        `/api/administration/duplicates?${params.toString()}`,
        { headers: withAuthRoleHeaders(user.role), cache: "no-store" },
      );
      const body = (await response.json()) as DuplicateScanResult & { error?: string };
      if (!response.ok) {
        setError(body.error ?? "Unable to scan duplicates");
        setScan(null);
        return;
      }
      setScan(body);
      const first = body.companies.clusters[0];
      if (first) {
        setSelectedClusterId(first.id);
        setPrimaryId(first.suggestedPrimaryId);
        const other = first.members.find((m) => m.id !== first.suggestedPrimaryId);
        setSecondaryId(other?.id ?? null);
      } else {
        setSelectedClusterId(null);
        setPrimaryId(null);
        setSecondaryId(null);
      }
    } catch {
      setError("Unable to scan duplicates");
      setScan(null);
    } finally {
      setLoading(false);
    }
  }, [allowed, focusParam, user.role]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedCluster: CompanyDuplicateCluster | null = useMemo(() => {
    if (!scan || !selectedClusterId) return null;
    return scan.companies.clusters.find((c) => c.id === selectedClusterId) ?? null;
  }, [scan, selectedClusterId]);

  useEffect(() => {
    if (!selectedCluster) return;
    setPrimaryId(selectedCluster.suggestedPrimaryId);
    const other = selectedCluster.members.find(
      (m) => m.id !== selectedCluster.suggestedPrimaryId,
    );
    setSecondaryId(other?.id ?? null);
    setMergeMessage(null);
  }, [selectedCluster]);

  async function confirmMerge() {
    if (!primaryId || !secondaryId || merging) return;
    setMerging(true);
    setMergeMessage(null);
    try {
      const response = await fetch("/api/administration/duplicates/companies/merge", {
        method: "POST",
        headers: withAuthRoleHeaders(user.role, { "Content-Type": "application/json" }),
        body: JSON.stringify({ primaryId, secondaryId }),
      });
      const body = (await response.json()) as {
        error?: string;
        result?: { primaryCode: string; secondaryCode: string; remapped: Record<string, number> };
      };
      if (!response.ok) {
        setMergeMessage(body.error ?? "Merge failed");
        return;
      }
      setMergeMessage(
        `Merged into ${body.result?.primaryCode}. Archived ${body.result?.secondaryCode}.`,
      );
      await load();
    } catch {
      setMergeMessage("Merge failed");
    } finally {
      setMerging(false);
    }
  }

  async function dismissCluster() {
    if (!selectedCluster || dismissing) return;
    setDismissing(true);
    setMergeMessage(null);
    try {
      const response = await fetch("/api/administration/duplicates/dismiss", {
        method: "POST",
        headers: withAuthRoleHeaders(user.role, { "Content-Type": "application/json" }),
        body: JSON.stringify({
          memberIds: selectedCluster.members.map((m) => m.id),
          note: "Not the same company",
          companyId: selectedCluster.suggestedPrimaryId,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        setMergeMessage(body.error ?? "Could not dismiss cluster");
        return;
      }
      setMergeMessage("Marked as not a duplicate — hidden from the queue.");
      await load();
    } catch {
      setMergeMessage("Could not dismiss cluster");
    } finally {
      setDismissing(false);
    }
  }

  const mergePreview = useMemo(() => {
    if (!selectedCluster || !primaryId || !secondaryId) return null;
    const primary = selectedCluster.members.find((m) => m.id === primaryId);
    const secondary = selectedCluster.members.find((m) => m.id === secondaryId);
    if (!primary || !secondary) return null;
    const unionTypes = Array.from(
      new Set([...primary.types, ...secondary.types].map((t) => t.trim()).filter(Boolean)),
    );
    return {
      primary,
      secondary,
      unionTypes,
      contactsMoving: secondary.contactCount,
      opportunitiesMoving: secondary.opportunityCount,
    };
  }, [selectedCluster, primaryId, secondaryId]);

  if (!allowed) {
    return (
      <WorkspaceChrome>
        <WorkspaceMain>
          <p className="text-sm text-carbon-blue/55">
            Duplicate Manager is available to administrators only.
          </p>
        </WorkspaceMain>
      </WorkspaceChrome>
    );
  }

  return (
    <WorkspaceChrome>
      <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 px-4 backdrop-blur-sm">
        <div className="flex items-center gap-3 text-[11px] text-carbon-blue/55">
          <Link href="/administration" className="hover:text-carbon-blue">
            Administration
          </Link>
          <span>/</span>
          <span className="font-semibold text-carbon-blue">Duplicate Manager</span>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="border border-carbon-blue/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/70 hover:bg-carbon-blue/[0.03]"
        >
          Rescan
        </button>
      </header>

      <WorkspaceMain>
        <WorkspaceStack>
          <section className="border border-carbon-blue/10 bg-white px-5 py-4">
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
              FS-020 · Data quality
            </p>
            <h1 className="mt-1 text-lg font-semibold text-carbon-blue">
              What needs cleanup?
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-carbon-blue/55">
              SmartCRM finds likely duplicate companies and contacts, explains why they
              match, and recommends which record to keep. You confirm every merge.
            </p>
            {scan ? (
              <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-carbon-blue/60">
                <span>
                  <strong className="text-carbon-blue">{scan.companies.clusterCount}</strong>{" "}
                  company clusters
                </span>
                <span>
                  <strong className="text-carbon-blue">{scan.companies.certainCount}</strong>{" "}
                  certain
                </span>
                <span>
                  <strong className="text-carbon-blue">{scan.contacts.pairCount}</strong>{" "}
                  contact pairs
                </span>
              </div>
            ) : null}
            {focusParam ? (
              <p className="mt-2 text-[11px] text-carbon-blue/45">
                Focused on: <span className="font-medium text-carbon-blue">{focusParam}</span>
              </p>
            ) : null}
          </section>

          <div className="flex gap-2">
            <TabButton active={tab === "companies"} onClick={() => setTab("companies")}>
              Companies
            </TabButton>
            <TabButton active={tab === "contacts"} onClick={() => setTab("contacts")}>
              Contacts
            </TabButton>
          </div>

          {loading ? (
            <p className="text-sm text-carbon-blue/45">Scanning registries…</p>
          ) : null}
          {error ? <p className="text-sm text-red-700">{error}</p> : null}

          {!loading && !error && tab === "companies" ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
              <WorkspacePanel title="Duplicate clusters">
                {(scan?.companies.clusters.length ?? 0) === 0 ? (
                  <p className="text-sm text-carbon-blue/50">
                    No company duplicates detected with current signals.
                  </p>
                ) : (
                  <ul className="divide-y divide-carbon-blue/8">
                    {scan!.companies.clusters.map((cluster) => (
                      <li key={cluster.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedClusterId(cluster.id)}
                          className={`w-full px-3 py-3 text-left transition-colors hover:bg-carbon-blue/[0.02] ${
                            selectedClusterId === cluster.id ? "bg-carbon-blue/[0.03]" : ""
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className={`border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${confidenceStyles(cluster.confidence)}`}
                            >
                              {cluster.confidence}
                            </span>
                            <span className="text-sm font-medium text-carbon-blue">
                              {cluster.members.map((m) => m.name).join(" · ")}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-carbon-blue/45">
                            {cluster.reasons.map((r) => r.label).join(" · ")}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </WorkspacePanel>

              <WorkspacePanel title="Resolve">
                {!selectedCluster ? (
                  <p className="text-sm text-carbon-blue/50">Select a cluster to review.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-1.5">
                      {selectedCluster.reasons.map((reason) => (
                        <span
                          key={`${reason.code}-${reason.value ?? ""}`}
                          className={`border px-2 py-0.5 text-[10px] ${confidenceStyles(reason.confidence)}`}
                        >
                          {reason.label}
                          {reason.value ? ` · ${reason.value}` : ""}
                        </span>
                      ))}
                    </div>

                    <ul className="space-y-2">
                      {selectedCluster.members.map((member) => {
                        const isPrimary = primaryId === member.id;
                        const isSecondary = secondaryId === member.id;
                        return (
                          <li
                            key={member.id}
                            className={`border px-3 py-3 ${
                              isPrimary
                                ? "border-upcycle-orange/40 bg-upcycle-orange/[0.04]"
                                : "border-carbon-blue/10"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-carbon-blue">
                                  {member.name}
                                </p>
                                <p className="mt-0.5 text-[11px] text-carbon-blue/45">
                                  {member.code}
                                  {member.types.length > 0
                                    ? ` · ${member.types.join(", ")}`
                                    : ""}
                                  {member.organizationNumber
                                    ? ` · Org ${member.organizationNumber}`
                                    : ""}
                                </p>
                                <p className="mt-1 text-[11px] text-carbon-blue/50">
                                  {member.openOpportunityCount} open opp ·{" "}
                                  {member.contactCount} contacts
                                  {member.city ? ` · ${member.city}` : ""}
                                </p>
                              </div>
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPrimaryId(member.id);
                                    if (secondaryId === member.id) {
                                      const other = selectedCluster.members.find(
                                        (m) => m.id !== member.id,
                                      );
                                      setSecondaryId(other?.id ?? null);
                                    }
                                  }}
                                  className={`px-2 py-1 text-[9px] font-semibold uppercase tracking-wider ${
                                    isPrimary
                                      ? "bg-upcycle-orange text-white"
                                      : "border border-carbon-blue/15 text-carbon-blue/60"
                                  }`}
                                >
                                  {isPrimary ? "Primary" : "Keep this"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (primaryId === member.id) return;
                                    setSecondaryId(member.id);
                                  }}
                                  className={`px-2 py-1 text-[9px] font-semibold uppercase tracking-wider ${
                                    isSecondary
                                      ? "border border-red-300 text-red-700"
                                      : "border border-carbon-blue/15 text-carbon-blue/60"
                                  }`}
                                >
                                  {isSecondary ? "Will archive" : "Merge away"}
                                </button>
                                <Link
                                  href={`/companies/${encodeURIComponent(member.code)}`}
                                  className="text-center text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange hover:underline"
                                >
                                  Open
                                </Link>
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ul>

                    <p className="text-[11px] leading-relaxed text-carbon-blue/50">
                      Merge moves contacts, opportunities, notes, documents, and meetings
                      onto the primary company, unions types, then archives the secondary.
                      Nothing is hard-deleted.
                    </p>

                    {mergePreview ? (
                      <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-2 text-[11px] text-carbon-blue/65">
                        <p className="font-semibold text-carbon-blue">Merge preview</p>
                        <p className="mt-1">
                          Keep <strong>{mergePreview.primary.name}</strong> · archive{" "}
                          <strong>{mergePreview.secondary.name}</strong>
                        </p>
                        <p className="mt-0.5">
                          Move {mergePreview.contactsMoving} contacts ·{" "}
                          {mergePreview.opportunitiesMoving} opportunities
                          {mergePreview.unionTypes.length > 0
                            ? ` · types → ${mergePreview.unionTypes.join(", ")}`
                            : ""}
                        </p>
                      </div>
                    ) : null}

                    <button
                      type="button"
                      disabled={!primaryId || !secondaryId || merging || primaryId === secondaryId}
                      onClick={() => void confirmMerge()}
                      className="inline-flex w-full items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white disabled:opacity-40"
                    >
                      {merging ? "Merging…" : "Confirm merge"}
                    </button>
                    <button
                      type="button"
                      disabled={dismissing || !selectedCluster}
                      onClick={() => void dismissCluster()}
                      className="inline-flex w-full items-center justify-center border border-carbon-blue/15 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60 hover:bg-carbon-blue/[0.02] disabled:opacity-40"
                    >
                      {dismissing ? "Dismissing…" : "Not a duplicate"}
                    </button>
                    {mergeMessage ? (
                      <p className="text-[11px] text-carbon-blue/70">{mergeMessage}</p>
                    ) : null}
                  </div>
                )}
              </WorkspacePanel>
            </div>
          ) : null}

          {!loading && !error && tab === "contacts" ? (
            <WorkspacePanel title="Contact duplicate pairs">
              {(scan?.contacts.pairs.length ?? 0) === 0 ? (
                <p className="text-sm text-carbon-blue/50">
                  No contact duplicates detected across the portfolio.
                </p>
              ) : (
                <ContactPairsList pairs={scan!.contacts.pairs} />
              )}
            </WorkspacePanel>
          ) : null}
        </WorkspaceStack>
      </WorkspaceMain>
    </WorkspaceChrome>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
        active
          ? "border-upcycle-orange bg-upcycle-orange text-white"
          : "border-carbon-blue/15 text-carbon-blue/60 hover:bg-carbon-blue/[0.02]"
      }`}
    >
      {children}
    </button>
  );
}

function ContactPairsList({ pairs }: { pairs: ContactDuplicatePair[] }) {
  return (
    <ul className="divide-y divide-carbon-blue/8">
      {pairs.map((pair) => (
        <li key={pair.id} className="flex flex-wrap items-center justify-between gap-3 px-1 py-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${confidenceStyles(pair.confidence)}`}
              >
                {pair.confidence}
              </span>
              <p className="text-sm font-medium text-carbon-blue">
                {pair.primary.label} · {pair.secondary.label}
              </p>
            </div>
            <p className="mt-1 text-[11px] text-carbon-blue/45">
              {pair.reason} · {pair.primary.companyName} / {pair.secondary.companyName}
            </p>
          </div>
          <Link
            href={pair.mergeHref}
            className="border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white"
          >
            Review merge
          </Link>
        </li>
      ))}
    </ul>
  );
}
