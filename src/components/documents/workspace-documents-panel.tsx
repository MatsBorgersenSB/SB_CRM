"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { classifyByFileName } from "@/lib/mock-ai-parser";
import {
  buildSmartDocIdentityPreview,
  suggestDocumentNames,
} from "@/lib/smartdoc-identity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { Activity } from "@/types/activity";
import type { CreateSmartDocInput, SmartDocLibraryRecord } from "@/types/smartdoc-library";
import {
  buildWorkspaceDocumentRows,
  defaultTargetDealId,
  WORKSPACE_CREATE_DOCUMENT_PRESETS,
  workspaceDocumentsLinkSummary,
  type WorkspaceDocumentsContext,
} from "@/lib/workspace-documents-data";
import {
  applyWorkspaceDocumentTableQuery,
  buildWorkspaceDocumentFilterDefinitions,
  defaultDocumentTableQuery,
  toggleDocumentSort,
} from "@/lib/workspace-documents-table";
import { WorkspaceDocumentsBrowseTable } from "@/components/documents/workspace-documents-browse-table";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { WORKSPACE_PANEL_SURFACE } from "@/lib/workspace-design-system";
import { WorkspaceModeNav } from "@/components/ui/workspace-mode-nav";

type DocumentsMode = "browse" | "create" | "import";

type WorkspaceDocumentsPanelProps = {
  context: WorkspaceDocumentsContext;
  pipelines: PipelineRow[];
  companies: Company[];
  activities?: Activity[];
  readOnly?: boolean;
  onDocumentCountChange?: (count: number) => void;
};

