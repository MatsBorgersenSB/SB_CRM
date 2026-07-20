"use client";

import Link from "next/link";
import type { UserOwnershipAnalysis } from "@/types/user-access";

const DIMENSIONS: Array<{
  key: keyof Pick<
    UserOwnershipAnalysis,
    | "ownedCompanies"
    | "ownedContacts"
    | "ownedOpportunities"
    | "ownedActivities"
    | "ownedDocuments"
    | "openCommitments"
  >;
  label: string;
}> = [
  { key: "ownedCompanies", label: "Companies" },
  { key: "ownedContacts", label: "Contacts" },
  { key: "ownedOpportunities", label: "Opportunities" },
  { key: "ownedActivities", label: "Activities" },
  { key: "ownedDocuments", label: "Documents" },
  { key: "openCommitments", label: "Open commitments" },
];

export function UserOwnershipPanel({
  analysis,
  loading,
}: {
  analysis: UserOwnershipAnalysis | null;
  loading?: boolean;
}) {
  if (loading) {
    return <p className="text-[11px] text-carbon-blue/50">Analyzing ownership…</p>;
  }

  if (!analysis) return null;

  return (
    <div className="border border-carbon-blue/10 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-carbon-blue/40">
            Ownership analysis
          </p>
          <p className="text-sm font-semibold text-carbon-blue">{analysis.displayName}</p>
        </div>
        {!analysis.canDelete ? (
          <span className="border border-thermal-red/25 bg-thermal-red/[0.04] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-thermal-red">
            Transfer required before delete
          </span>
        ) : (
          <span className="border border-upcycle-orange/25 bg-upcycle-orange/[0.04] px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-upcycle-orange">
            Safe to delete
          </span>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {DIMENSIONS.map(({ key, label }) => (
          <div key={key} className="border border-carbon-blue/8 bg-carbon-blue/[0.02] px-3 py-2">
            <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/40">
              {label}
            </p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-carbon-blue">
              {analysis[key].length}
            </p>
          </div>
        ))}
      </div>

      {analysis.deleteBlockedReason ? (
        <p className="mt-3 text-[11px] text-carbon-blue/60">{analysis.deleteBlockedReason}</p>
      ) : null}

      {analysis.hasOwnership ? (
        <div className="mt-4 space-y-3">
          {DIMENSIONS.filter(({ key }) => analysis[key].length > 0).map(({ key, label }) => (
            <div key={key}>
              <p className="text-[9px] font-bold uppercase tracking-wider text-carbon-blue/35">
                {label}
              </p>
              <ul className="mt-1 space-y-1">
                {analysis[key].slice(0, 4).map((record) => (
                  <li key={record.id} className="text-[11px] text-carbon-blue/70">
                    {record.href ? (
                      <Link href={record.href} className="hover:text-upcycle-orange hover:underline">
                        {record.label}
                      </Link>
                    ) : (
                      record.label
                    )}
                  </li>
                ))}
                {analysis[key].length > 4 ? (
                  <li className="text-[10px] text-carbon-blue/40">
                    +{analysis[key].length - 4} more
                  </li>
                ) : null}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-carbon-blue/50">
          No business ownership assigned — this user can be archived or deleted safely.
        </p>
      )}
    </div>
  );
}
