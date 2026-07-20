"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { DocumentLink, DocumentSetLink } from "@/components/relationship/relationship-links";
import { DOCUMENT_SET_STATUS_STYLES } from "@/types/document-set";
import { Check, Copy, Info } from "lucide-react";
import type { Document360Snapshot } from "@/lib/document-360-data";
import { SMARTDOC_IDENTITY_EXPLANATION } from "@/lib/smartdoc-identity";

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">{label}</p>
      <p className={`mt-0.5 text-sm font-medium text-carbon-blue ${mono ? "font-mono text-[12px]" : ""}`}>
        {value}
      </p>
    </div>
  );
}

export function Document360IdentityCard({
  snapshot,
  bare = false,
}: {
  snapshot: Document360Snapshot;
  bare?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const { header, identityBreakdown } = snapshot;

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(header.documentId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [header.documentId]);

  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-sm font-bold text-carbon-blue">{header.documentId}</p>
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="inline-flex items-center gap-1 border border-carbon-blue/15 px-2 py-1 text-[10px] font-semibold text-carbon-blue/70 hover:border-upcycle-orange/30 hover:text-upcycle-orange"
        >
          {copied ? <Check className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
          {copied ? "Copied" : "Copy ID"}
        </button>
      </div>

      {identityBreakdown ? (
        <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="PL Number" value={identityBreakdown.plNumber} mono />
          <Field label="Category" value={`${identityBreakdown.categoryCode} · ${identityBreakdown.categoryLabel}`} />
          <Field label="Type code" value={identityBreakdown.typeCode} mono />
          <Field label="Sequence" value={identityBreakdown.sequence} mono />
          <Field label="Full ID" value={identityBreakdown.documentId} mono />
        </dl>
      ) : (
        <p className="mt-3 text-[11px] text-carbon-blue/50">
          Legacy document reference — new uploads receive structured SmartDoc IDs.
        </p>
      )}

      {showHelp ? (
        <p className="mt-4 border-t border-carbon-blue/8 pt-3 text-[11px] leading-relaxed text-carbon-blue/55">
          {SMARTDOC_IDENTITY_EXPLANATION}
        </p>
      ) : null}
    </>
  );

  if (bare) {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Document identity
          </p>
          <button
            type="button"
            onClick={() => setShowHelp((value) => !value)}
            className="inline-flex items-center gap-1 text-[9px] font-semibold text-carbon-blue/55 hover:text-upcycle-orange"
          >
            <Info className="size-3" />
            Explain
          </button>
        </div>
        {body}
      </div>
    );
  }

  return (
    <section className="dashboard-card overflow-hidden">
      <header className="flex items-start justify-between gap-2 border-b border-carbon-blue/8 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-carbon-blue">Document identity</h2>
          <p className="mt-0.5 text-[11px] text-carbon-blue/45">SmartDoc ID breakdown</p>
        </div>
        <button
          type="button"
          onClick={() => setShowHelp((value) => !value)}
          className="inline-flex items-center gap-1 border border-carbon-blue/10 px-2 py-1 text-[9px] font-semibold text-carbon-blue/55 hover:border-upcycle-orange/25 hover:text-upcycle-orange"
        >
          <Info className="size-3" />
          Explain
        </button>
      </header>
      <div className="px-5 py-4">{body}</div>
    </section>
  );
}

export function Document360BusinessContextCard({
  snapshot,
  bare = false,
}: {
  snapshot: Document360Snapshot;
  bare?: boolean;
}) {
  const { businessContext } = snapshot;

  const grid = (
    <dl className="grid gap-px bg-carbon-blue/8 p-px sm:grid-cols-2">
      {[
        ["PL Number", businessContext.plNumber],
        ["Deal", businessContext.dealName],
        ["Client", businessContext.clientName],
        ["Commercial Stage", businessContext.commercialStage],
      ].map(([label, value]) => (
        <div key={label} className="bg-[var(--dashboard-card)] px-4 py-3">
          <dt className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            {label}
          </dt>
          <dd className="mt-0.5 text-sm font-medium text-carbon-blue">{value}</dd>
        </div>
      ))}
    </dl>
  );

  if (bare) {
    return (
      <div>
        <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Full business context
        </p>
        {grid}
      </div>
    );
  }

  return (
    <section className="dashboard-card overflow-hidden">
      <header className="border-b border-carbon-blue/8 px-5 py-4">
        <h2 className="text-sm font-semibold text-carbon-blue">Business context</h2>
        <p className="mt-0.5 text-[11px] text-carbon-blue/45">Inherited from the deal</p>
      </header>
      {grid}
    </section>
  );
}

export function Document360IntelligenceCard({
  snapshot,
  bare = false,
}: {
  snapshot: Document360Snapshot;
  bare?: boolean;
}) {
  const { smartDocsMeta } = snapshot;
  const created = new Date(smartDocsMeta.createdAt);

  const rows = [
    ["Suggested name status", smartDocsMeta.suggestedNameStatusLabel],
    ["SmartDocs suggestion", smartDocsMeta.suggestedName],
    [
      "Created date",
      Number.isNaN(created.getTime())
        ? smartDocsMeta.createdAt
        : created.toLocaleString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
    ],
    ["Uploaded by", smartDocsMeta.uploadedBy],
  ] as const;

  const list = (
    <dl className="divide-y divide-carbon-blue/6">
      {rows.map(([label, value]) => (
        <div key={label} className="flex justify-between gap-4 py-3">
          <dt className="text-carbon-blue/45">{label}</dt>
          <dd className="max-w-[58%] text-right text-sm font-medium text-carbon-blue">{value}</dd>
        </div>
      ))}
    </dl>
  );

  if (bare) {
    return (
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Upload metadata
        </p>
        {list}
      </div>
    );
  }

  return (
    <section className="dashboard-card overflow-hidden">
      <header className="border-b border-carbon-blue/8 px-5 py-4">
        <h2 className="text-sm font-semibold text-carbon-blue">SmartDocs intelligence</h2>
      </header>
      <div className="px-5 py-2">{list}</div>
    </section>
  );
}

