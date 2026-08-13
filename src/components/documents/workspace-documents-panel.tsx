"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type DragEvent } from "react";
import { Sparkles } from "lucide-react";
import {
  classifyByFileName,
  suggestImportDocumentName,
} from "@/lib/mock-ai-parser";
import {
  buildCompanySmartDocIdentityPreview,
  buildProjectSmartDocIdentityPreview,
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
  SmartDocOrigin,
} from "@/types/smartdoc-library";
import {
  SMARTDOC_CATEGORIES,
  SMARTDOC_ORIGIN_LABELS,
  SMARTDOC_ORIGINS,
  SMARTDOC_TYPES_BY_CATEGORY,
  suggestOriginForDocType,
} from "@/types/smartdoc-library";
import {
  buildWorkspaceDocumentRows,
  canCreateCompanyOwnedDocuments,
  defaultTargetDealId,
  WORKSPACE_COMPANY_DOCUMENT_PRESETS,
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

type ImportQueueItem = {
  id: string;
  file: File;
  originalFileName: string;
  DocCategory: SmartDocCategory;
  DocType: string;
  DocumentName: string;
  Origin: SmartDocOrigin;
  Counterparty: string;
  reason: string;
  status: "ready" | "importing" | "done" | "error";
  error?: string;
  result?: SmartDocLibraryRecord;
};

function newImportItemId(): string {
  return `imp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function classifyFileToQueueItem(file: File, dealName: string): ImportQueueItem {
  const classified = classifyByFileName(file.name);
  return {
    id: newImportItemId(),
    file,
    originalFileName: file.name,
    DocCategory: classified.DocCategory,
    DocType: classified.DocType,
    DocumentName: suggestImportDocumentName({
      dealName,
      docType: classified.DocType,
      originalFileName: file.name,
      referenceNumber: classified.referenceNumber,
    }),
    Origin: classified.Origin,
    Counterparty: classified.Counterparty ?? "",
    reason: classified.reason,
    status: "ready",
  };
}

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
  /** Company scope: file as company-owned when no deal (or user chooses company). */
  const [ownershipMode, setOwnershipMode] = useState<"company" | "opportunity">(
    "company",
  );
  const [presetIndex, setPresetIndex] = useState(0);
  const [documentName, setDocumentName] = useState("");
  const [createdDocuments, setCreatedDocuments] = useState<SmartDocLibraryRecord[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [tableQuery, setTableQuery] = useState(defaultDocumentTableQuery);
  const [importQueue, setImportQueue] = useState<ImportQueueItem[]>([]);
  const [classifying, setClassifying] = useState(false);

  const resolvedDealId = targetDealId || defaultTargetDealId(context, pipelines) || "";
  const dealOptions = useMemo(
    () =>
      context.pipelineIds
        .map((id) => pipelines.find((deal) => deal.id === id))
        .filter((deal): deal is PipelineRow => Boolean(deal)),
    [context.pipelineIds, pipelines],
  );

  const companyOwnedEnabled = canCreateCompanyOwnedDocuments(context);
  const useCompanyOwnership =
    companyOwnedEnabled &&
    (ownershipMode === "company" || !resolvedDealId || dealOptions.length === 0);

  const documentPresets =
    useCompanyOwnership && context.scope === "company"
      ? WORKSPACE_COMPANY_DOCUMENT_PRESETS
      : WORKSPACE_CREATE_DOCUMENT_PRESETS;
  const preset = documentPresets[presetIndex] ?? documentPresets[0]!;
  const targetPipeline = pipelines.find((deal) => deal.id === resolvedDealId);
  const ownerCompany =
    companies.find((row) => row.CompanyID === context.companyId) ??
    companies.find((row) =>
      targetPipeline ? row.pipelineIds.includes(targetPipeline.id) : false,
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
  }, [context.scope, context.companyId, context.contactId, context.dealId, context.projectId]);

  useEffect(() => {
    onDocumentCountChange?.(rows.length);
  }, [onDocumentCountChange, rows.length]);

  const isProjectScope = context.scope === "project" && Boolean(context.projectId);

  const identityPreview = useMemo(() => {
    if (isProjectScope && context.projectId) {
      return buildProjectSmartDocIdentityPreview(
        context.projectId.toUpperCase(),
        context.projectName || context.projectId,
        preset.category,
        preset.type,
        library.map((record) => record.SmartDocID),
      );
    }
    if (useCompanyOwnership && ownerCompany) {
      const companyCode =
        (ownerCompany.code?.trim() || ownerCompany.CompanyID).toUpperCase();
      return buildCompanySmartDocIdentityPreview(
        companyCode,
        ownerCompany.Title,
        preset.category,
        preset.type,
        library.map((record) => record.SmartDocID),
      );
    }
    if (!targetPipeline) return null;
    const plNumber = opportunityPublicCode(targetPipeline);
    return buildSmartDocIdentityPreview(
      plNumber,
      targetPipeline.assetName,
      preset.category,
      preset.type,
      library.map((record) => record.SmartDocID),
    );
  }, [
    isProjectScope,
    context.projectId,
    context.projectName,
    useCompanyOwnership,
    ownerCompany,
    targetPipeline,
    preset,
    library,
  ]);

  const importIdentityIds = useMemo(() => {
    const ids = library.map((record) => record.SmartDocID);
    const provisional: Array<string | null> = [];
    const known = [...ids];

    if (isProjectScope && context.projectId) {
      const projectCode = context.projectId.toUpperCase();
      const projectName = context.projectName || context.projectId;
      for (const item of importQueue) {
        if (item.status === "done" && item.result?.SmartDocID) {
          provisional.push(item.result.SmartDocID);
          if (!known.includes(item.result.SmartDocID)) {
            known.push(item.result.SmartDocID);
          }
          continue;
        }
        const preview = buildProjectSmartDocIdentityPreview(
          projectCode,
          projectName,
          item.DocCategory,
          item.DocType,
          known,
        );
        provisional.push(preview.documentId);
        known.push(preview.documentId);
      }
      return provisional;
    }

    if (useCompanyOwnership && ownerCompany) {
      const companyCode =
        (ownerCompany.code?.trim() || ownerCompany.CompanyID).toUpperCase();
      for (const item of importQueue) {
        if (item.status === "done" && item.result?.SmartDocID) {
          provisional.push(item.result.SmartDocID);
          if (!known.includes(item.result.SmartDocID)) {
            known.push(item.result.SmartDocID);
          }
          continue;
        }
        const preview = buildCompanySmartDocIdentityPreview(
          companyCode,
          ownerCompany.Title,
          item.DocCategory,
          item.DocType,
          known,
        );
        provisional.push(preview.documentId);
        known.push(preview.documentId);
      }
      return provisional;
    }

    if (!targetPipeline) return importQueue.map(() => null);

    const plNumber = opportunityPublicCode(targetPipeline);
    for (const item of importQueue) {
      if (item.status === "done" && item.result?.SmartDocID) {
        provisional.push(item.result.SmartDocID);
        if (!known.includes(item.result.SmartDocID)) {
          known.push(item.result.SmartDocID);
        }
        continue;
      }
      const preview = buildSmartDocIdentityPreview(
        plNumber,
        targetPipeline.assetName,
        item.DocCategory,
        item.DocType,
        known,
      );
      provisional.push(preview.documentId);
      known.push(preview.documentId);
    }
    return provisional;
  }, [
    importQueue,
    library,
    targetPipeline,
    useCompanyOwnership,
    ownerCompany,
    isProjectScope,
    context.projectId,
    context.projectName,
  ]);

  const nameSuggestions = useMemo(() => {
    if (isProjectScope && context.projectId) {
      return suggestDocumentNames(
        context.projectId.toUpperCase(),
        context.projectName || context.projectId,
        context.companyName || context.projectName || context.projectId,
        preset.type,
      );
    }
    if (useCompanyOwnership && ownerCompany) {
      const companyCode =
        (ownerCompany.code?.trim() || ownerCompany.CompanyID).toUpperCase();
      return suggestDocumentNames(
        companyCode,
        ownerCompany.Title,
        ownerCompany.Title,
        preset.type,
      );
    }
    if (!targetPipeline) return null;
    const company = companies.find((row) => row.pipelineIds.includes(targetPipeline.id));
    return suggestDocumentNames(
      opportunityPublicCode(targetPipeline),
      targetPipeline.assetName,
      company?.Title ?? targetPipeline.companyRole,
      preset.type,
    );
  }, [
    isProjectScope,
    context.projectId,
    context.projectName,
    context.companyName,
    useCompanyOwnership,
    ownerCompany,
    targetPipeline,
    preset.type,
    companies,
  ]);

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
    if (context.scope === "company") {
      // Prefer company ownership so supplier docs don't invent deals.
      setOwnershipMode("company");
    }
  }, [context, pipelines]);

  useEffect(() => {
    if (nameSuggestions && !documentName && mode === "create") {
      setDocumentName(nameSuggestions.primary);
    }
  }, [nameSuggestions, documentName, mode]);

  const canSubmitDocuments =
    !readOnly &&
    (isProjectScope
      ? Boolean(context.projectId)
      : useCompanyOwnership
        ? Boolean(context.companyId)
        : Boolean(resolvedDealId));

  const postSmartDoc = async (
    payload: CreateSmartDocInput,
    file?: File | null,
  ): Promise<SmartDocLibraryRecord> => {
    const endpoint = isProjectScope
      ? `/api/projects/${encodeURIComponent(context.projectId!)}/smartdocs`
      : useCompanyOwnership
        ? `/api/companies/${encodeURIComponent(context.companyId!)}/smartdocs`
        : `/api/deals/${encodeURIComponent(resolvedDealId)}/smartdocs`;

    let response: Response;
    if (file) {
      const form = new FormData();
      form.append("DocCategory", payload.DocCategory);
      form.append("DocType", payload.DocType);
      form.append("DocumentName", payload.DocumentName);
      if (payload.originalFileName) {
        form.append("originalFileName", payload.originalFileName);
      }
      if (payload.DocumentSetID && !useCompanyOwnership && !isProjectScope) {
        form.append("DocumentSetID", payload.DocumentSetID);
      }
      if (payload.Origin) {
        form.append("Origin", payload.Origin);
      }
      if (payload.Counterparty) {
        form.append("Counterparty", payload.Counterparty);
      }
      if (isProjectScope && context.projectId) {
        form.append("LinkedProjectId", context.projectId);
      }
      form.append("file", file, file.name);
      response = await fetch(endpoint, {
        method: "POST",
        body: form,
      });
    } else {
      response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          ...(isProjectScope && context.projectId
            ? { LinkedProjectId: context.projectId }
            : {}),
        }),
      });
    }
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Failed to create document");
    return body.document as SmartDocLibraryRecord;
  };

  const handleCreate = async () => {
    if (!canSubmitDocuments) return;

    setSaving(true);
    setError(null);

    const payload: CreateSmartDocInput = {
      DocCategory: preset.category,
      DocType: preset.type,
      DocumentName: documentName.trim() || nameSuggestions?.primary || preset.label,
      Origin: useCompanyOwnership
        ? suggestOriginForDocType(preset.type)
        : "standard_bio",
      Counterparty:
        useCompanyOwnership && suggestOriginForDocType(preset.type) === "external"
          ? context.companyName
          : undefined,
    };

    try {
      const record = await postSmartDoc(payload);
      setCreatedDocuments([record]);
      setLibrary((current) => [...current, record]);
      setMode("browse");
      setDocumentName("");
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create document");
    } finally {
      setSaving(false);
    }
  };

  const handleImportAll = async () => {
    if (!canSubmitDocuments) return;
    const pending = importQueue.filter(
      (item) => item.status === "ready" || item.status === "error",
    );
    if (pending.length === 0) return;

    setSaving(true);
    setError(null);
    const imported: SmartDocLibraryRecord[] = [];
    let failureCount = 0;

    for (const item of pending) {
      if (!item.DocumentName.trim()) {
        failureCount += 1;
        setImportQueue((current) =>
          current.map((row) =>
            row.id === item.id
              ? { ...row, status: "error", error: "File name is required" }
              : row,
          ),
        );
        continue;
      }

      setImportQueue((current) =>
        current.map((row) =>
          row.id === item.id ? { ...row, status: "importing", error: undefined } : row,
        ),
      );

      try {
        const record = await postSmartDoc(
          {
            DocCategory: item.DocCategory,
            DocType: item.DocType,
            DocumentName: item.DocumentName.trim(),
            originalFileName: item.originalFileName,
            Origin: item.Origin,
            Counterparty:
              item.Origin === "external" ? item.Counterparty.trim() || undefined : undefined,
          },
          item.file,
        );
        imported.push(record);
        setLibrary((current) => [...current, record]);
        setImportQueue((current) =>
          current.map((row) =>
            row.id === item.id ? { ...row, status: "done", result: record } : row,
          ),
        );
      } catch (importError) {
        failureCount += 1;
        const message =
          importError instanceof Error ? importError.message : "Failed to import document";
        setImportQueue((current) =>
          current.map((row) =>
            row.id === item.id ? { ...row, status: "error", error: message } : row,
          ),
        );
      }
    }

    if (imported.length > 0) {
      setCreatedDocuments(imported);
    }

    setImportQueue((current) => current.filter((row) => row.status !== "done"));
    if (imported.length > 0 && failureCount === 0) {
      setImportQueue([]);
      setMode("browse");
    }

    setSaving(false);
  };

  const enqueueFiles = useCallback(
    (files: FileList | File[] | null) => {
      const list = files ? Array.from(files) : [];
      if (list.length === 0) return;

      setClassifying(true);
      setError(null);
      setMode("import");
      const dealName =
        (useCompanyOwnership
          ? context.companyName || ownerCompany?.Title
          : targetPipeline?.assetName) || "Document";

      window.setTimeout(() => {
        setImportQueue((current) => {
          const existingNames = new Set(
            current.map((item) => `${item.originalFileName}:${item.file.size}`),
          );
          const next = list
            .filter((file) => !existingNames.has(`${file.name}:${file.size}`))
            .map((file) => {
              const item = classifyFileToQueueItem(file, dealName);
              if (useCompanyOwnership && item.Origin === "external" && !item.Counterparty) {
                return {
                  ...item,
                  Counterparty: context.companyName || ownerCompany?.Title || "",
                };
              }
              return item;
            });
          return [...current, ...next];
        });
        setClassifying(false);
      }, 200);
    },
    [
      targetPipeline?.assetName,
      useCompanyOwnership,
      context.companyName,
      ownerCompany?.Title,
    ],
  );

  const updateQueueItem = (id: string, patch: Partial<ImportQueueItem>) => {
    setImportQueue((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  };

  const removeQueueItem = (id: string) => {
    setImportQueue((current) => current.filter((item) => item.id !== id));
  };

  const clearImportQueue = () => {
    setImportQueue([]);
  };

  const handleFilePick = (files: FileList | null) => {
    enqueueFiles(files);
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

  const readyImportCount = importQueue.filter(
    (item) =>
      (item.status === "ready" || item.status === "error") && item.DocumentName.trim(),
  ).length;

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
            clearImportQueue();
          }
        }}
      />

      {error ? <p className="text-[12px] text-red-600">{error}</p> : null}

      {createdDocuments.length > 0 ? (
        <div className="border border-emerald-500/25 bg-emerald-500/[0.06] px-4 py-3 text-[12px] text-carbon-blue">
          {createdDocuments.length === 1 ? (
            <>
              Created{" "}
              <Link
                href={`/documents/${encodeURIComponent(createdDocuments[0]!.SmartDocID)}`}
                className="font-semibold text-upcycle-orange hover:underline"
              >
                {createdDocuments[0]!.DocumentName}
              </Link>
              . SmartDoc ID{" "}
              <span className="font-mono">{createdDocuments[0]!.SmartDocID}</span>
            </>
          ) : (
            <>
              Imported {createdDocuments.length} SmartDocs:{" "}
              {createdDocuments.map((doc, index) => (
                <span key={doc.SmartDocID}>
                  {index > 0 ? ", " : null}
                  <Link
                    href={`/documents/${encodeURIComponent(doc.SmartDocID)}`}
                    className="font-semibold text-upcycle-orange hover:underline"
                  >
                    {doc.DocumentName}
                  </Link>
                </span>
              ))}
            </>
          )}
        </div>
      ) : null}

      {mode === "browse" ? (
        loading ? (
          <p className="text-sm text-carbon-blue/45">Loading documents…</p>
        ) : rows.length === 0 ? (
          <div {...onDropZone} className={`${dropZoneClass} px-6 py-10`}>
            <p className="text-sm text-carbon-blue/45">
              No documents in this workspace yet. Create or import SmartDocs to get started.
            </p>
            {!readOnly ? (
              <>
                <p className="mt-3 text-[12px] font-medium text-carbon-blue">
                  Drag & drop files here
                </p>
                <p className="mt-1 text-[11px] text-carbon-blue/50">
                  Drop one or many — SmartAssist classifies each; you confirm.
                </p>
                <input
                  type="file"
                  multiple
                  className="mt-3 text-[11px] text-carbon-blue/70"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg"
                  onChange={(event) => {
                    handleFilePick(event.target.files);
                    event.target.value = "";
                  }}
                />
              </>
            ) : null}
          </div>
        ) : (
          <div className={`${WORKSPACE_PANEL_SURFACE} overflow-hidden p-0`}>
            {!readOnly ? (
              <div {...onDropZone} className={`${dropZoneClass} m-4 mb-0 py-5`}>
                <p className="text-[12px] font-medium text-carbon-blue">
                  Drop more files to import
                </p>
                <p className="mt-1 text-[11px] text-carbon-blue/50">
                  Multiple documents welcome — review each suggestion, then confirm.
                </p>
              </div>
            ) : null}
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
          {isProjectScope ? (
            <p className="mb-3 text-[11px] text-carbon-blue/55">
              Project documents use PRJ-… identity and file under SharePoint{" "}
              <span className="font-mono">/Projects/{context.projectName || "…"}</span>.
            </p>
          ) : null}
          {companyOwnedEnabled && !isProjectScope ? (
            <label className="mb-3 block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                Ownership
              </span>
              <select
                value={useCompanyOwnership ? "company" : "opportunity"}
                onChange={(event) => {
                  const next = event.target.value as "company" | "opportunity";
                  setOwnershipMode(next);
                  setPresetIndex(0);
                  setDocumentName("");
                }}
                className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
              >
                <option value="company">
                  Company document (no opportunity required)
                </option>
                <option value="opportunity" disabled={dealOptions.length === 0}>
                  Opportunity document
                  {dealOptions.length === 0 ? " (none linked)" : ""}
                </option>
              </select>
            </label>
          ) : null}

          {!useCompanyOwnership &&
          !isProjectScope &&
          context.scope !== "opportunity" &&
          dealOptions.length > 1 ? (
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
              {documentPresets.map((item, index) => (
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
            disabled={saving || !canSubmitDocuments}
            onClick={() => void handleCreate()}
            className="mt-4 border border-upcycle-orange bg-upcycle-orange px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create SmartDoc"}
          </button>
          <p className="mt-2 text-[11px] text-carbon-blue/45">
            {isProjectScope
              ? "Project documents use PRJ-… identity. The Projects folder is created in SharePoint on first import."
              : useCompanyOwnership
                ? "Company-owned documents use CO-… identity and do not invent opportunities."
                : "Created documents are marked as Standard Bio origin."}
          </p>
        </div>
      ) : null}

      {mode === "import" && !readOnly ? (
        <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-4">
          {isProjectScope ? (
            <p className="mb-3 text-[11px] text-carbon-blue/55">
              Files import to this project and SharePoint{" "}
              <span className="font-mono">/Projects/{context.projectName || "…"}</span>.
            </p>
          ) : null}
          {companyOwnedEnabled && !isProjectScope ? (
            <label className="mb-3 block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                Ownership
              </span>
              <select
                value={useCompanyOwnership ? "company" : "opportunity"}
                onChange={(event) => {
                  const next = event.target.value as "company" | "opportunity";
                  setOwnershipMode(next);
                }}
                className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
              >
                <option value="company">
                  Company document — CO-… identity (e.g. Dorset SUQ)
                </option>
                <option value="opportunity" disabled={dealOptions.length === 0}>
                  Opportunity document — PL-… identity
                  {dealOptions.length === 0 ? " (none linked)" : ""}
                </option>
              </select>
              <p className="mt-1 text-[11px] text-carbon-blue/45">
                Supplier quotations stay on the company. No fake opportunity required.
              </p>
            </label>
          ) : null}

          <div {...onDropZone} className={dropZoneClass}>
            <p className="text-sm font-medium text-carbon-blue">
              Drag & drop files here
            </p>
            <p className="mt-1 text-[11px] text-carbon-blue/50">
              Drop several at once — SmartAssist classifies each; you confirm.
            </p>
            <input
              type="file"
              multiple
              className="mt-3 text-[11px] text-carbon-blue/70"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg"
              onChange={(event) => {
                handleFilePick(event.target.files);
                event.target.value = "";
              }}
            />
          </div>

          {classifying ? (
            <p className="mt-4 text-[12px] text-carbon-blue/55">
              SmartAssist is classifying documents…
            </p>
          ) : null}

          {importQueue.length > 0 && !classifying ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-3.5 text-upcycle-orange" />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange">
                    SmartAssist · {importQueue.length} document
                    {importQueue.length === 1 ? "" : "s"}
                  </p>
                </div>
                <p className="text-[11px] text-carbon-blue/50">
                  Review each row, then import all.
                </p>
              </div>

              {importQueue.map((item, index) => {
                const types = SMARTDOC_TYPES_BY_CATEGORY[item.DocCategory];
                const previewId = importIdentityIds[index];
                return (
                  <div
                    key={item.id}
                    className="space-y-3 border border-upcycle-orange/20 bg-upcycle-orange/[0.04] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-mono text-[10px] text-carbon-blue/45">
                          {item.originalFileName}
                        </p>
                        <p className="mt-0.5 text-[11px] text-carbon-blue/60">{item.reason}</p>
                        {item.status === "importing" ? (
                          <p className="mt-1 text-[11px] font-medium text-upcycle-orange">
                            Importing…
                          </p>
                        ) : null}
                        {item.status === "error" && item.error ? (
                          <p className="mt-1 text-[11px] text-red-600">{item.error}</p>
                        ) : null}
                        {item.status === "done" && item.result ? (
                          <p className="mt-1 text-[11px] text-emerald-700">
                            Imported as{" "}
                            <span className="font-mono">{item.result.SmartDocID}</span>
                          </p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        disabled={saving || item.status === "importing"}
                        onClick={() => removeQueueItem(item.id)}
                        className="shrink-0 text-[11px] font-semibold text-carbon-blue/45 hover:text-carbon-blue disabled:opacity-40"
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                          Category
                        </span>
                        <select
                          value={item.DocCategory}
                          disabled={item.status === "importing" || item.status === "done"}
                          onChange={(event) => {
                            const nextCategory = event.target.value as SmartDocCategory;
                            const nextTypes = SMARTDOC_TYPES_BY_CATEGORY[nextCategory];
                            const nextType = nextTypes.includes(item.DocType)
                              ? item.DocType
                              : nextTypes[0]!;
                            updateQueueItem(item.id, {
                              DocCategory: nextCategory,
                              DocType: nextType,
                              Origin: suggestOriginForDocType(nextType),
                              status: item.status === "error" ? "ready" : item.status,
                              error: undefined,
                            });
                          }}
                          className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue disabled:opacity-60"
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
                          value={item.DocType}
                          disabled={item.status === "importing" || item.status === "done"}
                          onChange={(event) => {
                            const nextType = event.target.value;
                            updateQueueItem(item.id, {
                              DocType: nextType,
                              Origin: suggestOriginForDocType(nextType),
                              status: item.status === "error" ? "ready" : item.status,
                              error: undefined,
                            });
                          }}
                          className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue disabled:opacity-60"
                        >
                          {types.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                          Origin
                        </span>
                        <select
                          value={item.Origin}
                          disabled={item.status === "importing" || item.status === "done"}
                          onChange={(event) =>
                            updateQueueItem(item.id, {
                              Origin: event.target.value as SmartDocOrigin,
                              status: item.status === "error" ? "ready" : item.status,
                              error: undefined,
                            })
                          }
                          className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue disabled:opacity-60"
                        >
                          {SMARTDOC_ORIGINS.map((origin) => (
                            <option key={origin} value={origin}>
                              {SMARTDOC_ORIGIN_LABELS[origin]}
                            </option>
                          ))}
                        </select>
                      </label>

                      {item.Origin === "external" ? (
                        <label className="block">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                            Counterparty
                          </span>
                          <input
                            type="text"
                            value={item.Counterparty}
                            disabled={item.status === "importing" || item.status === "done"}
                            placeholder="Supplier / customer name"
                            onChange={(event) =>
                              updateQueueItem(item.id, {
                                Counterparty: event.target.value,
                                status: item.status === "error" ? "ready" : item.status,
                                error: undefined,
                              })
                            }
                            className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue disabled:opacity-60"
                          />
                        </label>
                      ) : (
                        <div className="flex items-end">
                          <p className="pb-2 text-[11px] text-carbon-blue/45">
                            Produced by Standard Bio
                          </p>
                        </div>
                      )}
                    </div>

                    <label className="block">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
                        File name
                      </span>
                      <input
                        type="text"
                        value={item.DocumentName}
                        disabled={item.status === "importing" || item.status === "done"}
                        onChange={(event) =>
                          updateQueueItem(item.id, {
                            DocumentName: event.target.value,
                            status: item.status === "error" ? "ready" : item.status,
                            error: undefined,
                          })
                        }
                        className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue disabled:opacity-60"
                      />
                    </label>

                    {previewId ? (
                      <p className="text-[11px] text-carbon-blue/55">
                        SmartDoc ID{" "}
                        <span className="font-mono font-semibold text-carbon-blue">
                          {previewId}
                        </span>
                      </p>
                    ) : null}
                  </div>
                );
              })}

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving || !canSubmitDocuments || readyImportCount === 0}
                  onClick={() => void handleImportAll()}
                  className="border border-upcycle-orange bg-upcycle-orange px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
                >
                  {saving
                    ? "Importing…"
                    : readyImportCount === 1
                      ? "Confirm & Import"
                      : `Confirm & Import ${readyImportCount}`}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={clearImportQueue}
                  className="px-3 py-2 text-[11px] font-semibold text-carbon-blue/55 hover:text-carbon-blue disabled:opacity-40"
                >
                  Clear all
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
