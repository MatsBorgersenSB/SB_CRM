import Link from "next/link";
import { FileText } from "lucide-react";
import type { PipelineRow } from "@/types/pipeline";
import { smartDocHref } from "@/types/smartdoc";
import {
  DOCUMENT_HEALTH_STYLES,
  DocumentHealthBadge,
} from "@/components/smartdocs/document-intelligence-display";
import type { DocumentIntelligence } from "@/lib/document-intelligence-engine";

function groupDocuments(documents: PipelineRow[]) {
  const groups = new Map<string, PipelineRow[]>();

  for (const doc of documents) {
    const category = doc.DocCategory || "General";
    const existing = groups.get(category) ?? [];
    existing.push(doc);
    groups.set(category, existing);
  }

  return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
}

export function Company360DocumentsTab({
  documents,
  intelligences,
}: {
  documents: PipelineRow[];
  intelligences?: DocumentIntelligence[];
}) {
  const intelById = new Map(intelligences?.map((i) => [i.document.id, i]) ?? []);

  if (documents.length === 0) {
    return (
      <section className="dashboard-card flex min-h-[280px] flex-col items-center justify-center px-6 py-12 text-center">
        <FileText className="size-8 text-carbon-blue/20" strokeWidth={1.5} />
        <p className="mt-3 text-sm font-medium text-carbon-blue/70">No documents yet</p>
        <p className="mt-1 max-w-sm text-xs text-carbon-blue/45">
          SmartDocs appear in context — grouped by purpose, not folders.
        </p>
      </section>
    );
  }

  const groups = groupDocuments(documents);

  return (
    <div className="space-y-4">
      {groups.map(([category, docs]) => (
        <section key={category} className="dashboard-card">
          <header className="border-b border-carbon-blue/8 px-5 py-3">
            <h2 className="text-sm font-semibold text-carbon-blue">{category}</h2>
            <p className="mt-0.5 text-[11px] text-carbon-blue/45">
              {docs.length} document{docs.length === 1 ? "" : "s"} in context
            </p>
          </header>

          <ul className="divide-y divide-carbon-blue/6">
            {docs.map((doc) => {
              const intel = intelById.get(doc.id);
              return (
                <li key={doc.id}>
                  <Link
                    href={smartDocHref(doc.id)}
                    className="flex items-start gap-4 px-5 py-4 transition-colors hover:bg-carbon-blue/[0.02]"
                  >
                    <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center border border-carbon-blue/10 bg-carbon-blue/[0.02]">
                      <FileText className="size-4 text-carbon-blue/40" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium text-carbon-blue hover:text-upcycle-orange">
                          {doc.FileLeafRef}
                        </p>
                        {intel ? (
                          <>
                            <span
                              className={`border px-1.5 py-0.5 text-[9px] font-bold tabular-nums ${DOCUMENT_HEALTH_STYLES[intel.healthStatus]}`}
                            >
                              {intel.healthScore}
                            </span>
                            <DocumentHealthBadge status={intel.healthStatus} />
                          </>
                        ) : null}
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        {doc.DocType ? (
                          <span className="border border-upcycle-orange/25 bg-upcycle-orange/8 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-upcycle-orange">
                            {doc.DocType}
                          </span>
                        ) : null}
                        {doc.Revision ? (
                          <span className="font-mono text-[10px] text-carbon-blue/45">
                            Rev {doc.Revision}
                          </span>
                        ) : null}
                      </div>
                      {intel ? (
                        <p className="mt-1.5 line-clamp-1 text-[10px] text-carbon-blue/45">
                          → {intel.nextBestAction.action}
                        </p>
                      ) : null}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
