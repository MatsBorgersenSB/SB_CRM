"use client";

import { useMemo, useRef, useState } from "react";
import { normalizeCompanyDomain } from "@/lib/company-domain";
import { findCountryEntry } from "@/lib/geo/country-continent";
import { createCompanyRecord, createContactRecord } from "@/lib/sync-company";
import { normalizeCompanyName } from "@/lib/smartassist/explore/company-explore";
import { emptyContactForm } from "@/components/contacts/contact-form-fields";
import {
  contactDetailLines,
  contactImportBackground,
  contactImportNote,
  contactsFromGrid,
  matchCompanyId,
  readSpreadsheetGrid,
  type SpreadsheetContact,
} from "@/lib/contact-spreadsheet";
import type { Company, Contact } from "@/lib/companies-data";
import { canCreateCompany } from "@/lib/permissions";
import type { UserRole } from "@/types/auth";

type ContactSpreadsheetImportPanelProps = {
  role: UserRole;
  companies: Company[];
  onAdded: (company: Company, contact: Contact) => void;
};

type Draft = SpreadsheetContact & {
  key: string;
  companyId: string | null;
  ambiguous: boolean;
  include: boolean;
};

function existingEmails(companies: Company[]): Set<string> {
  const emails = new Set<string>();
  for (const company of companies) {
    for (const contact of company.contacts ?? []) {
      const email = contact.Email?.trim().toLowerCase();
      if (email) emails.add(email);
    }
  }
  return emails;
}

function toDrafts(rows: SpreadsheetContact[], companies: Company[]): Draft[] {
  const known = existingEmails(companies);
  const sources = companies.map((company) => ({
    CompanyID: company.CompanyID,
    Title: company.Title,
  }));
  return rows.map((row, index) => {
    const match = matchCompanyId(row.companyName, sources);
    const draft: Draft = {
      ...row,
      key: `row-${index}`,
      companyId: match.id,
      ambiguous: match.ambiguous,
      include: false,
    };
    draft.include = contactImportNote(draft, known, draft.ambiguous) === null;
    return draft;
  });
}