export function Document360RelatedCard({ snapshot }: { snapshot: Document360Snapshot }) {
  const { relatedGroups } = snapshot;

  if (relatedGroups.length === 0) {
    return (
      <section className="dashboard-card px-5 py-6">
        <h2 className="text-sm font-semibold text-carbon-blue">Related documents</h2>
        <p className="mt-2 text-[11px] text-carbon-blue/50">No related documents found for this deal.</p>
      </section>
    );
  }

  return (
    <section className="dashboard-card overflow-hidden">
      <header className="border-b border-carbon-blue/8 px-5 py-4">
        <h2 className="text-sm font-semibold text-carbon-blue">Related documents</h2>
      </header>
      <div className="divide-y divide-carbon-blue/6">
        {relatedGroups.map((group) => (
          <div key={group.id} className="px-5 py-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              {group.label}
            </p>
            <ul className="mt-2 space-y-2">
              {group.documents.map((doc) => (
                <li key={doc.id}>
                  <DocumentLink documentId={doc.id} className="block rounded-sm border border-transparent px-2 py-1.5 hover:border-upcycle-orange/20 hover:bg-upcycle-orange/[0.03]">
                    <p className="text-sm font-medium text-carbon-blue hover:text-upcycle-orange">
                      {doc.name}
                    </p>
                    {doc.meta ? (
                      <p className="mt-0.5 text-[10px] text-carbon-blue/45">{doc.meta}</p>
                    ) : null}
                  </DocumentLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Document360SetCard({ snapshot }: { snapshot: Document360Snapshot }) {
  const { documentSet } = snapshot;

  if (!documentSet) {
    return (
      <section className="dashboard-card px-5 py-6">
        <h2 className="text-sm font-semibold text-carbon-blue">Document set</h2>
        <p className="mt-2 text-[11px] text-carbon-blue/50">
          This document is not part of a commercial package document set.
        </p>
      </section>
    );
  }

  return (
    <section className="dashboard-card overflow-hidden">
      <header className="border-b border-carbon-blue/8 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-carbon-blue">Document set</h2>
            <p className="mt-0.5 text-[11px] text-carbon-blue/45">{documentSet.title}</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <DocumentSetLink
              setId={documentSet.documentSetId}
              className="font-mono text-[11px] font-semibold text-upcycle-orange hover:underline"
            >
              {documentSet.documentSetId}
            </DocumentSetLink>
            <span
              className={`border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${DOCUMENT_SET_STATUS_STYLES[documentSet.status as keyof typeof DOCUMENT_SET_STATUS_STYLES] ?? "border-carbon-blue/15 text-carbon-blue/55"}`}
            >
              {documentSet.status}
            </span>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-carbon-blue/45">
          {documentSet.kindLabel} · {documentSet.packageId}
        </p>
      </header>
      <ul className="divide-y divide-carbon-blue/6">
        {documentSet.members.map((member) => (
          <li
            key={member.fileName}
            className={`flex items-center justify-between gap-3 px-5 py-3 ${
              member.isCurrent ? "bg-upcycle-orange/[0.04]" : ""
            }`}
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-carbon-blue">{member.name}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
                {member.role}
              </p>
              {member.isCurrent ? (
                <p className="mt-0.5 text-[10px] font-semibold text-upcycle-orange">Current</p>
              ) : member.href ? (
                <Link href={member.href} className="mt-0.5 text-[10px] font-semibold text-upcycle-orange hover:underline">
                  Open
                </Link>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Document360SharePointVersionsCard({
  snapshot,
  bare = false,
}: {
  snapshot: Document360Snapshot;
  bare?: boolean;
}) {
  const { sharePointVersions } = snapshot;

  const table = (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-carbon-blue/8 bg-carbon-blue/[0.02]">
            {["Version", "Label", "Modified", "Modified by"].map((header) => (
              <th
                key={header}
                className="px-5 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sharePointVersions.map((entry) => (
            <tr
              key={`${entry.version}-${entry.modifiedAt}`}
              className={`border-b border-carbon-blue/6 last:border-b-0 ${
                entry.isCurrent ? "bg-upcycle-orange/[0.04]" : ""
              }`}
            >
              <td className="px-5 py-3 font-mono text-xs font-semibold text-carbon-blue">
                v{entry.version}
              </td>
              <td className="px-5 py-3 text-carbon-blue/75">{entry.label}</td>
              <td className="px-5 py-3 text-[11px] text-carbon-blue/55">
                {new Date(entry.modifiedAt).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </td>
              <td className="px-5 py-3 text-[11px] text-carbon-blue/55">{entry.modifiedBy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  if (bare) return table;

  return (
    <section id="sharepoint-versions" className="dashboard-card overflow-hidden">
      <header className="border-b border-carbon-blue/8 px-5 py-4">
        <h2 className="text-sm font-semibold text-carbon-blue">SharePoint version history</h2>
        <p className="mt-0.5 text-[11px] text-carbon-blue/45">
          Authoritative versioning — managed in SharePoint
        </p>
      </header>
      {table}
    </section>
  );
}