export function WorkspaceDocumentsPanel({
  context,
  pipelines,
  companies,
  activities = [],
  readOnly = false,
  onDocumentCountChange,
}: WorkspaceDocumentsPanelProps) {
  const [mode, setMode] = useState<DocumentsMode>("browse");
  const [library, setLibrary] = useState<SmartDocLibraryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [targetDealId, setTargetDealId] = useState<string>("");
  const [presetIndex, setPresetIndex] = useState(0);
  const [documentName, setDocumentName] = useState("");
  const [originalFileName, setOriginalFileName] = useState<string | undefined>();
  const [createdDocument, setCreatedDocument] = useState<SmartDocLibraryRecord | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [tableQuery, setTableQuery] = useState(defaultDocumentTableQuery);

  const preset = WORKSPACE_CREATE_DOCUMENT_PRESETS[presetIndex] ?? WORKSPACE_CREATE_DOCUMENT_PRESETS[0]!;
  const resolvedDealId = targetDealId || defaultTargetDealId(context, pipelines) || "";
  const targetPipeline = pipelines.find((deal) => deal.id === resolvedDealId);
  const dealOptions = useMemo(
    () =>
      context.pipelineIds
        .map((id) => pipelines.find((deal) => deal.id === id))
        .filter((deal): deal is PipelineRow => Boolean(deal)),
    [context.pipelineIds, pipelines],
  );

  const rows = useMemo(
    () => buildWorkspaceDocumentRows(library, context, pipelines, companies, activities),
    [library, context, pipelines, companies, activities],
  );

  const filterDefinitions = useMemo(
    () => buildWorkspaceDocumentFilterDefinitions(rows),
    [rows],
  );

  const displayedRows = useMemo(
    () => applyWorkspaceDocumentTableQuery(rows, tableQuery),
    [rows, tableQuery],
  );

  useEffect(() => {
    setTableQuery(defaultDocumentTableQuery());
  }, [context.scope, context.companyId, context.contactId, context.dealId]);

  useEffect(() => {
    onDocumentCountChange?.(rows.length);
  }, [onDocumentCountChange, rows.length]);

  const identityPreview = useMemo(() => {
    if (!targetPipeline) return null;
    return buildSmartDocIdentityPreview(
      targetPipeline.id,
      targetPipeline.assetName,
      preset.category,
      preset.type,
      library.map((record) => record.SmartDocID),
    );
  }, [targetPipeline, preset, library]);

  const nameSuggestions = useMemo(() => {
    if (!targetPipeline) return null;
    const company = companies.find((row) => row.pipelineIds.includes(targetPipeline.id));
    return suggestDocumentNames(
      targetPipeline.id,
      targetPipeline.assetName,
      company?.Title ?? targetPipeline.companyRole,
      preset.type,
    );
  }, [targetPipeline, preset.type, companies]);

  const loadLibrary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/smartdocs/library");
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Failed to load documents");
      setLibrary((body.library as SmartDocLibraryRecord[]) ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadLibrary();
  }, [loadLibrary]);

  useEffect(() => {
    const initial = defaultTargetDealId(context, pipelines);
    if (initial) setTargetDealId(initial);
  }, [context, pipelines]);

  useEffect(() => {
    if (nameSuggestions && !documentName) {
      setDocumentName(nameSuggestions.primary);
    }
  }, [nameSuggestions, documentName]);

  const handleCreate = async (input?: Partial<CreateSmartDocInput>) => {
    if (!resolvedDealId || readOnly) return;

    setSaving(true);
    setError(null);

    const payload: CreateSmartDocInput = {
      DocCategory: input?.DocCategory ?? preset.category,
      DocType: input?.DocType ?? preset.type,
      DocumentName:
        input?.DocumentName ??
        (documentName.trim() || nameSuggestions?.primary || preset.label),
      originalFileName: input?.originalFileName ?? originalFileName,
    };

    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(resolvedDealId)}/smartdocs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Failed to create document");

      const record = body.document as SmartDocLibraryRecord;
      setCreatedDocument(record);
      setLibrary((current) => [...current, record]);
      setMode("browse");
      setDocumentName("");
      setOriginalFileName(undefined);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create document");
    } finally {
      setSaving(false);
    }
  };

  const handleFilePick = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    setOriginalFileName(file.name);
    const classified = classifyByFileName(file.name);
    const matchingPreset = WORKSPACE_CREATE_DOCUMENT_PRESETS.findIndex(
      (item) => item.type === classified.DocType,
    );
    if (matchingPreset >= 0) setPresetIndex(matchingPreset);
    if (!documentName) setDocumentName(file.name.replace(/\.[^.]+$/, ""));
    setMode("import");
  };

  const modeItems = useMemo(() => {
    const items: Array<{ id: DocumentsMode; label: string }> = [
      { id: "browse", label: "Browse" },
    ];
    if (!readOnly) {
      items.push({ id: "create", label: "Create" });
      items.push({ id: "import", label: "Import" });
    }
    return items;
  }, [readOnly]);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-carbon-blue/60">{workspaceDocumentsLinkSummary(context)}</p>

      <WorkspaceModeNav
        ariaLabel="Documents"
        items={modeItems}
        active={mode}
        onChange={(id) => setMode(id as DocumentsMode)}
      />

      {error ? <p className="text-[12px] text-red-600">{error}</p> : null}

      {createdDocument ? (
        <div className="border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3 text-[12px] text-carbon-blue">
          Created{" "}
          <Link href={`/documents/${encodeURIComponent(createdDocument.SmartDocID)}`} className="font-semibold text-upcycle-orange hover:underline">
            {createdDocument.DocumentName}
          </Link>
          . SmartDoc ID <span className="font-mono">{createdDocument.SmartDocID}</span>
        </div>
      ) : null}

      {mode === "browse" ? (
        loading ? (
          <p className="text-sm text-carbon-blue/45">Loading documents…</p>
        ) : rows.length === 0 ? (
          <p className="border border-dashed border-carbon-blue/15 px-6 py-10 text-center text-sm text-carbon-blue/45">
            No documents in this workspace yet. Create or import a SmartDoc to get started.
          </p>
        ) : (
          <div className={`${WORKSPACE_PANEL_SURFACE} overflow-hidden p-0`}>
            <div className="border-b border-carbon-blue/8 px-4 py-3 sm:px-5">
              <FilterToolbar
                filters={filterDefinitions}
                values={tableQuery.filters}
                onChange={(id, value) =>
                  setTableQuery((current) => ({
                    ...current,
                    filters: { ...current.filters, [id]: value },
                  }))
                }
                search={tableQuery.search}
                onSearchChange={(search) =>
                  setTableQuery((current) => ({ ...current, search }))
                }
                searchPlaceholder="Search documents…"
                entityLabel="Documents"
                totalCount={rows.length}
                filteredCount={displayedRows.length}
                defaultValues={defaultDocumentTableQuery().filters}
                onClearAll={() => setTableQuery(defaultDocumentTableQuery())}
              />
            </div>
            {displayedRows.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-carbon-blue/45">
                No documents match your filters. Try clearing search or filters.
              </p>
            ) : (
              <WorkspaceDocumentsBrowseTable
                rows={displayedRows}
                sortKey={tableQuery.sortKey}
                sortDir={tableQuery.sortDir}
                onSort={(column) =>
                  setTableQuery((current) => toggleDocumentSort(current, column))
                }
              />
            )}
          </div>
        )
      ) : null}

      {mode === "create" && !readOnly ? (
        <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-4">
          {context.scope !== "opportunity" && dealOptions.length > 1 ? (
            <label className="mb-3 block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">Link to opportunity</span>
              <select
                value={resolvedDealId}
                onChange={(event) => setTargetDealId(event.target.value)}
                className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
              >
                {dealOptions.map((deal) => (
                  <option key={deal.id} value={deal.id}>
                    {deal.id} · {deal.assetName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">Document type</span>
            <select
              value={presetIndex}
              onChange={(event) => {
                setPresetIndex(Number(event.target.value));
                setDocumentName("");
              }}
              className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
            >
              {WORKSPACE_CREATE_DOCUMENT_PRESETS.map((item, index) => (
                <option key={item.label} value={index}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label className="mt-3 block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">Document name</span>
            <input
              type="text"
              value={documentName}
              onChange={(event) => setDocumentName(event.target.value)}
              placeholder={nameSuggestions?.primary ?? preset.label}
              className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
            />
          </label>

          {identityPreview ? (
            <p className="mt-3 text-[11px] text-carbon-blue/55">
              SmartDoc ID <span className="font-mono font-semibold text-carbon-blue">{identityPreview.documentId}</span>
            </p>
          ) : null}

          <button
            type="button"
            disabled={saving || !resolvedDealId}
            onClick={() => void handleCreate()}
            className="mt-4 border border-upcycle-orange bg-upcycle-orange px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create SmartDoc"}
          </button>
        </div>
      ) : null}

      {mode === "import" && !readOnly ? (
        <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-4">
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              handleFilePick(event.dataTransfer.files);
            }}
            className={`border border-dashed px-4 py-8 text-center transition-colors ${
              dragActive ? "border-upcycle-orange bg-upcycle-orange/[0.04]" : "border-carbon-blue/20"
            }`}
          >
            <p className="text-sm font-medium text-carbon-blue">Drag & drop a file here</p>
            <p className="mt-1 text-[11px] text-carbon-blue/50">or choose a file to classify and import</p>
            <input
              type="file"
              className="mt-3 text-[11px] text-carbon-blue/70"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg"
              onChange={(event) => handleFilePick(event.target.files)}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {["Outlook", "SharePoint", "OneDrive"].map((source) => (
              <button
                key={source}
                type="button"
                disabled
                title="Coming soon"
                className="border border-carbon-blue/10 px-2.5 py-1 text-[10px] font-semibold text-carbon-blue/35"
              >
                {source} (soon)
              </button>
            ))}
          </div>

          {originalFileName ? (
            <div className="mt-4 space-y-3">
              <p className="text-[11px] text-carbon-blue/60">
                Selected <span className="font-mono">{originalFileName}</span>
                {preset ? ` · classified as ${preset.label}` : null}
              </p>
              <button
                type="button"
                disabled={saving || !resolvedDealId}
                onClick={() => void handleCreate()}
                className="border border-upcycle-orange bg-upcycle-orange px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Importing…" : "Import as SmartDoc"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
