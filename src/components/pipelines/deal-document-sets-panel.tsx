"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { FolderPlus, Layers } from "lucide-react";
import type { DocumentSet } from "@/types/document-set";
import {
  DOCUMENT_SET_STATUS_STYLES,
  documentSet360Href,
  documentSetTypeLabel,
  type QuotationDocumentSetKind,
} from "@/types/document-set";

type DealDocumentSetsPanelProps = {
  dealId: string;
  readOnly?: boolean;
};

const CREATE_KINDS: QuotationDocumentSetKind[] = [
  "price_indication",
  "budget_quotation",
  "formal_quotation",
];

export function DealDocumentSetsPanel({
  dealId,
  readOnly = false,
}: DealDocumentSetsPanelProps) {
  const [documentSets, setDocumentSets] = useState<DocumentSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createKind, setCreateKind] = useState<QuotationDocumentSetKind>("formal_quotation");
  const [error, setError] = useState<string | null>(null);

  const loadSets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/document-sets`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Failed to load document sets");
      setDocumentSets((body.documentSets as DocumentSet[]) ?? []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load document sets");
    } finally {
      setLoading(false);
    }
  }, [dealId]);

  useEffect(() => {
    void loadSets();
  }, [loadSets]);

  const handleCreate = async () => {
    setCreating(true);
    setError(null);
    try {
      const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}/document-sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: createKind }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Failed to create document set");
      setDocumentSets((body.documentSets as DocumentSet[]) ?? []);
      setShowCreate(false);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create document set");
    } finally {
      setCreating(false);
    }
  };

  const quotationSets = documentSets.filter(
    (set) =>
      set.type === "price_indication" ||
      set.type === "budget_quotation" ||
      set.type === "formal_quotation",
  );

  return (
    <section className="border border-carbon-blue/10 bg-white">
      <header className="flex items-center justify-between gap-2 border-b border-carbon-blue/10 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <Layers className="size-3.5 text-upcycle-orange" />
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Document sets ({quotationSets.length})
          </p>
        </div>
        {!readOnly ? (
          <button
            type="button"
            onClick={() => setShowCreate((value) => !value)}
            className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange hover:underline"
          >
            <FolderPlus className="size-3" />
            Create set
          </button>
        ) : null}
      </header>

      {showCreate && !readOnly ? (
        <div className="space-y-2 border-b border-carbon-blue/8 bg-carbon-blue/[0.02] px-3 py-3">
          <label className="block">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Set type
            </span>
            <select
              value={createKind}
              onChange={(event) =>
                setCreateKind(event.target.value as QuotationDocumentSetKind)
              }
              disabled={creating}
              className="mt-0.5 w-full border border-carbon-blue/15 bg-white px-2 py-1.5 text-xs text-carbon-blue"
            >
              {CREATE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {documentSetTypeLabel(kind)}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            disabled={creating}
            onClick={() => void handleCreate()}
            className="w-full border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white disabled:opacity-50"
          >
            {creating ? "Creating…" : "Create document set"}
          </button>
        </div>
      ) : null}

      {error ? <p className="px-3 py-2 text-[10px] text-red-600">{error}</p> : null}

      {loading ? (
        <p className="px-3 py-4 text-[11px] text-carbon-blue/50">Loading document sets…</p>
      ) : quotationSets.length === 0 ? (
        <p className="px-3 py-4 text-[11px] text-carbon-blue/50">
          No quotation document sets for this deal yet.
        </p>
      ) : (
        <ul className="divide-y divide-carbon-blue/8">
          {quotationSets.map((set) => (
            <li key={set.documentSetId} className="px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <Link
                    href={documentSet360Href(set.documentSetId)}
                    className="font-mono text-[10px] font-semibold text-upcycle-orange hover:underline"
                  >
                    {set.documentSetId}
                  </Link>
                  <p className="mt-0.5 text-xs font-semibold text-carbon-blue">{set.title}</p>
                  <p className="mt-0.5 text-[10px] text-carbon-blue/50">
                    {set.typeLabel} · {set.members.length} slot{set.members.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span
                  className={`shrink-0 border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${DOCUMENT_SET_STATUS_STYLES[set.documentSetStatus]}`}
                >
                  {set.documentSetStatus}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