export function ContactSpreadsheetImportPanel({
  role,
  companies,
  onAdded,
}: ContactSpreadsheetImportPanelProps) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [fileName, setFileName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const createdCompanies = useRef(new Map<string, Company>());
  const known = useMemo(() => existingEmails(companies), [companies]);
  const companyOptions = useMemo(
    () =>
      [...companies].sort((a, b) => a.Title.localeCompare(b.Title, "nb")),
    [companies],
  );

  if (!canCreateCompany(role)) return null;

  const ready = drafts.filter(
    (row) => row.include && contactImportNote(row, known, row.ambiguous && !row.companyId) === null,
  );

  const update = (key: string, patch: Partial<Draft>) => {
    setDrafts((current) =>
      current.map((row) => {
        if (row.key !== key) return row;
        const next = { ...row, ...patch };
        const wasBlocked =
          contactImportNote(row, known, row.ambiguous && !row.companyId) !== null;
        const blocked =
          contactImportNote(next, known, next.ambiguous && !next.companyId) !== null;
        if (blocked) next.include = false;
        else if (wasBlocked) next.include = true;
        return next;
      }),
    );
  };

  const ensureCompany = async (row: Draft): Promise<Company> => {
    if (row.companyId) {
      const linked =
        companies.find((company) => company.CompanyID === row.companyId) ??
        [...createdCompanies.current.values()].find(
          (company) => company.CompanyID === row.companyId,
        );
      if (linked) return linked;
    }

    const key = normalizeCompanyName(row.companyName);
    const cached = key ? createdCompanies.current.get(key) : undefined;
    if (cached) return cached;

    const country = findCountryEntry(row.country);
    const domain = normalizeCompanyDomain(row.website);
    const base = {
      Title: row.companyName.trim(),
      Industry: "",
      Status: "Active" as const,
      City: row.city.trim(),
      Domain: domain,
      Phone: row.companyPhone.trim() || row.phone.trim(),
      AddressLine1: row.streetAddress.trim(),
      PostalCode: row.postalCode.trim(),
      Country: row.country.trim()
        ? { Id: 0, Title: country?.name || row.country.trim() }
        : null,
      countryCode: country?.code ?? null,
      continent: country?.continent ?? null,
      CompanyTypes: ["Unclassified" as const],
      Notes: "",
    };

    try {
      const created = await createCompanyRecord(base, role);
      if (key) createdCompanies.current.set(key, created);
      return created;
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "";
      if (!domain || !/domain/i.test(message)) throw createError;
      const created = await createCompanyRecord({ ...base, Domain: "" }, role);
      if (key) createdCompanies.current.set(key, created);
      return created;
    }
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setError(null);
    setNotice(null);
    setProgress("");
    setFileName(file.name);
    createdCompanies.current.clear();
    try {
      const buffer = await file.arrayBuffer();
      const grid = await readSpreadsheetGrid(file.name, buffer);
      const parsed = contactsFromGrid(grid);
      setDrafts(toDrafts(parsed.contacts, companies));
      setNotice(parsed.error);
      if (parsed.contacts.length === 0 && parsed.error) setError(parsed.error);
    } catch (readError) {
      setDrafts([]);
      setError(readError instanceof Error ? readError.message : "Could not read that file.");
    }
  };

  const handleAdd = async () => {
    if (ready.length === 0) return;
    setBusy(true);
    setError(null);
    let added = 0;
    const failures: string[] = [];

    for (let index = 0; index < ready.length; index++) {
      const row = ready[index]!;
      const name = `${row.firstName} ${row.lastName}`.trim();
      setProgress(`Adding ${index + 1} of ${ready.length} — ${name}`);
      try {
        const company = await ensureCompany(row);
        const country = findCountryEntry(row.country);
        const contact = await createContactRecord(company.CompanyID, {
          ...emptyContactForm(),
          FirstName: row.firstName.trim(),
          LastName: row.lastName.trim(),
          JobTitle: row.jobTitle.trim(),
          Role: row.role.trim(),
          Email: row.email.trim(),
          Phone: row.phone.trim(),
          Mobile: row.mobile.trim(),
          LinkedInURL: row.linkedIn.trim(),
          streetAddress: row.streetAddress.trim() || undefined,
          postalCode: row.postalCode.trim() || undefined,
          city: row.city.trim(),
          country: country?.name || row.country.trim(),
          countryCode: country?.code,
          continent: country?.continent,
          backgroundNotes: contactImportBackground(row, fileName),
          Company: { CompanyID: company.CompanyID },
        });
        onAdded(company, contact);
        added += 1;
        update(row.key, { include: false });
      } catch (addError) {
        failures.push(
          `${name}: ${addError instanceof Error ? addError.message : "Could not add"}`,
        );
      }
    }

    setBusy(false);
    setProgress("");
    setNotice(
      failures.length === 0
        ? `Added ${added} ${added === 1 ? "person" : "people"}.`
        : `Added ${added}. ${failures[0]}`,
    );
  };

  return (
    <section className="border border-carbon-blue/15 bg-white">
      <div className="space-y-3 p-3">
        <p className="text-[12px] text-carbon-blue/70">
          Upload an Excel or CSV file. A phone is kept when the cell looks like a number, even
          if the column says Tlf, GSM, or Fax. Extra columns stay on the person. You decide who
          to add. A company that is not here yet is added with them, and it stays unclassified
          until you say what kind of relationship it is.
        </p>
        <input
          type="file"
          accept=".csv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            event.target.value = "";
            void handleFile(file);
          }}
          className="block w-full text-[12px] text-carbon-blue file:mr-3 file:border file:border-carbon-blue/15 file:bg-white file:px-2 file:py-1 file:text-[12px]"
        />

        {error ? (
          <p role="alert" className="text-[12px] text-red-700">
            {error}
          </p>
        ) : null}
        {notice && !error ? <p className="text-[12px] text-carbon-blue/80">{notice}</p> : null}
        {progress ? <p className="text-[12px] text-carbon-blue/70">{progress}</p> : null}

        {drafts.length > 0 ? (
          <div className="max-h-80 overflow-auto border border-carbon-blue/10">
            <table className="w-full text-left text-[12px] text-carbon-blue">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-carbon-blue/10 text-[10px] uppercase tracking-wider text-carbon-blue/55">
                  <th className="px-2 py-1.5 font-semibold">Add</th>
                  <th className="px-2 py-1.5 font-semibold">Name</th>
                  <th className="px-2 py-1.5 font-semibold">Email</th>
                  <th className="px-2 py-1.5 font-semibold">Company</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((row) => {
                  const note = contactImportNote(
                    row,
                    known,
                    row.ambiguous && !row.companyId,
                  );
                  return (
                    <tr key={row.key} className="border-b border-carbon-blue/5 align-top">
                      <td className="px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={row.include}
                          disabled={busy || note !== null}
                          onChange={(event) => update(row.key, { include: event.target.checked })}
                          aria-label={`Add ${row.firstName} ${row.lastName}`.trim()}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex gap-1">
                          <input
                            value={row.firstName}
                            disabled={busy}
                            onChange={(event) => update(row.key, { firstName: event.target.value })}
                            aria-label="First name"
                            className="w-24 border border-carbon-blue/15 px-1 py-0.5"
                          />
                          <input
                            value={row.lastName}
                            disabled={busy}
                            onChange={(event) => update(row.key, { lastName: event.target.value })}
                            aria-label="Last name"
                            className="w-24 border border-carbon-blue/15 px-1 py-0.5"
                          />
                        </div>
                        {contactDetailLines(row).map((line, index) => (
                          <p key={`${row.key}-${index}`} className="mt-0.5 text-[11px] text-carbon-blue/70">
                            {line}
                          </p>
                        ))}
                        {note ? <p className="mt-1 text-[11px] text-carbon-blue/60">{note}</p> : null}
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={row.email}
                          disabled={busy}
                          onChange={(event) => update(row.key, { email: event.target.value })}
                          aria-label="Email"
                          className="w-full min-w-[8rem] border border-carbon-blue/15 px-1 py-0.5"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          value={row.companyName}
                          disabled={busy}
                          onChange={(event) => {
                            const companyName = event.target.value;
                            const match = matchCompanyId(
                              companyName,
                              companies.map((company) => ({
                                CompanyID: company.CompanyID,
                                Title: company.Title,
                              })),
                            );
                            update(row.key, {
                              companyName,
                              companyId: match.id,
                              ambiguous: match.ambiguous,
                            });
                          }}
                          aria-label="Company name"
                          className="mb-1 w-full min-w-[10rem] border border-carbon-blue/15 px-1 py-0.5"
                        />
                        <p className="mb-1 text-[11px] text-carbon-blue/60">
                          {row.companyId
                            ? "Already in SmartCRM"
                            : row.companyName.trim()
                              ? "New company"
                              : "No company on this row"}
                        </p>
                        <select
                          value={row.companyId ?? ""}
                          disabled={busy}
                          onChange={(event) =>
                            update(row.key, {
                              companyId: event.target.value || null,
                              ambiguous: false,
                            })
                          }
                          aria-label="Company"
                          className="w-full min-w-[8rem] border border-carbon-blue/15 bg-white px-1 py-0.5"
                        >
                          <option value="">New company</option>
                          {companyOptions.map((company) => (
                            <option key={company.CompanyID} value={company.CompanyID}>
                              {company.Title}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {drafts.length > 0 ? (
          <button
            type="button"
            disabled={busy || ready.length === 0}
            onClick={() => void handleAdd()}
            className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-upcycle-orange disabled:opacity-50"
          >
            {busy ? "Adding…" : `Add ${ready.length} ${ready.length === 1 ? "person" : "people"}`}
          </button>
        ) : null}
      </div>
    </section>
  );
}
