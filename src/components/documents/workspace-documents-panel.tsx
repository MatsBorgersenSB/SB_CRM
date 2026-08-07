"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { Sparkles } from "lucide-react";
import {
  classifyByFileName,
  suggestImportDocumentName,
} from "@/lib/mock-ai-parser";
import {
  buildSmartDocIdentityPreview,
  suggestDocumentNames,
} from "@/lib/smartdoc-identity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { opportunityPublicCode } from "@/types/pipeline";
import type { Activity } from "@/types/activity";
import type {
  CreateSmartDocInput,
  SmartDocCategory,
  SmartDocLibraryRecord,
} from "@/types/smartdoc-library";
import {
  SMARTDOC_CATEGORIES,
  SMARTDOC_TYPES_BY_CATEGORY,
} from "@/types/smartdoc-library";
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

type ImportSuggestion = {
  originalFileName: string;
  DocCategory: SmartDocCategory;
  DocType: string;
  DocumentName: string;
  reason: string;
};

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
  const [createdDocument, setCreatedDocument] = useState<SmartDocLibraryRecord | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [tableQuery, setTableQuery] = useState(defaultDocumentTableQuery);
  const [importSuggestion, setImportSuggestion] = useState<ImportSuggestion | null>(null);
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [classifying, setClassifying] = useState(false);

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

  const importTypes = useMemo(
    () =>
      importSuggestion
        ? SMARTDOC_TYPES_BY_CATEGORY[importSuggestion.DocCategory]
        : [],
    [importSuggestion],
  );

  useEffect(() => {
    setTableQuery(defaultDocumentTableQuery());
  }, [context.scope, context.companyId, context.contactId, context.dealId]);

  useEffect(() => {
    onDocumentCountChange?.(rows.length);
  }, [onDocumentCountChange, rows.length]);

  const identityPreview = useMemo(() => {
    if (!targetPipeline) return null;
    const plNumber = opportunityPublicCode(targetPipeline);
    if (importSuggestion) {
      return buildSmartDocIdentityPreview(
        plNumber,
        targetPipeline.assetName,
        importSuggestion.DocCategory,
        importSuggestion.DocType,
        library.map((record) => record.SmartDocID),
      );
    }
    return buildSmartDocIdentityPreview(
      plNumber,
      targetPipeline.assetName,
      preset.category,
      preset.type,
      library.map((record) => record.SmartDocID),
    );
  }, [targetPipeline, preset, library, importSuggestion]);

  const nameSuggestions = useMemo(() => {
    if (!targetPipeline) return null;
    const company = companies.find((row) => row.pipelineIds.includes(targetPipeline.id));
    return suggestDocumentNames(
      opportunityPublicCode(targetPipeline),
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
    if (nameSuggestions && !documentName && mode === "create") {
      setDocumentName(nameSuggestions.primary);
    }
  }, [nameSuggestions, documentName, mode]);

  const handleCreate = async (input?: Partial<CreateSmartDocInput>) => {
    if (!resolvedDealId || readOnly) return;

    setSaving(true);
    setError(null);

    const payload: CreateSmartDocInput = {
      DocCategory: input?.DocCategory ?? importSuggestion?.DocCategory ?? preset.category,
      DocType: input?.DocType ?? importSuggestion?.DocType ?? preset.type,
      DocumentName:
        input?.DocumentName ??
        (importSuggestion?.DocumentName.trim() ||
          documentName.trim() ||
          nameSuggestions?.primary ||
          preset.label),
      originalFileName:
        input?.originalFileName ?? importSuggestion?.originalFileName,
    };

    try {
      let response: Response;
      if (pendingImportFile) {
        const form = new FormData();
        form.append("DocCategory", payload.DocCategory);
        form.append("DocType", payload.DocType);
        form.append("DocumentName", payload.DocumentName);
        if (payload.originalFileName) {
          form.append("originalFileName", payload.originalFileName);
        }
        if (payload.DocumentSetID) {
          form.append("DocumentSetID", payload.DocumentSetID);
        }
        form.append("file", pendingImportFile, pendingImportFile.name);
        response = await fetch(`/api/deals/${encodeURIComponent(resolvedDealId)}/smartdocs`, {
          method: "POST",
          body: form,
        });
      } else {
        response = await fetch(`/api/deals/${encodeURIComponent(resolvedDealId)}/smartdocs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Failed to create document");

      const record = body.document as SmartDocLibraryRecord;
      setCreatedDocument(record);
      setLibrary((current) => [...current, record]);
      setMode("browse");
      setDocumentName("");
      setImportSuggestion(null);
      setPendingImportFile(null);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create document");
    } finally {
      setSaving(false);
    }
  };

  const applyFileClassification = useCallback(
    (file: File) => {
      setClassifying(true);
      setError(null);
      setMode("import");
      setPendingImportFile(file);

      window.setTimeout(() => {
        const classified = classifyByFileName(file.name);
        const dealName = targetPipeline?.assetName ?? "Opportunity";
        const suggestedName = suggestImportDocumentName({
          dealName,
          docType: classified.DocType,
          originalFileName: file.name,
          referenceNumber: classified.referenceNumber,
        });

        setImportSuggestion({
          originalFileName: file.name,
          DocCategory: classified.DocCategory,
          DocType: classified.DocType,
          DocumentName: suggestedName,
          reason: classified.reason,
        });
        setClassifying(false);
      }, 250);
    },
    [targetPipeline?.assetName],
  );

  const handleFilePick = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    applyFileClassification(file);
  };

  const onDropZone = {
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(true);
    },
    onDragLeave: () => setDragActive(false),
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setDragActive(false);
      if (readOnly) return;
      handleFilePick(event.dataTransfer.files);
    },
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

  const dropZoneClass = `border border-dashed px-4 py-8 text-center transition-colors ${
    dragActive ? "border-upcycle-orange bg-upcycle-orange/[0.04]" : "border-carbon-blue/20"
  }`;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] text-carbon-blue/60">{workspaceDocumentsLinkSummary(context)}</p>

      <WorkspaceModeNav
        ariaLabel="Documents"
        items={modeItems}
        active={mode}
        onChange={(id) => {
          setMode(id as DocumentsMode);
          if (id !== "import") {
            setImportSuggestion(null);
            setPendingImportFile(null);
          }
        }}
      />

      {error ? <p className="text-[12px] text-red-600">{error}</p> : null}

      {createdDocument ? (
        <div className="border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3 text-[12px] text-carbon-blue">
          Created{" "}
          <Link
            href={`/documents/${encodeURIComponent(createdDocument.SmartDocID)}`}
            className="font-semibold text-upcycle-orange hover:underline"
          >
            {createdDocument.DocumentName}
          </Link>
          . SmartDoc ID <span className="font-mono">{createdDocument.SmartDocID}</span>
        </div>
      ) : null}

      {mode === "browse" ? (
        loading ? (
          <p className="text-sm text-carbon-blue/45">Loading documents…</p>
        ) : rows.length === 0 ? (
          <div
            {...onDropZone}
            className={`${dropZoneClass} px-6 py-10`}
          >
            <p className="text-sm text-carbon-blue/45">
              No documents in this workspace yet. Create or import a SmartDoc to get started.
            </p>
            {!readOnly ? (
              <>
                <p className="mt-3 text-[12px] font-medium text-carbon-blue">
                  Drag & drop a file here
                </p>
                <p className="mt-1 text-[11px] text-carbon-blue/50">
                  SmartAssist will suggest category, type, and file name — you confirm.
                </p>
                <input
                  type="file"
                  className="mt-3 text-[11px] text-carbon-blue/70"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg"
                  onChange={(event) => handleFilePick(event.target.files)}
                />
              </>
            ) : null}
          </div>
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
              <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                Link to opportunity
              </span>
              <select
                value={resolvedDealId}
                onChange={(event) => setTargetDealId(event.target.value)}
                className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
              >
                {dealOptions.map((deal) => (
                  <option key={deal.id} value={deal.id}>
                    {opportunityPublicCode(deal)} · {deal.assetName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
              Document type
            </span>
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
            <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
              Document name
            </span>
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
              SmartDoc ID{" "}
              <span className="font-mono font-semibold text-carbon-blue">
                {identityPreview.documentId}
              </span>
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
          <div {...onDropZone} className={dropZoneClass}>
            <p className="text-sm font-medium text-carbon-blue">Drag & drop a file here</p>
            <p className="mt-1 text-[11px] text-carbon-blue/50">
              SmartAssist suggests category, type, and name — you decide.
            </p>
            <input
              type="file"
              className="mt-3 text-[11px] text-carbon-blue/70"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg"
              onChange={(event) => handleFilePick(event.target.files)}
            />
          </div>

          {classifying ? (
            <p className="mt-4 text-[12px] text-carbon-blue/55">
              SmartAssist is classifying the document…
            </p>
          ) : null}

          {importSuggestion && !classifying ? (
            <div className="mt-4 space-y-3 border border-upcycle-orange/20 bg-upcycle-orange/[0.04] p-3">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-upcycle-orange" />
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange">
                    SmartAssist suggestion
                  </p>
                  <p className="mt-0.5 text-[11px] text-carbon-blue/60">
                    {importSuggestion.reason}. File name keeps the original source name for search —
                    change category, type, or name if needed.
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-carbon-blue/45">
                    Source: {importSuggestion.originalFileName}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                    Category
                  </span>
                  <select
                    value={importSuggestion.DocCategory}
                    onChange={(event) => {
                      const nextCategory = event.target.value as SmartDocCategory;
                      const nextTypes = SMARTDOC_TYPES_BY_CATEGORY[nextCategory];
                      const nextType = nextTypes.includes(importSuggestion.DocType)
                        ? importSuggestion.DocType
                        : nextTypes[0]!;
                      setImportSuggestion({
                        ...importSuggestion,
                        DocCategory: nextCategory,
                        DocType: nextType,
                      });
                    }}
                    className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
                  >
                    {SMARTDOC_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                    Document type
                  </span>
                  <select
                    value={importSuggestion.DocType}
                    onChange={(event) => {
                      const nextType = event.target.value;
                      setImportSuggestion({
                        ...importSuggestion,
                        DocType: nextType,
                      });
                    }}
                    className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
                  >
                    {importTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block">
                <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                  File name
                </span>
                <input
                  type="text"
                  value={importSuggestion.DocumentName}
                  onChange={(event) =>
                    setImportSuggestion({
                      ...importSuggestion,
                      DocumentName: event.target.value,
                    })
                  }
                  className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
                />
              </label>

              {identityPreview ? (
                <p className="text-[11px] text-carbon-blue/55">
                  SmartDoc ID{" "}
                  <span className="font-mono font-semibold text-carbon-blue">
                    {identityPreview.documentId}
                  </span>
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={
                    saving ||
                    !resolvedDealId ||
                    !importSuggestion.DocumentName.trim()
                  }
                  onClick={() =>
                    void handleCreate({
                      DocCategory: importSuggestion.DocCategory,
                      DocType: importSuggestion.DocType,
                      DocumentName: importSuggestion.DocumentName.trim(),
                      originalFileName: importSuggestion.originalFileName,
                    })
                  }
                  className="border border-upcycle-orange bg-upcycle-orange px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
                >
                  {saving ? "Importing…" : "Confirm & Import"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportSuggestion(null);
                    setPendingImportFile(null);
                  }}
                  className="px-3 py-2 text-[11px] font-semibold text-carbon-blue/55 hover:text-carbon-blue"
                >
                  Clear
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
