"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Check,
  CheckCircle2,
  Copy,
  FileUp,
  Info,
  Sparkles,
  Upload,
} from "lucide-react";
import {
  buildSmartDocIdentityPreview,
  resolveCategoryLabel,
  SMARTDOC_IDENTITY_EXPLANATION,
  suggestDocumentNames,
} from "@/lib/smartdoc-identity";
import { DealDocumentSetsPanel } from "@/components/pipelines/deal-document-sets-panel";
import type { DocumentSet } from "@/types/document-set";
import { documentSet360Href } from "@/types/document-set";
import { classifyByFileName } from "@/lib/mock-ai-parser";
import type {
  DealDocumentContext,
  SmartDocCategory,
  SmartDocIdentityPreview,
  SmartDocLibraryRecord,
} from "@/types/smartdoc-library";
import {
  SMARTDOC_CATEGORIES,
  SMARTDOC_TYPES_BY_CATEGORY,
} from "@/types/smartdoc-library";

type DealDocumentsPanelProps = {
  dealId: string;
  readOnly?: boolean;
  onDocumentCreated?: (record: SmartDocLibraryRecord) => void;
};

type UploadPhase = "form" | "success";

function PreviewField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        {label}
      </p>
      <p
        className={`mt-0.5 text-sm font-semibold text-carbon-blue ${
          mono ? "font-mono text-[12px]" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function DealContextCard({ context }: { context: DealDocumentContext }) {
  return (
    <p className="text-[11px] text-carbon-blue/55">
      <span className="font-mono text-carbon-blue/70">{context.plNumber}</span>
      {" · "}
      {context.dealName}
      {" · "}
      {context.clientName}
      {" · "}
      {context.commercialStage}
    </p>
  );
}

function DocumentIdentityCard({
  identity,
  docType,
  copied,
  showExplanation,
  onCopy,
  onToggleExplanation,
}: {
  identity: SmartDocIdentityPreview;
  docType: string;
  copied: boolean;
  showExplanation: boolean;
  onCopy: () => void;
  onToggleExplanation: () => void;
}) {
  return (
    <section className="overflow-hidden border border-upcycle-orange/25 bg-gradient-to-br from-upcycle-orange/[0.06] to-white">
      <header className="flex items-start justify-between gap-2 border-b border-upcycle-orange/15 px-3 py-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange">
            Document identity
          </p>
          <p className="mt-0.5 text-[10px] text-carbon-blue/50">
            Reserved before upload · {identity.categoryLabel} · {docType}
          </p>
        </div>
        <button
          type="button"
          onClick={onToggleExplanation}
          className="inline-flex shrink-0 items-center gap-1 border border-carbon-blue/10 bg-white px-1.5 py-1 text-[9px] font-semibold text-carbon-blue/55 hover:border-upcycle-orange/30 hover:text-upcycle-orange"
          aria-expanded={showExplanation}
          title="How SmartDoc IDs work"
        >
          <Info className="size-3" />
          ID format
        </button>
      </header>
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <p className="font-mono text-sm font-bold tracking-tight text-carbon-blue">
          {identity.documentId}
        </p>
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex shrink-0 items-center gap-1 border border-carbon-blue/15 bg-white px-2 py-1 text-[10px] font-semibold text-carbon-blue/70 hover:border-upcycle-orange/30 hover:text-upcycle-orange"
        >
          {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      {showExplanation ? (
        <p className="border-t border-upcycle-orange/10 px-3 py-2 text-[10px] leading-relaxed text-carbon-blue/55">
          {SMARTDOC_IDENTITY_EXPLANATION}
        </p>
      ) : null}
    </section>
  );
}

function NameSuggestionChips({
  suggestions,
  selectedName,
  disabled,
  onSelect,
}: {
  suggestions: ReturnType<typeof suggestDocumentNames>;
  selectedName: string;
  disabled?: boolean;
  onSelect: (name: string) => void;
}) {
  const all = [suggestions.primary, ...suggestions.alternatives];

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        <Sparkles className="size-3 text-upcycle-orange" />
        Smart name suggestions
      </p>
      <div className="flex flex-col gap-1.5">
        {all.map((name, index) => {
          const isPrimary = index === 0;
          const isSelected = selectedName.trim() === name.trim();

          return (
            <button
              key={name}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(name)}
              className={`flex items-center justify-between gap-2 border px-2.5 py-2 text-left text-xs transition-colors disabled:opacity-50 ${
                isSelected
                  ? "border-upcycle-orange/40 bg-upcycle-orange/[0.08] text-carbon-blue"
                  : "border-carbon-blue/10 bg-white text-carbon-blue/80 hover:border-upcycle-orange/25 hover:bg-upcycle-orange/[0.03]"
              }`}
            >
              <span className="min-w-0 truncate font-medium">{name}</span>
              <span className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                {isPrimary ? "Primary" : `Alt ${index}`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UploadSuccessCard({
  document,
  onUploadAnother,
}: {
  document: SmartDocLibraryRecord;
  onUploadAnother: () => void;
}) {
  return (
    <section className="overflow-hidden border border-emerald-500/25 bg-gradient-to-br from-emerald-500/[0.08] to-white">
      <div className="px-4 py-5">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-emerald-600" />
          <p className="text-sm font-semibold text-carbon-blue">SmartDoc created</p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <PreviewField label="Document ID" value={document.SmartDocID} mono />
          <PreviewField label="Document Name" value={document.DocumentName} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href={`/documents/${encodeURIComponent(document.SmartDocID)}`}
            className="inline-flex items-center border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white hover:bg-upcycle-orange/90"
          >
            Open document
          </Link>
          <button
            type="button"
            onClick={onUploadAnother}
            className="inline-flex items-center gap-1 border border-carbon-blue/15 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue hover:border-upcycle-orange/30 hover:text-upcycle-orange"
          >
            <Upload className="size-3" />
            Upload another
          </button>
        </div>
      </div>
    </section>
  );
}

export function DealDocumentsPanel({
  dealId,
  readOnly = false,
  onDocumentCreated,
}: DealDocumentsPanelProps) {
  const [context, setContext] = useState<DealDocumentContext | null>(null);
  const [documents, setDocuments] = useState<SmartDocLibraryRecord[]>([]);
  const [existingIdentityIds, setExistingIdentityIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadPhase, setUploadPhase] = useState<UploadPhase>("form");
  const [createdDocument, setCreatedDocument] = useState<SmartDocLibraryRecord | null>(null);
  const [docCategory, setDocCategory] = useState<SmartDocCategory>("Commercial");
  const [docType, setDocType] = useState(SMARTDOC_TYPES_BY_CATEGORY.Commercial[0]!);
  const [documentName, setDocumentName] = useState("");
  const [nameManuallyEdited, setNameManuallyEdited] = useState(false);
  const [originalFileName, setOriginalFileName] = useState<string | undefined>();
  const [copiedId, setCopiedId] = useState(false);
  const [showIdentityExplanation, setShowIdentityExplanation] = useState(false);
  const [documentSets, setDocumentSets] = useState<DocumentSet[]>([]);
  const [selectedDocumentSetId, setSelectedDocumentSetId] = useState<string>("");
  const [assigningDocId, setAssigningDocId] = useState<string | null>(null);

  const docTypes = useMemo(() => SMARTDOC_TYPES_BY_CATEGORY[docCategory], [docCategory]);

  const identityPreview = useMemo<SmartDocIdentityPreview | null>(() => {
    if (!context) return null;
    return buildSmartDocIdentityPreview(
      context.plNumber,
      context.dealName,
      docCategory,
      docType,
      existingIdentityIds,
    );
  }, [context, docCategory, docType, existingIdentityIds]);

  const nameSuggestions = useMemo(() => {
    if (!context) return null;
    return suggestDocumentNames(
      context.plNumber,
      context.dealName,
      context.clientName,
      docType,
    );
  }, [context, docType]);

  const quotationSets = useMemo(
    () =>
      documentSets.filter(
        (set) =>
          set.type === "price_indication" ||
          set.type === "budget_quotation" ||
          set.type === "formal_quotation",
      ),
    [documentSets],
  );

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [docsResponse, setsResponse] = await Promise.all([
        fetch(`/api/deals/${encodeURIComponent(dealId)}/smartdocs`),
        fetch(`/api/deals/${encodeURIComponent(dealId)}/document-sets`),
      ]);
      const body = await docsResponse.json();
      if (!docsResponse.ok) {
        throw new Error(body.error ?? "Failed to load documents");
      }
      const setsBody = await setsResponse.json();
      if (setsResponse.ok) {
        setDocumentSets((setsBody.documentSets as DocumentSet[]) ?? []);
      }
      setContext(body.context as DealDocumentContext);
      setDocuments(body.documents as SmartDocLibraryRecord[]);
      setExistingIdentityIds((body.existingIdentityIds as string[]) ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load documents");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (!docTypes.includes(docType)) {
      setDocType(docTypes[0]!);
    }
  }, [docCategory, docType, docTypes]);

  useEffect(() => {
    if (!nameSuggestions || nameManuallyEdited) return;
    setDocumentName(nameSuggestions.primary);
  }, [nameSuggestions, nameManuallyEdited]);

  const resetUploadForm = useCallback(() => {
    setUploadPhase("form");
    setCreatedDocument(null);
    setDocumentName("");
    setNameManuallyEdited(false);
    setOriginalFileName(undefined);
    setError(null);
    setCopiedId(false);
    setShowIdentityExplanation(false);
    setSelectedDocumentSetId("");
  }, []);

  const handleCopyId = useCallback(async () => {
    if (!identityPreview) return;
    try {
      await navigator.clipboard.writeText(identityPreview.documentId);
      setCopiedId(true);
      window.setTimeout(() => setCopiedId(false), 2000);
    } catch {
      setCopiedId(false);
    }
  }, [identityPreview]);

  const handleSelectName = useCallback((name: string) => {
    setDocumentName(name);
    setNameManuallyEdited(false);
  }, []);

  const handleFilePick = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    setOriginalFileName(file.name);

    const hint = classifyByFileName(file.name);
    if (SMARTDOC_CATEGORIES.includes(hint.DocCategory as SmartDocCategory)) {
      setDocCategory(hint.DocCategory as SmartDocCategory);
      const types = SMARTDOC_TYPES_BY_CATEGORY[hint.DocCategory as SmartDocCategory];
      if (types.includes(hint.DocType)) {
        setDocType(hint.DocType);
      }
    }
  };

  const handleUpload = async () => {
    if (!documentName.trim()) {
      setError("Document name is required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/smartdocs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          DocCategory: docCategory,
          DocType: docType,
          DocumentName: documentName.trim(),
          originalFileName,
          DocumentSetID: selectedDocumentSetId || undefined,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to store document");
      }

      const record = body.document as SmartDocLibraryRecord;
      setContext(body.context as DealDocumentContext);
      setDocuments(body.documents as SmartDocLibraryRecord[]);
      setExistingIdentityIds((body.existingIdentityIds as string[]) ?? existingIdentityIds);
      onDocumentCreated?.(record);
      setCreatedDocument(record);
      setUploadPhase("success");
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed");
    } finally {
      setSaving(false);
    }
  };

  const handleAssignToSet = async (smartDocId: string, documentSetId: string) => {
    if (!documentSetId) return;
    setAssigningDocId(smartDocId);
    setError(null);
    try {
      const response = await fetch(
        `/api/deals/${encodeURIComponent(dealId)}/document-sets/${encodeURIComponent(documentSetId)}/assign`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ smartDocId }),
        },
      );
      const body = await response.json();
      if (!response.ok) {
        throw new Error(body.error ?? "Failed to assign document to set");
      }
      await loadDocuments();
    } catch (assignError) {
      setError(assignError instanceof Error ? assignError.message : "Failed to assign document");
    } finally {
      setAssigningDocId(null);
    }
  };

  if (loading || !context) {
    return <p className="text-[11px] text-carbon-blue/50">Loading documents…</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <DealContextCard context={context} />
      <DealDocumentSetsPanel dealId={dealId} readOnly={readOnly} />

      {!readOnly ? (
        uploadPhase === "success" && createdDocument ? (
          <UploadSuccessCard document={createdDocument} onUploadAnother={resetUploadForm} />
        ) : (
          <section className="overflow-hidden border border-carbon-blue/10 bg-white">
            <header className="border-b border-carbon-blue/8 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange">
                Smart upload
              </p>
              <p className="mt-0.5 text-[10px] text-carbon-blue/50">
                SmartCRM understands your document before it is stored.
              </p>
            </header>

            <div className="space-y-3 p-3">
              {identityPreview ? (
                <DocumentIdentityCard
                  identity={identityPreview}
                  docType={docType}
                  copied={copiedId}
                  showExplanation={showIdentityExplanation}
                  onCopy={() => void handleCopyId()}
                  onToggleExplanation={() => setShowIdentityExplanation((value) => !value)}
                />
              ) : null}

              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                    Document category
                  </span>
                  <select
                    value={docCategory}
                    onChange={(event) => {
                      setDocCategory(event.target.value as SmartDocCategory);
                      setNameManuallyEdited(false);
                    }}
                    disabled={saving}
                    className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-xs text-carbon-blue"
                  >
                    {SMARTDOC_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {resolveCategoryLabel(category)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                    Document type
                  </span>
                  <select
                    value={docType}
                    onChange={(event) => {
                      setDocType(event.target.value);
                      setNameManuallyEdited(false);
                    }}
                    disabled={saving}
                    className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-xs text-carbon-blue"
                  >
                    {docTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {nameSuggestions ? (
                <NameSuggestionChips
                  suggestions={nameSuggestions}
                  selectedName={documentName}
                  disabled={saving}
                  onSelect={handleSelectName}
                />
              ) : null}

              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  Document name
                </span>
                <input
                  type="text"
                  value={documentName}
                  onChange={(event) => {
                    setDocumentName(event.target.value);
                    setNameManuallyEdited(true);
                  }}
                  disabled={saving}
                  placeholder={nameSuggestions?.primary ?? "Document name"}
                  className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-xs text-carbon-blue"
                />
                {nameSuggestions &&
                documentName.trim() === nameSuggestions.primary.trim() ? (
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-upcycle-orange">
                    <Sparkles className="size-3 shrink-0" />
                    Suggested by SmartDocs
                  </p>
                ) : null}
              </label>

              {quotationSets.length > 0 ? (
                <label className="block">
                  <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                    Document set (optional)
                  </span>
                  <select
                    value={selectedDocumentSetId}
                    onChange={(event) => setSelectedDocumentSetId(event.target.value)}
                    disabled={saving}
                    className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-xs text-carbon-blue"
                  >
                    <option value="">Auto-assign from filename</option>
                    {quotationSets.map((set) => (
                      <option key={set.documentSetId} value={set.documentSetId}>
                        {set.documentSetId} — {set.typeLabel}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}

              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  File
                </span>
                <div className="mt-0.5 flex items-center gap-2 border border-dashed border-carbon-blue/20 bg-carbon-blue/[0.02] px-2 py-2.5">
                  <FileUp className="size-3.5 text-carbon-blue/45" />
                  <input
                    type="file"
                    disabled={saving}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg"
                    onChange={(event) => handleFilePick(event.target.files)}
                    className="min-w-0 flex-1 text-[10px] text-carbon-blue/70"
                  />
                </div>
                {originalFileName ? (
                  <p className="mt-1 truncate font-mono text-[10px] text-carbon-blue/50">
                    {originalFileName}
                  </p>
                ) : null}
              </label>

              {error ? <p className="text-[10px] text-red-600">{error}</p> : null}

              <button
                type="button"
                disabled={saving || !documentName.trim() || !originalFileName}
                onClick={() => void handleUpload()}
                className="w-full border border-upcycle-orange bg-upcycle-orange px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white disabled:opacity-50"
              >
                {saving ? "Storing…" : "Store in SmartDocs library"}
              </button>
            </div>
          </section>
        )
      ) : null}

      <section className="border border-carbon-blue/10">
        <header className="border-b border-carbon-blue/10 px-3 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            SmartDocs library ({documents.length})
          </p>
        </header>
        {documents.length === 0 ? (
          <p className="px-3 py-4 text-[11px] text-carbon-blue/50">
            No documents stored for this deal yet.
          </p>
        ) : (
          <ul className="divide-y divide-carbon-blue/10">
            {documents.map((document) => (
              <li key={document.SmartDocID} className="px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] font-semibold text-carbon-blue/55">
                      {document.SmartDocID}
                    </p>
                    <p className="mt-0.5 text-xs font-semibold text-carbon-blue">
                      {document.DocumentName}
                    </p>
                    <p className="mt-0.5 text-[10px] text-carbon-blue/55">
                      {resolveCategoryLabel(document.DocCategory)} · {document.DocType}
                    </p>
                    <p className="mt-1 truncate font-mono text-[10px] text-carbon-blue/45">
                      {document.FileLeafRef}
                    </p>
                    {document.DocumentSetID ? (
                      <p className="mt-1 text-[10px] text-carbon-blue/50">
                        Member of{" "}
                        <Link
                          href={documentSet360Href(document.DocumentSetID)}
                          className="font-mono font-semibold text-upcycle-orange hover:underline"
                        >
                          {document.DocumentSetID}
                        </Link>
                      </p>
                    ) : !readOnly && quotationSets.length > 0 ? (
                      <div className="mt-2 flex items-center gap-1.5">
                        <select
                          defaultValue=""
                          disabled={assigningDocId === document.SmartDocID}
                          onChange={(event) => {
                            const setId = event.target.value;
                            if (setId) void handleAssignToSet(document.SmartDocID, setId);
                            event.target.value = "";
                          }}
                          className="min-w-0 flex-1 border border-carbon-blue/15 bg-white px-1.5 py-1 text-[10px] text-carbon-blue"
                        >
                          <option value="">Assign to set…</option>
                          {quotationSets.map((set) => (
                            <option key={set.documentSetId} value={set.documentSetId}>
                              {set.documentSetId}
                            </option>
                          ))}
                        </select>
                      </div>
                    ) : null}
                  </div>
                  <Link
                    href={`/documents/${encodeURIComponent(document.SmartDocID)}`}
                    className="shrink-0 text-[10px] font-semibold text-upcycle-orange hover:underline"
                  >
                    Open
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
