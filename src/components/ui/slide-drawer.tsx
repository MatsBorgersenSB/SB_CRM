"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileUp, Sparkles, X } from "lucide-react";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { simulateDocIntelligence } from "@/lib/mock-ai-parser";
import {
  buildSmartDocsFilename,
  parseSmartDocsFilename,
  toSmartDocsDocument,
} from "@/lib/smartdocs-filename";
import { syncPipelineRecord } from "@/lib/sync-pipeline";
import type { Company } from "@/lib/companies-data";
import { DealTeamSection } from "@/components/pipelines/deal-team-section";
import type { PipelineTeamMember, SmartDocsDocument } from "@/types/pipeline";

type DrawerTab = "overview" | "smartdocs";

type SlideDrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  pipelineId?: string;
  smartDocs?: Partial<SmartDocsDocument>;
  smartDocsReadOnly?: boolean;
  onDocSaved?: (patch: SmartDocsDocument) => void;
  onBack?: () => void;
  backLabel?: string;
  dealTeam?: {
    team: PipelineTeamMember[];
    companies: Company[];
    onAssign: (contactId: string, projectRole: string) => Promise<void>;
    readOnly?: boolean;
  };
  tabs?: {
    overview: React.ReactNode;
    smartdocs: React.ReactNode;
  };
  children?: React.ReactNode;
};

function DocIntelligenceBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange">
      {label}
    </span>
  );
}

function DrawerTabBar({
  activeTab,
  onChange,
}: {
  activeTab: DrawerTab;
  onChange: (tab: DrawerTab) => void;
}) {
  const items: { id: DrawerTab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "smartdocs", label: "SmartDocs" },
  ];

  return (
    <div className="mb-3 flex gap-1">
      {items.map((item) => {
        const active = activeTab === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onChange(item.id)}
            className={`flex-1 border px-2 py-1.5 text-xs font-medium transition-colors ${
              active
                ? "border-upcycle-orange/30 bg-upcycle-orange/10 text-carbon-blue ring-1 ring-upcycle-orange/40"
                : "border-carbon-blue/10 bg-white text-carbon-blue/50 hover:border-carbon-blue/20 hover:text-carbon-blue"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function SmartDocsColumnList({ document }: { document: SmartDocsDocument }) {
  const rows: { key: keyof SmartDocsDocument; value: string; badge?: boolean }[] =
    [
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

function DocumentUploadZone({
  pipelineId,
  smartDocs,
  onDocSaved,
}: {
  pipelineId?: string;
  smartDocs?: Partial<SmartDocsDocument>;
  onDocSaved?: (patch: SmartDocsDocument) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(
    smartDocs?.FileLeafRef ?? null,
  );
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
      if (!pipelineId) return;

      await syncPipelineRecord(pipelineId, patch);
      setDocument(patch);
      setFileName(patch.FileLeafRef);
      onDocSaved?.(patch);
    },
    [pipelineId, onDocSaved],
  );

  const processFile = useCallback(
    async (name: string) => {
      if (!pipelineId) return;

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

  const onDragEnter = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);
      handleFiles(event.dataTransfer.files);
    },
    [handleFiles],
  );

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
    <section
      aria-label="Document intelligence upload"
      className="mb-3 border border-carbon-blue/10"
    >
      <div className="flex items-center justify-between border-b border-carbon-blue/10 px-3 py-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          SmartDocs Parse
        </p>
        <span className="font-mono text-[9px] text-carbon-blue/45">Gemini 3.5 Flash</span>
      </div>

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
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
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
              {fileName ?? "PL-1042_Financial-Invoice.01 Q3 Report.pdf"}
            </p>
          </div>
        </div>

        {document ? <SmartDocsColumnList document={document} /> : null}
      </div>
    </section>
  );
}

export function SlideDrawer({
  open,
  onClose,
  title,
  subtitle,
  pipelineId,
  smartDocs,
  smartDocsReadOnly = false,
  onDocSaved,
  onBack,
  backLabel,
  dealTeam,
  tabs,
  children,
}: SlideDrawerProps) {
  const [mounted, setMounted] = useState(open);
  const [activeTab, setActiveTab] = useState<DrawerTab>("overview");

  useEscapeKey(open, onClose);

  useEffect(() => {
    if (open) setMounted(true);
  }, [open]);

  useEffect(() => {
    if (open) setActiveTab("overview");
  }, [open, subtitle]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-50" role="presentation">
      <button
        type="button"
        aria-label="Close panel"
        className={`absolute inset-0 bg-carbon-blue/20 backdrop-blur-[1px] transition-opacity duration-300 ease-out motion-reduce:transition-none ${
          open ? "opacity-100" : "opacity-0"
        }`}
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onTransitionEnd={() => {
          if (!open) setMounted(false);
        }}
        className={`drawer-panel absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-carbon-blue/15 bg-white shadow-2xl will-change-transform ${
          open ? "drawer-panel-open" : ""
        }`}
      >
        <header className="flex items-start justify-between border-b border-carbon-blue/10 px-4 py-3">
          <div className="min-w-0">
            {subtitle ? (
              <p className="truncate font-mono text-[10px] text-carbon-blue/45">
                {subtitle}
              </p>
            ) : null}
            <h2 className="truncate text-sm font-semibold text-carbon-blue">
              {title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-carbon-blue/10 p-1 text-carbon-blue/50 transition-colors hover:border-carbon-blue/20 hover:text-carbon-blue"
          >
            <X className="size-3.5" strokeWidth={1.75} />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {onBack ? (
            <button
              type="button"
              onClick={onBack}
              className="mb-3 border border-carbon-blue/10 px-2 py-1 text-[10px] font-medium text-carbon-blue/55 transition-colors hover:border-carbon-blue/20 hover:text-carbon-blue"
            >
              ← {backLabel ?? "Back"}
            </button>
          ) : null}
          {tabs ? (
            <>
              <DrawerTabBar activeTab={activeTab} onChange={setActiveTab} />
              {activeTab === "overview" ? (
                <>
                  {tabs.overview}
                  {dealTeam ? (
                    <DealTeamSection
                      team={dealTeam.team}
                      companies={dealTeam.companies}
                      onAssign={dealTeam.onAssign}
                      readOnly={dealTeam.readOnly}
                    />
                  ) : null}
                </>
              ) : (
                tabs.smartdocs
              )}
            </>
          ) : (
            <>
              {children}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
