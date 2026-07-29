"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  BUYING_CENTER_ROLE_CODES,
  BUYING_CENTER_ROLE_LABELS,
  type BuyingCenterRoleCode,
  type CompanyBuyingCenter,
} from "@/lib/assistant/buying-center-types";
import { mailtoHref, telHref } from "@/lib/compose-actions";
import { contact360Href } from "@/types/relationship-navigation";

type BuyingCenterGraphProps = {
  companyId: string;
  companyName?: string;
  className?: string;
};

export function BuyingCenterGraph({
  companyId,
  companyName,
  className = "",
}: BuyingCenterGraphProps) {
  const [data, setData] = useState<CompanyBuyingCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/companies/${encodeURIComponent(companyId)}/buying-center`,
      );
      const body = (await response.json()) as CompanyBuyingCenter & {
        error?: string;
      };
      if (!response.ok) {
        setError(body.error ?? "Could not load buying center");
        setData(null);
        return;
      }
      setData(body);
    } catch {
      setError("Buying center unavailable");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateContact = async (
    contactId: string,
    patch: { buyingRole?: BuyingCenterRoleCode; relationshipScore?: number },
  ) => {
    setSavingId(contactId);
    setError(null);
    try {
      const response = await fetch(
        `/api/companies/${encodeURIComponent(companyId)}/buying-center`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contactId, ...patch }),
        },
      );
      const body = (await response.json()) as {
        buyingCenter?: CompanyBuyingCenter;
        error?: string;
      };
      if (!response.ok) {
        setError(body.error ?? "Update failed");
        return;
      }
      if (body.buyingCenter) setData(body.buyingCenter);
    } catch {
      setError("Could not update contact role");
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return (
      <p className={`text-[11px] text-carbon-blue/45 ${className}`}>
        Loading buying center…
      </p>
    );
  }

  if (!data) {
    return (
      <p className={`text-[11px] text-carbon-blue/45 ${className}`}>
        {error ?? "No buying center data yet."}
      </p>
    );
  }

  const coverageComplete = data.coverage.status === "complete";

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Buying Center
          </p>
          <p className="text-[13px] font-semibold text-carbon-blue">
            {companyName ?? data.companyName}
          </p>
          <p className="mt-0.5 text-[11px] text-carbon-blue/50">
            {data.totalContacts} contact{data.totalContacts === 1 ? "" : "s"} ·
            Coverage {data.coverage.score}%
          </p>
        </div>

        <div
          className={`border px-2.5 py-1.5 text-[11px] font-semibold ${
            coverageComplete
              ? "border-emerald-600/25 bg-emerald-50 text-emerald-800"
              : "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange"
          }`}
        >
          {coverageComplete
            ? "✅ Complete Committee"
            : `⚠️ ${data.coverage.statusLabel}`}
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden bg-carbon-blue/8">
        <div
          className={`h-full transition-all ${
            coverageComplete ? "bg-emerald-600" : "bg-upcycle-orange"
          }`}
          style={{ width: `${data.coverage.score}%` }}
        />
      </div>

      {error ? <p className="text-[11px] text-thermal-red">{error}</p> : null}

      {data.totalContacts === 0 ? (
        <p className="text-[11px] text-carbon-blue/45">
          No contacts on this account yet. Add people, then assign Buying Center
          roles.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.columns.map((column) => (
            <div
              key={column.role}
              className={`border ${
                column.isKeyRole && column.contacts.length === 0
                  ? "border-upcycle-orange/25 bg-upcycle-orange/[0.03]"
                  : "border-carbon-blue/10 bg-[var(--dashboard-surface)]"
              }`}
            >
              <div className="flex items-center justify-between border-b border-carbon-blue/8 px-3 py-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/55">
                    {column.label}
                  </p>
                  {column.isKeyRole ? (
                    <p className="text-[9px] text-carbon-blue/35">Key role</p>
                  ) : null}
                </div>
                <span className="text-[10px] font-semibold text-carbon-blue/40">
                  {column.contacts.length}
                </span>
              </div>

              <ul className="divide-y divide-carbon-blue/8">
                {column.contacts.length === 0 ? (
                  <li className="px-3 py-3 text-[11px] text-carbon-blue/40">
                    {column.isKeyRole ? "Missing — assign a contact" : "None"}
                  </li>
                ) : (
                  column.contacts.map((contact) => (
                    <li key={contact.contactId} className="px-3 py-2.5">
                      <div className="flex items-start gap-2.5">
                        <div
                          className="flex h-8 w-8 shrink-0 items-center justify-center border border-carbon-blue/15 bg-carbon-blue/[0.04] text-[10px] font-semibold text-carbon-blue/70"
                          aria-hidden
                        >
                          {contact.initials}
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={contact360Href(contact.contactId, companyId)}
                            className="block truncate text-[12px] font-semibold text-carbon-blue hover:text-upcycle-orange"
                          >
                            {contact.displayName}
                          </Link>
                          {contact.jobTitle ? (
                            <p className="truncate text-[10px] text-carbon-blue/45">
                              {contact.jobTitle}
                            </p>
                          ) : null}

                          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px]">
                            {contact.email ? (
                              <a
                                href={mailtoHref(contact.email)}
                                className="truncate text-carbon-blue/60 hover:text-upcycle-orange"
                              >
                                {contact.email}
                              </a>
                            ) : null}
                            {contact.phone ? (
                              <a
                                href={telHref(contact.phone)}
                                className="text-carbon-blue/60 hover:text-upcycle-orange"
                              >
                                {contact.phone}
                              </a>
                            ) : null}
                          </div>

                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <label className="sr-only" htmlFor={`role-${contact.contactId}`}>
                              Buying role for {contact.displayName}
                            </label>
                            <select
                              id={`role-${contact.contactId}`}
                              value={contact.buyingRole}
                              disabled={savingId === contact.contactId}
                              onChange={(event) =>
                                void updateContact(contact.contactId, {
                                  buyingRole: event.target
                                    .value as BuyingCenterRoleCode,
                                })
                              }
                              className="max-w-full border border-carbon-blue/15 bg-white px-1.5 py-1 text-[10px] text-carbon-blue outline-none focus:border-upcycle-orange"
                            >
                              {BUYING_CENTER_ROLE_CODES.map((role) => (
                                <option key={role} value={role}>
                                  {BUYING_CENTER_ROLE_LABELS[role]}
                                </option>
                              ))}
                            </select>

                            {contact.relationshipScore != null ? (
                              <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                                Score {contact.relationshipScore}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
