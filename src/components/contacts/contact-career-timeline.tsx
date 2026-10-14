"use client";

import Link from "next/link";
import type { CareerHistoryEntry, CompanyTransferRecord } from "@/types/contact-lifecycle";

function formatDate(value: string | null): string {
  if (!value) return "Present";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function ContactCareerTimeline({
  entries,
  transfers = [],
}: {
  entries: CareerHistoryEntry[];
  transfers?: CompanyTransferRecord[];
}) {
  if (entries.length === 0 && transfers.length === 0) {
    return (
      <p className="px-3 py-4 text-xs text-carbon-blue/50">
        No career history recorded yet. Role and company changes will appear here.
      </p>
    );
  }

  return (
    <div className="divide-y divide-carbon-blue/8">
      {entries.map((entry) => (
        <article key={entry.id} className="px-3 py-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-carbon-blue">{entry.companyName}</p>
              <p className="mt-0.5 text-[12px] text-carbon-blue/60">
                {entry.jobTitle || entry.role}
                <span className="mx-1 text-carbon-blue/25">·</span>
                <span className="font-mono text-[11px]">{entry.role}</span>
              </p>
            </div>
            <p className="shrink-0 text-[11px] tabular-nums text-carbon-blue/65">
              {formatDate(entry.startDate)} — {formatDate(entry.endDate)}
            </p>
          </div>
          <Link
            href={`/companies/${entry.companyId}`}
            className="mt-1 inline-block text-[11px] font-semibold text-upcycle-orange hover:underline"
          >
            View company →
          </Link>
        </article>
      ))}

      {transfers.length > 0 ? (
        <section className="bg-carbon-blue/[0.02] px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/60">
            Company transfers
          </p>
          <ul className="mt-2 space-y-2">
            {transfers.map((transfer) => (
              <li key={transfer.id} className="text-[12px] text-carbon-blue/70">
                <span className="font-medium text-carbon-blue">
                  {transfer.previousCompanyName}
                </span>
                <span className="mx-1 text-carbon-blue/30">→</span>
                <span className="font-medium text-carbon-blue">{transfer.newCompanyName}</span>
                <span className="ml-2 text-[11px] text-carbon-blue/65">
                  {formatDate(transfer.transferDate)}
                </span>
                <p className="mt-0.5 text-[11px] text-carbon-blue/65">
                  Preserved: {transfer.preservedReferences.activities} activities,{" "}
                  {transfer.preservedReferences.opportunities} opportunities,{" "}
                  {transfer.preservedReferences.documents} documents
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
