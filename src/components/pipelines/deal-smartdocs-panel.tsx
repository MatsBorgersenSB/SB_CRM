"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileUp, Sparkles } from "lucide-react";
import { simulateDocIntelligence } from "@/lib/mock-ai-parser";
import {
  buildSmartDocsFilename,
  parseSmartDocsFilename,
  toSmartDocsDocument,
} from "@/lib/smartdocs-filename";
import { syncPipelineRecord } from "@/lib/sync-pipeline";
import type { SmartDocsDocument } from "@/types/pipeline";

function DocIntelligenceBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange">
      {label}
    </span>
  );
}

function SmartDocsColumnList({ document }: { document: SmartDocsDocument }) {
  const rows: { key: keyof SmartDocsDocument; value: string; badge?: boolean }[] = [
    { key: "ClientLookup", value: document.ClientLookup },
    { key: "DocCategory", value: document.DocCategory, badge: true },
    { key: "DocType", value: document.DocType, badge: true },
    { key: "Revision", value: document.Revision },
    { key: "FileLeafRef", value: document.FileLeafRef },
  ];

  return (
    <dl className="mt-2 border-t border-carbon-blue/10">
      {rows.map((row) => (
        <div
          key={row.key}
          className="grid grid-cols-[96px_1fr] border-b border-carbon-blue/10 last:border-b-0"
        >
          <dt className="border-r border-carbon-blue/10 px-2 py-1.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            {row.key}
          </dt>
          <dd className="min-w-0 px-2 py-1.5">
            {row.badge ? (
              <DocIntelligenceBadge label={row.value} />
            ) : (
              <span
                className={`block truncate text-[10px] text-carbon-blue ${
                  row.key === "FileLeafRef" ? "font-mono" : ""
                }`}
                title={row.value}
              >
                {row.value}
              </span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

type DealSmartDocsPanelProps = {
  pipelineId: string;
  smartDocs?: Partial<SmartDocsDocument>;
  readOnly?: boolean;
  onDocSaved?: (patch: SmartDocsDocument) => void;
};

export function DealSmartDocsPanel({
  pipelineId,
  smartDocs,
  readOnly = false,
  onDocSaved,
}: DealSmartDocsPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(smartDocs?.FileLeafRef ?? null);
  const [parsing, setParsing] = useState(false);
  const [document, setDocument] = useState<SmartDocsDocument | null>(
    toSmartDocsDocument(smartDocs ?? {}),
  );

  useEffect(() => {
    setFileName(smartDocs?.FileLeafRef ?? null);
    setDocument(toSmartDocsDocument(smartDocs ?? {}));
    setParsing(false);
    setIsDragOver(false);
  }, [
    pipelineId,
    smartDocs?.ClientLookup,
    smartDocs?.DocCategory,
    smartDocs?.DocType,
    smartDocs?.Revision,
    smartDocs?.FileLeafRef,
  ]);

  const persistDocument = useCallback(
    async (patch: SmartDocsDocument) => {
      await syncPipelineRecord(pipelineId, patch);
      setDocument(patch);
      setFileName(patch.FileLeafRef);
      onDocSaved?.(patch);
    },
    [pipelineId, onDocSaved],
  );

  const processFile = useCallback(
    async (name: string) => {
      setFileName(name);

      const parsed = parseSmartDocsFilename(name);
      if (parsed) {
        await persistDocument(parsed);
        return;
      }

      setParsing(true);
      setDocument(null);

      try {
        const intelligence = await simulateDocIntelligence(name);
        const patch = buildSmartDocsFilename(
          pipelineId,
          intelligence.DocCategory,
          intelligence.DocType,
          "01",
          name,
        );

        await persistDocument(patch);
      } finally {
        setParsing(false);
      }
    },
    [pipelineId, persistDocument],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      const file = files?.[0];
      if (!file) return;
      void processFile(file.name);
    },
    [processFile],
  );

  if (readOnly) {
    const documentReadOnly = toSmartDocsDocument(smartDocs ?? {});
    if (!documentReadOnly) return null;

    return (
      <section className="border border-carbon-blue/10">
        <header className="border-b border-carbon-blue/10 px-3 py-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            SmartDocs Panel
          </p>
        </header>
        <div className="px-3 py-2">
          <SmartDocsColumnList document={documentReadOnly} />
        </div>
      </section>
    );
  }

  const zoneClasses = [
    "relative border border-dashed px-3 py-2.5 transition-colors duration-200",
    parsing ? "animate-pulse border-upcycle-orange/40 bg-upcycle-orange/[0.04]" : "",
    isDragOver
      ? "border-upcycle-orange bg-upcycle-orange/[0.06] ring-1 ring-upcycle-orange/40"
      : "border-carbon-blue/15 bg-white hover:border-carbon-blue/25",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section aria-label="SmartDocs panel" className="border border-carbon-blue/10">
      <header className="flex items-center justify-between border-b border-carbon-blue/10 px-3 py-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          SmartDocs Panel
        </p>
        <span className="font-mono text-[9px] text-carbon-blue/45">Gemini 3.5 Flash</span>
      </header>

      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragEnter={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragOver(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragOver(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragOver(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setIsDragOver(false);
          handleFiles(event.dataTransfer.files);
        }}
        className={zoneClasses}
      >
        <input
          ref={inputRef}
          type="file"
          className="sr-only"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.png,.jpg,.jpeg"
          onChange={(event) => handleFiles(event.target.files)}
        />

        <div className="flex items-start gap-2.5">
          <div
            className={`mt-0.5 border p-1 ${
              parsing || isDragOver
                ? "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange"
                : "border-carbon-blue/10 bg-white text-carbon-blue/50"
            }`}
          >
            {parsing ? (
              <Sparkles className="size-3.5" strokeWidth={1.75} />
            ) : (
              <FileUp className="size-3.5" strokeWidth={1.75} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium text-carbon-blue">
              {parsing
                ? "Analyzing document…"
                : isDragOver
                  ? "Release to parse"
                  : "Drop file or click to upload"}
            </p>
            <p className="mt-0.5 truncate font-mono text-[10px] text-carbon-blue/45">
              {fileName ?? `${pipelineId}_Commercial-Formal Quotation.01.pdf`}
            </p>
          </div>
        </div>

        {document ? <SmartDocsColumnList document={document} /> : null}
      </div>
    </section>
  );
}

export function DealSmartDocsReadOnlyPanel({
  smartDocs,
}: {
  smartDocs?: Partial<SmartDocsDocument>;
}) {
  const document = toSmartDocsDocument(smartDocs ?? {});
  if (!document) return null;

  return (
    <section className="border border-carbon-blue/10">
      <header className="border-b border-carbon-blue/10 px-3 py-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          SmartDocs Panel
        </p>
      </header>
      <div className="px-3 py-2">
        <SmartDocsColumnList document={document} />
      </div>
    </section>
  );
}
