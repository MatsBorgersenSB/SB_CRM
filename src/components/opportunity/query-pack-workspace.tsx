"use client";

import { useMemo, useState } from "react";
import {
  acceptAnswerProposals,
  addQueryAttachment,
  addQueryPosition,
  antecHornindalSeedPositions,
  assignPositionCompany,
  createQueryPack,
  markRecipientSent,
  mergeAcceptedQueryPackFinding,
  removeQueryAttachment,
  rowsForCompanyExport,
  updateQueryPosition,
  waitingOnCompanies,
} from "@/lib/query-pack";
import {
  buildQueryPackXlsx,
  parseQueryPackXlsx,
  positionsToViewGrid,
} from "@/lib/query-pack-excel";
import type { OpportunityUnderstandingCapture } from "@/types/opportunity-understanding";
import type {
  QueryPack,
  QueryPackAnswerProposal,
  QueryPackImportResult,
  QueryPosition,
  QueryPositionAttachmentKind,
  QueryPositionType,
} from "@/types/query-pack";
import {
  WorkspaceTable,
  WorkspaceTableBody,
  WorkspaceTableBodyCell,
  WorkspaceTableBodyRow,
  WorkspaceTableHead,
  WorkspaceTableHeadCell,
  WorkspaceTableHeadRow,
} from "@/components/ui/workspace-table";
import {
  ATTIO_PILL_STATIC,
  ATTIO_SURFACE,
  ATTIO_SURFACE_HEADER,
  attioSegmentItemClass,
} from "@/lib/attio-workspace-surfaces";
import {
  WORKSPACE_CONTEXT_COLUMN,
  WORKSPACE_INTEL_CONTEXT_GRID,
  WORKSPACE_PANEL_SURFACE,
} from "@/lib/workspace-design-system";
import { EDITORIAL_BODY_MUTED } from "@/lib/editorial-design-system";

export type QueryPackRosterCompany = {
  companyId: string;
  companyTitle: string;
};

export type QueryPackUploadScope =
  | { kind: "project"; projectId: string }
  | { kind: "opportunity"; dealId: string };

type DisciplineFilter = "all" | QueryPositionType;
type StatusFilter = "all" | "open" | "answered" | "waived";

export function QueryPackPanel({
  scopeId,
  scope = "opportunity",
  understanding,
  rosterCompanies,
  onSave,
  onClose,
  uploadScope,
  uploadRole,
}: {
  scopeId: string;
  scope?: "opportunity" | "project";
  understanding: OpportunityUnderstandingCapture | undefined;
  rosterCompanies: QueryPackRosterCompany[];
  onSave: (next: OpportunityUnderstandingCapture) => Promise<void>;
  onClose: () => void;
  uploadScope?: QueryPackUploadScope;
  uploadRole?: string;
}) {
  const pack = understanding?.queryPack;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<QueryPackImportResult | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState(
    rosterCompanies[0]?.companyId ?? "",
  );
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showRegister, setShowRegister] = useState(false);
  const [sharePointUrlDraft, setSharePointUrlDraft] = useState("");

  const [draftQuestion, setDraftQuestion] = useState("");
  const [draftType, setDraftType] = useState<QueryPositionType>("commercial");
  const [draftCompanyId, setDraftCompanyId] = useState("");
  const [draftContact, setDraftContact] = useState("");
  const [draftDue, setDraftDue] = useState("");

  const [filterSearch, setFilterSearch] = useState("");
  const [filterDiscipline, setFilterDiscipline] = useState<DisciplineFilter>("all");
  const [filterCompany, setFilterCompany] = useState("all");
  const [filterStatus, setFilterStatus] = useState<StatusFilter>("all");

  const companiesById = useMemo(() => {
    const map = new Map(rosterCompanies.map((row) => [row.companyId, row]));
    return map;
  }, [rosterCompanies]);

  const filteredPositions = useMemo(() => {
    if (!pack) return [];
    const q = filterSearch.trim().toLowerCase();
    return pack.positions.filter((row) => {
      if (filterDiscipline !== "all" && row.type !== filterDiscipline) return false;
      if (filterStatus !== "all" && row.status !== filterStatus) return false;
      if (filterCompany !== "all") {
        if (filterCompany === "__unassigned__") {
          if (row.companyId) return false;
        } else if (row.companyId !== filterCompany) {
          return false;
        }
      }
      if (!q) return true;
      const hay = [
        row.questionId,
        row.question,
        row.companyTitle,
        row.contactTitle,
        row.answer,
        row.comment,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [pack, filterSearch, filterDiscipline, filterCompany, filterStatus]);

  async function persist(nextPack: QueryPack, findings = understanding?.findings) {
    const next: OpportunityUnderstandingCapture = {
      fields: understanding?.fields ?? {},
      discoveryNotes: understanding?.discoveryNotes,
      findings,
      queryPack: nextPack,
      updatedAt: new Date().toISOString(),
    };
    await onSave(next);
  }

  async function handleCreate(withAntecSeed: boolean) {
    setBusy(true);
    setError(null);
    try {
      const next = createQueryPack({
        scope,
        scopeId,
        title: withAntecSeed
          ? "Antec Hornindal — ask the companies"
          : "Ask the companies",
        positions: withAntecSeed ? antecHornindalSeedPositions() : [],
      });
      await persist(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start questions");
    } finally {
      setBusy(false);
    }
  }

  function clearQuestionCard() {
    setExpandedId(null);
    setDraftQuestion("");
    setDraftContact("");
    setDraftDue("");
    setDraftCompanyId("");
    setDraftType("commercial");
  }

  function loadQuestionIntoCard(row: QueryPosition) {
    setExpandedId(row.questionId);
    setDraftQuestion(row.question);
    setDraftType(row.type);
    setDraftCompanyId(row.companyId ?? "");
    setDraftContact(row.contactTitle ?? "");
    setDraftDue(row.responseRequiredBy ?? "");
  }

  async function handleSaveQuestion() {
    if (!pack) return;
    const company = draftCompanyId ? companiesById.get(draftCompanyId) : undefined;
    const contact = draftContact.trim()
      ? { contactTitle: draftContact.trim() }
      : undefined;
    setBusy(true);
    setError(null);
    try {
      const next = expandedId
        ? updateQueryPosition(pack, expandedId, {
            question: draftQuestion,
            type: draftType,
            company,
            contact,
            responseRequiredBy: draftDue || undefined,
          })
        : addQueryPosition(pack, {
            question: draftQuestion,
            type: draftType,
            company,
            contact,
            responseRequiredBy: draftDue || undefined,
          });
      await persist(next);
      if (expandedId) {
        // Stay on the same question after update so the user can keep editing / attach.
        const updated = next.positions.find((row) => row.questionId === expandedId);
        if (updated) loadQuestionIntoCard(updated);
      } else {
        clearQuestionCard();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : expandedId
            ? "Could not update question"
            : "Could not add question",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleWhoGetsThis(questionId: string, companyId: string) {
    if (!pack) return;
    if (!companyId) {
      setBusy(true);
      setError(null);
      try {
        const next: QueryPack = {
          ...pack,
          updatedAt: new Date().toISOString(),
          positions: pack.positions.map((row) =>
            row.questionId === questionId
              ? {
                  ...row,
                  companyId: undefined,
                  companyTitle: undefined,
                  contactId: undefined,
                  contactTitle: undefined,
                }
              : row,
          ),
        };
        await persist(next);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not clear company");
      } finally {
        setBusy(false);
      }
      return;
    }
    const company = companiesById.get(companyId);
    if (!company) {
      setError("Pick a company already on this project.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await persist(assignPositionCompany(pack, questionId, company));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign company");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddAttachment(
    questionId: string,
    kind: QueryPositionAttachmentKind,
    label: string,
    url: string,
  ) {
    if (!pack) return;
    setBusy(true);
    setError(null);
    try {
      await persist(addQueryAttachment(pack, questionId, { kind, label, url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add attachment");
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveAttachment(questionId: string, attachmentId: string) {
    if (!pack) return;
    setBusy(true);
    setError(null);
    try {
      await persist(removeQueryAttachment(pack, questionId, attachmentId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not remove attachment");
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    if (!pack || !selectedCompanyId) return;
    const company = companiesById.get(selectedCompanyId);
    if (!company) return;
    const rows = rowsForCompanyExport(pack, selectedCompanyId);
    if (rows.length === 0) {
      setError("No questions assigned to that company yet.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const bytes = await buildQueryPackXlsx(rows, {
        packId: pack.packId,
        scopeId: pack.scopeId,
        scopeTitle: pack.title,
        issuedAt: new Date().toISOString(),
      });
      const blob = new Blob([Uint8Array.from(bytes)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      const safeCompany = company.companyTitle.replace(/\s+/g, "-").toLowerCase();
      anchor.download = `QA-${safeCompany}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
      const existing = pack.recipientFiles.find((row) => row.companyId === company.companyId);
      await persist(
        markRecipientSent(pack, {
          companyId: company.companyId,
          companyTitle: company.companyTitle,
          fileUrl: existing?.fileUrl,
          sharePointItemId: existing?.sharePointItemId,
          sharePointVersionId: existing?.sharePointVersionId,
        }),
      );
      setShowRegister(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not export Excel");
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveSharePointUrl() {
    if (!pack || !selectedCompanyId) return;
    const company = companiesById.get(selectedCompanyId);
    if (!company) return;
    const fileUrl = sharePointUrlDraft.trim();
    if (!/^https?:\/\//i.test(fileUrl)) {
      setError("Paste the SharePoint link to the uploaded Q&A Excel.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const existing = pack.recipientFiles.find((row) => row.companyId === selectedCompanyId);
      await persist(
        markRecipientSent(pack, {
          companyId: company.companyId,
          companyTitle: company.companyTitle,
          fileUrl,
          sentAt: existing?.sentAt ?? new Date().toISOString(),
        }),
      );
      setSharePointUrlDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save SharePoint link");
    } finally {
      setBusy(false);
    }
  }

  async function handleImportFile(file: File) {
    if (!pack) return;
    setBusy(true);
    setError(null);
    setImportResult(null);
    try {
      const buffer = await file.arrayBuffer();
      setImportResult(await parseQueryPackXlsx(pack, buffer));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not read Excel");
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept(proposals: QueryPackAnswerProposal[]) {
    if (!pack || proposals.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const { pack: nextPack, finding } = acceptAnswerProposals(pack, proposals, {
        sourceFileName: "returned-query-pack.xlsx",
        companyId: selectedCompanyId || undefined,
      });
      await onSave(mergeAcceptedQueryPackFinding(understanding, nextPack, finding));
      setImportResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not accept answers");
    } finally {
      setBusy(false);
    }
  }

  if (!pack) {
    return (
      <section className={`${ATTIO_SURFACE} overflow-hidden`}>
        <div className={ATTIO_SURFACE_HEADER}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-carbon-blue">
                Ask the companies
              </h2>
              <p className="mt-1 text-sm text-carbon-blue/70">
                Form for each question · table to manage · Excel per company.
              </p>
            </div>
            <button type="button" className="text-sm text-carbon-blue/60" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
        <div className="space-y-4 px-5 py-5">
          {rosterCompanies.length === 0 ? (
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Add related organizations first — we only ask real companies.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleCreate(true)}
              className="rounded-xl bg-upcycle-orange px-4 py-2.5 text-sm font-semibold text-white"
            >
              Start with Antec questions
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleCreate(false)}
              className="rounded-xl border border-carbon-blue/15 px-4 py-2.5 text-sm font-medium text-carbon-blue"
            >
              Start empty
            </button>
          </div>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </div>
      </section>
    );
  }

  const waiting = waitingOnCompanies(pack);
  const openCount = pack.positions.filter((row) => row.status === "open").length;
  const answeredCount = pack.positions.filter((row) => row.status === "answered").length;
  const forSelected = selectedCompanyId
    ? pack.positions.filter((row) => row.companyId === selectedCompanyId)
    : [];
  const recipientFile = pack.recipientFiles.find((row) => row.companyId === selectedCompanyId);
  const registerView =
    forSelected.length > 0
      ? positionsToViewGrid(forSelected, {
          packId: pack.packId,
          scopeId: pack.scopeId,
          scopeTitle: pack.title,
          issuedAt: recipientFile?.sentAt ?? new Date().toISOString(),
        })
      : null;

  return (
    <section className={`${ATTIO_SURFACE} overflow-hidden`}>
      <div className={ATTIO_SURFACE_HEADER}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-carbon-blue">
              Ask the companies
            </h2>
            <p className="mt-1 text-sm text-carbon-blue/70">
              {pack.title}
              {" · "}
              {pack.positions.length} question{pack.positions.length === 1 ? "" : "s"}
              {waiting.length > 0 ? ` · waiting on ${waiting.join(", ")}` : null}
              {answeredCount > 0 ? ` · ${answeredCount} answered` : null}
              {openCount > 0 && waiting.length === 0 ? ` · ${openCount} open` : null}
            </p>
          </div>
          <button type="button" className="text-sm text-carbon-blue/60" onClick={onClose}>
            Close
          </button>
        </div>
      </div>

      <div className={`${WORKSPACE_INTEL_CONTEXT_GRID} gap-0 border-t border-carbon-blue/8`}>
        {/* Left — form, then register */}
        <div className="min-w-0 border-b border-carbon-blue/8 p-5 lg:border-b-0 lg:border-r">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-carbon-blue">
                {expandedId ? `Edit question · ${expandedId}` : "New question"}
              </p>
              <p className={`mt-1 text-xs ${EDITORIAL_BODY_MUTED}`}>
                {expandedId
                  ? "Change the fields, then save. Click another row to switch."
                  : "Fill the fields, then add. Click a row to edit it here."}
              </p>
            </div>
            {expandedId ? (
              <button
                type="button"
                className="text-sm font-medium text-carbon-blue/70 hover:text-carbon-blue"
                disabled={busy}
                onClick={clearQuestionCard}
              >
                New question
              </button>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            <label className="block text-sm">
              <span className="font-medium text-carbon-blue/80">Discipline</span>
              <select
                className="mt-1 w-full rounded-lg border border-carbon-blue/15 bg-white px-3 py-2 text-sm"
                value={draftType}
                disabled={busy}
                onChange={(event) =>
                  setDraftType(event.target.value === "technical" ? "technical" : "commercial")
                }
              >
                <option value="commercial">Commercial</option>
                <option value="technical">Technical</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="font-medium text-carbon-blue/80">Question</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-carbon-blue/15 bg-white px-3 py-2 text-sm leading-relaxed"
                rows={4}
                placeholder="One clear question…"
                value={draftQuestion}
                disabled={busy}
                onChange={(event) => setDraftQuestion(event.target.value)}
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-carbon-blue/80">Issued to (company)</span>
              <select
                className="mt-1 w-full rounded-lg border border-carbon-blue/15 bg-white px-3 py-2 text-sm"
                value={draftCompanyId}
                disabled={busy}
                onChange={(event) => setDraftCompanyId(event.target.value)}
              >
                <option value="">Choose later</option>
                {rosterCompanies.map((company) => (
                  <option key={company.companyId} value={company.companyId}>
                    {company.companyTitle}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="font-medium text-carbon-blue/80">Issued to (contact)</span>
              <input
                className="mt-1 w-full rounded-lg border border-carbon-blue/15 bg-white px-3 py-2 text-sm"
                placeholder="Optional name"
                value={draftContact}
                disabled={busy}
                onChange={(event) => setDraftContact(event.target.value)}
              />
            </label>

            <label className="block text-sm">
              <span className="font-medium text-carbon-blue/80">Response required by</span>
              <input
                type="date"
                className="mt-1 w-full rounded-lg border border-carbon-blue/15 bg-white px-3 py-2 text-sm"
                value={draftDue}
                disabled={busy}
                onChange={(event) => setDraftDue(event.target.value)}
              />
            </label>

            <button
              type="button"
              disabled={busy || !draftQuestion.trim()}
              onClick={() => void handleSaveQuestion()}
              className="w-full rounded-xl bg-upcycle-orange px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {expandedId ? "Save changes" : "Add question"}
            </button>
          </div>

          {/* Register — below the form */}
          <div className="mt-6 border-t border-carbon-blue/8 pt-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-carbon-blue">Question register</p>
              <p className={`mt-1 text-xs ${EDITORIAL_BODY_MUTED}`}>
                Showing {filteredPositions.length} of {pack.positions.length}
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <input
              className="min-w-[12rem] flex-1 rounded-lg border border-carbon-blue/15 bg-white px-3 py-2 text-sm"
              placeholder="Filter questions…"
              value={filterSearch}
              onChange={(event) => setFilterSearch(event.target.value)}
            />
            <div className="inline-flex flex-wrap gap-0.5 rounded-lg border border-carbon-blue/12 bg-carbon-blue/[0.03] p-0.5">
              {(
                [
                  ["all", "All"],
                  ["commercial", "Commercial"],
                  ["technical", "Technical"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={attioSegmentItemClass(filterDiscipline === value)}
                  onClick={() => setFilterDiscipline(value)}
                >
                  {label}
                </button>
              ))}
            </div>
            <select
              className="rounded-lg border border-carbon-blue/15 bg-white px-2 py-2 text-sm"
              value={filterCompany}
              onChange={(event) => setFilterCompany(event.target.value)}
            >
              <option value="all">All companies</option>
              <option value="__unassigned__">Not assigned</option>
              {rosterCompanies.map((company) => (
                <option key={company.companyId} value={company.companyId}>
                  {company.companyTitle}
                </option>
              ))}
            </select>
            <select
              className="rounded-lg border border-carbon-blue/15 bg-white px-2 py-2 text-sm"
              value={filterStatus}
              onChange={(event) =>
                setFilterStatus(event.target.value as StatusFilter)
              }
            >
              <option value="all">All statuses</option>
              <option value="open">Open</option>
              <option value="answered">Answered</option>
              <option value="waived">Closed</option>
            </select>
          </div>

          <div className={`mt-4 ${WORKSPACE_PANEL_SURFACE} !p-0 overflow-hidden`}>
            <WorkspaceTable>
              <WorkspaceTableHead>
                <WorkspaceTableHeadRow>
                  <WorkspaceTableHeadCell>Ref</WorkspaceTableHeadCell>
                  <WorkspaceTableHeadCell>Discipline</WorkspaceTableHeadCell>
                  <WorkspaceTableHeadCell>Question</WorkspaceTableHeadCell>
                  <WorkspaceTableHeadCell>Issued to</WorkspaceTableHeadCell>
                  <WorkspaceTableHeadCell>Due</WorkspaceTableHeadCell>
                  <WorkspaceTableHeadCell>Status</WorkspaceTableHeadCell>
                  <WorkspaceTableHeadCell>Files</WorkspaceTableHeadCell>
                </WorkspaceTableHeadRow>
              </WorkspaceTableHead>
              <WorkspaceTableBody>
                {filteredPositions.length === 0 ? (
                  <WorkspaceTableBodyRow>
                    <WorkspaceTableBodyCell className="text-carbon-blue/60">
                      No questions match these filters.
                    </WorkspaceTableBodyCell>
                    <WorkspaceTableBodyCell>{""}</WorkspaceTableBodyCell>
                    <WorkspaceTableBodyCell>{""}</WorkspaceTableBodyCell>
                    <WorkspaceTableBodyCell>{""}</WorkspaceTableBodyCell>
                    <WorkspaceTableBodyCell>{""}</WorkspaceTableBodyCell>
                    <WorkspaceTableBodyCell>{""}</WorkspaceTableBodyCell>
                    <WorkspaceTableBodyCell>{""}</WorkspaceTableBodyCell>
                  </WorkspaceTableBodyRow>
                ) : (
                  filteredPositions.map((row) => (
                    <WorkspaceTableBodyRow
                      key={row.questionId}
                      className={
                        expandedId === row.questionId
                          ? "cursor-pointer bg-upcycle-orange/[0.06] ring-1 ring-inset ring-upcycle-orange/25"
                          : "cursor-pointer hover:bg-carbon-blue/[0.03]"
                      }
                      onClick={() => {
                        if (expandedId === row.questionId) {
                          clearQuestionCard();
                          return;
                        }
                        loadQuestionIntoCard(row);
                      }}
                    >
                      <WorkspaceTableBodyCell className="whitespace-nowrap font-mono text-[12px]">
                        {row.questionId}
                      </WorkspaceTableBodyCell>
                      <WorkspaceTableBodyCell>
                        <span className={ATTIO_PILL_STATIC}>
                          {row.type === "technical" ? "Technical" : "Commercial"}
                        </span>
                      </WorkspaceTableBodyCell>
                      <WorkspaceTableBodyCell className="max-w-[20rem]">
                        <span className="line-clamp-2 text-carbon-blue">{row.question}</span>
                        {expandedId === row.questionId && row.answer ? (
                          <p className="mt-2 text-[12px] text-emerald-800 dark:text-emerald-200">
                            Answer: {row.answer}
                          </p>
                        ) : null}
                      </WorkspaceTableBodyCell>
                      <WorkspaceTableBodyCell className="min-w-[10rem]">
                        <div
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          <select
                            className="w-full rounded-md border border-carbon-blue/12 bg-white px-2 py-1 text-[12px]"
                            disabled={busy}
                            value={row.companyId ?? ""}
                            onChange={(event) =>
                              void handleWhoGetsThis(row.questionId, event.target.value)
                            }
                          >
                            <option value="">Not assigned</option>
                            {rosterCompanies.map((company) => (
                              <option key={company.companyId} value={company.companyId}>
                                {company.companyTitle}
                              </option>
                            ))}
                          </select>
                          {row.contactTitle ? (
                            <p className="mt-1 text-[11px] text-carbon-blue/60">
                              {row.contactTitle}
                            </p>
                          ) : null}
                        </div>
                      </WorkspaceTableBodyCell>
                      <WorkspaceTableBodyCell className="whitespace-nowrap text-[12px]">
                        {row.responseRequiredBy ?? "—"}
                      </WorkspaceTableBodyCell>
                      <WorkspaceTableBodyCell>
                        <StatusChip status={row.status} />
                      </WorkspaceTableBodyCell>
                      <WorkspaceTableBodyCell className="text-[12px]">
                        {row.attachments?.length ?? 0}
                      </WorkspaceTableBodyCell>
                    </WorkspaceTableBodyRow>
                  ))
                )}
              </WorkspaceTableBody>
            </WorkspaceTable>
          </div>

          {expandedId ? (
            <div className="mt-3" onClick={(event) => event.stopPropagation()}>
              {(() => {
                const row = pack.positions.find((item) => item.questionId === expandedId);
                if (!row) return null;
                return (
                  <QuestionAttachments
                    position={row}
                    busy={busy}
                    uploadScope={uploadScope}
                    uploadRole={uploadRole}
                    onBusy={setBusy}
                    onError={setError}
                    onAdd={(kind, label, url) =>
                      void handleAddAttachment(row.questionId, kind, label, url)
                    }
                    onRemove={(attachmentId) =>
                      void handleRemoveAttachment(row.questionId, attachmentId)
                    }
                  />
                );
              })()}
            </div>
          ) : (
            <p className={`mt-3 text-xs ${EDITORIAL_BODY_MUTED}`}>
              Click a row to edit it in the card above and attach documents, links, or pictures.
            </p>
          )}
          </div>
        </div>

        {/* Right — send / bring back */}
        <div className={`${WORKSPACE_CONTEXT_COLUMN} p-5`}>
          <div className="rounded-xl border border-carbon-blue/10 bg-carbon-blue/[0.02] p-4">
            <p className="text-sm font-semibold text-carbon-blue">Send / bring back</p>
            <label className="mt-2 block text-sm">
              <span className="text-carbon-blue/70">Company Excel</span>
              <select
                className="mt-1 w-full rounded-lg border border-carbon-blue/15 bg-white px-3 py-2 text-sm"
                value={selectedCompanyId}
                onChange={(event) => setSelectedCompanyId(event.target.value)}
              >
                {rosterCompanies.map((company) => (
                  <option key={company.companyId} value={company.companyId}>
                    {company.companyTitle}
                    {` (${pack.positions.filter((row) => row.companyId === company.companyId).length})`}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || forSelected.length === 0}
                onClick={() => setShowRegister(true)}
                className="rounded-xl border border-carbon-blue/15 px-4 py-2 text-sm font-semibold text-carbon-blue disabled:opacity-50"
              >
                View Q&A register
              </button>
              <button
                type="button"
                disabled={busy || forSelected.length === 0}
                onClick={() => void handleExport()}
                className="rounded-xl bg-upcycle-orange px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Download their Excel
              </button>
              <label className="cursor-pointer rounded-xl border border-carbon-blue/15 px-3 py-2 text-sm font-medium text-carbon-blue">
                Bring answers back
                <input
                  type="file"
                  accept=".xlsx"
                  className="hidden"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleImportFile(file);
                    event.target.value = "";
                  }}
                />
              </label>
              {recipientFile?.fileUrl ? (
                <a
                  href={recipientFile.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-emerald-600/30 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900"
                >
                  Open SharePoint file
                </a>
              ) : null}
            </div>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                className="min-w-0 flex-1 rounded-lg border border-carbon-blue/15 bg-white px-3 py-2 text-sm"
                placeholder="Paste SharePoint link after upload"
                value={sharePointUrlDraft}
                disabled={busy}
                onChange={(event) => setSharePointUrlDraft(event.target.value)}
              />
              <button
                type="button"
                disabled={busy || !sharePointUrlDraft.trim()}
                onClick={() => void handleSaveSharePointUrl()}
                className="rounded-lg border border-carbon-blue/15 px-3 py-2 text-sm disabled:opacity-50"
              >
                Save SharePoint link
              </button>
            </div>
          </div>

          {showRegister && registerView ? (
            <div className="mt-4 rounded-xl border border-carbon-blue/10 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-carbon-blue">
                  Q&A register
                  {companiesById.get(selectedCompanyId)
                    ? ` — ${companiesById.get(selectedCompanyId)!.companyTitle}`
                    : ""}
                </p>
                <button
                  type="button"
                  className="text-sm text-carbon-blue/60"
                  onClick={() => setShowRegister(false)}
                >
                  Hide
                </button>
              </div>
              <div className="mt-3 max-h-[24rem] overflow-auto rounded-lg border border-carbon-blue/8">
                <table className="min-w-full border-collapse text-left text-xs">
                  <thead className="sticky top-0 bg-carbon-blue/[0.04]">
                    <tr>
                      {registerView.headers.map((header) => (
                        <th
                          key={header}
                          className="whitespace-nowrap border-b border-carbon-blue/10 px-2 py-2 font-semibold text-carbon-blue"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {registerView.rows.map((line, rowIndex) => (
                      <tr key={`${line[0]}-${rowIndex}`} className="odd:bg-white even:bg-carbon-blue/[0.02]">
                        {line.map((cell, cellIndex) => (
                          <td
                            key={`${rowIndex}-${cellIndex}`}
                            className="max-w-[14rem] border-b border-carbon-blue/5 px-2 py-2 align-top text-carbon-blue/90"
                          >
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {importResult ? (
            <div className="mt-4 space-y-3 rounded-xl border border-carbon-blue/10 p-3">
              <p className="text-sm font-medium text-carbon-blue">New answers from the Excel</p>
              {importResult.proposals.length === 0 ? (
                <p className={EDITORIAL_BODY_MUTED}>No new answers to review.</p>
              ) : (
                <ul className="space-y-2">
                  {importResult.proposals.map((proposal) => (
                    <li key={proposal.questionId} className="text-sm">
                      <p className="font-medium text-carbon-blue">{proposal.questionId}</p>
                      <p className={EDITORIAL_BODY_MUTED}>{proposal.question}</p>
                      <p className="mt-1">{proposal.nextAnswer || proposal.nextComment}</p>
                    </li>
                  ))}
                </ul>
              )}
              {importResult.unmatched.length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-amber-800">Unmatched review queue</p>
                  <ul className={`mt-1 space-y-1 ${EDITORIAL_BODY_MUTED}`}>
                    {importResult.unmatched.map((row, index) => (
                      <li key={`${row.reason}-${index}`}>
                        {row.reason}
                        {row.raw.answer ? ` — ${row.raw.answer}` : null}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {importResult.proposals.length > 0 ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleAccept(importResult.proposals)}
                  className="rounded-lg bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white"
                >
                  Save answers to the project
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="border-t border-red-200 bg-red-50 px-5 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}
    </section>
  );
}

function StatusChip({ status }: { status: QueryPosition["status"] }) {
  if (status === "answered") {
    return (
      <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">
        Answered
      </span>
    );
  }
  if (status === "waived") {
    return (
      <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
        Closed
      </span>
    );
  }
  return (
    <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
      Open
    </span>
  );
}

function QuestionAttachments({
  position,
  busy,
  uploadScope,
  uploadRole,
  onBusy,
  onError,
  onAdd,
  onRemove,
}: {
  position: QueryPosition;
  busy: boolean;
  uploadScope?: QueryPackUploadScope;
  uploadRole?: string;
  onBusy: (busy: boolean) => void;
  onError: (message: string | null) => void;
  onAdd: (kind: QueryPositionAttachmentKind, label: string, url: string) => void;
  onRemove: (attachmentId: string) => void;
}) {
  const [kind, setKind] = useState<QueryPositionAttachmentKind>("document");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [uploading, setUploading] = useState(false);

  async function uploadDocumentFile(file: File) {
    if (!uploadScope || !uploadRole) {
      onError(
        "File upload needs SharePoint on this project/deal. Paste a document link instead.",
      );
      return;
    }
    setUploading(true);
    onBusy(true);
    onError(null);
    try {
      const { importSmartDocWithFile } = await import("@/lib/smartdoc-browser-upload");
      const { AUTH_ROLE_HEADER } = await import("@/lib/api-auth");
      const endpoint =
        uploadScope.kind === "project"
          ? `/api/projects/${encodeURIComponent(uploadScope.projectId)}/smartdocs`
          : `/api/deals/${encodeURIComponent(uploadScope.dealId)}/smartdocs`;
      const document = await importSmartDocWithFile({
        endpoint,
        headers: { [AUTH_ROLE_HEADER]: uploadRole },
        payload: {
          DocCategory: "General",
          DocType: "Request for information",
          DocumentName: label.trim() || file.name.replace(/\.[^.]+$/, ""),
          originalFileName: file.name,
          Origin: "standard_bio",
          ...(uploadScope.kind === "project"
            ? { LinkedProjectId: uploadScope.projectId }
            : {}),
        },
        file,
        scope:
          uploadScope.kind === "project"
            ? { kind: "project", projectId: uploadScope.projectId }
            : { kind: "opportunity", dealId: uploadScope.dealId },
      });
      const webUrl = document.SharePointWebUrl?.trim();
      if (!webUrl) {
        throw new Error(
          "File was saved but SharePoint did not return a link. Open Documents and copy the link.",
        );
      }
      onAdd("document", label.trim() || document.DocumentName || file.name, webUrl);
      setUrl("");
      setLabel("");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Could not upload the file");
    } finally {
      setUploading(false);
      onBusy(false);
    }
  }

  return (
    <div className="rounded-xl border border-carbon-blue/10 bg-carbon-blue/[0.02] p-3">
      <p className="text-xs font-semibold text-carbon-blue">
        Attachments for {position.questionId}
      </p>
      {(position.attachments?.length ?? 0) > 0 ? (
        <ul className="mt-2 space-y-1">
          {position.attachments!.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-center gap-2 text-sm text-carbon-blue"
            >
              <span className={ATTIO_PILL_STATIC}>
                {item.kind === "url"
                  ? "Link"
                  : item.kind === "document"
                    ? "Document"
                    : "Picture"}
              </span>
              {item.url.startsWith("data:") ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={item.label}
                  className="h-10 w-10 rounded object-cover"
                />
              ) : (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline underline-offset-2"
                >
                  {item.label}
                </a>
              )}
              <button
                type="button"
                disabled={busy}
                className="text-xs text-carbon-blue/50 hover:text-red-600"
                onClick={() => onRemove(item.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <select
          className="rounded-lg border border-carbon-blue/15 bg-white px-2 py-1.5 text-sm"
          value={kind}
          disabled={busy || uploading}
          onChange={(event) =>
            setKind(
              event.target.value === "document"
                ? "document"
                : event.target.value === "picture"
                  ? "picture"
                  : "url",
            )
          }
        >
          <option value="document">Document</option>
          <option value="url">Link (URL)</option>
          <option value="picture">Picture</option>
        </select>
        <input
          className="min-w-[8rem] flex-1 rounded-lg border border-carbon-blue/15 bg-white px-2 py-1.5 text-sm"
          placeholder="Name (optional)"
          value={label}
          disabled={busy || uploading}
          onChange={(event) => setLabel(event.target.value)}
        />
        <input
          className="min-w-[10rem] flex-[2] rounded-lg border border-carbon-blue/15 bg-white px-2 py-1.5 text-sm"
          placeholder={
            kind === "document"
              ? "Paste link, or choose file →"
              : kind === "picture"
                ? "Picture link, or choose file →"
                : "Paste web link"
          }
          value={url}
          disabled={busy || uploading}
          onChange={(event) => setUrl(event.target.value)}
        />
        {kind === "document" ? (
          <label className="cursor-pointer rounded-lg border border-carbon-blue/15 px-2 py-1.5 text-sm">
            {uploading ? "Uploading…" : "Choose file"}
            <input
              type="file"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,application/pdf"
              className="hidden"
              disabled={busy || uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void uploadDocumentFile(file);
              }}
            />
          </label>
        ) : null}
        {kind === "picture" ? (
          <label className="cursor-pointer rounded-lg border border-carbon-blue/15 px-2 py-1.5 text-sm">
            Choose picture
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              className="hidden"
              disabled={busy || uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  const result = typeof reader.result === "string" ? reader.result : "";
                  onAdd("picture", label.trim() || file.name, result);
                  setUrl("");
                  setLabel("");
                };
                reader.readAsDataURL(file);
              }}
            />
          </label>
        ) : null}
        <button
          type="button"
          disabled={busy || uploading || !url.trim()}
          className="rounded-lg bg-carbon-blue px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          onClick={() => {
            onAdd(kind, label.trim() || kind, url.trim());
            setUrl("");
            setLabel("");
          }}
        >
          Attach link
        </button>
      </div>
    </div>
  );
}
