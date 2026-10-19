"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useAuth } from "@/context/auth-context";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import { USER_ROLE_LABELS } from "@/types/auth";

type MatchReason =
  | "exact_email"
  | "phone_match"
  | "email_domain"
  | "company_name_exact"
  | "company_name_partial"
  | "full_name_match";

type ContactSummary = {
  id: string;
  fullName: string | null;
  jobTitle: string | null;
  companyId: string | null;
  companyName: string | null;
};

type CompanyCandidate = {
  kind: "company";
  confidence: number;
  reasons: MatchReason[];
  company: { id: string; name: string; website: string | null };
};

type ContactCandidate = {
  kind: "contact";
  confidence: number;
  reasons: MatchReason[];
  contact: ContactSummary;
};

type SuggestedAction = "open_contact" | "review_candidates" | "classify_and_create_new";

type ScanResponse = {
  extracted: CardFields;
  evidenceUrl: string;
  matchResult: {
    status: "existing_contact" | "candidates" | "no_match";
    suggestedAction: SuggestedAction;
    candidates: {
      existingContact: ContactSummary | null;
      contacts: ContactCandidate[];
      companies: CompanyCandidate[];
    };
  };
};

type CardFields = {
  name: string;
  role: string;
  companyName: string;
  email: string;
  phone: string;
};

type ApproveAction = "attach_to_company" | "create_company_and_contact" | "attach_contact_only";

type ApproveSuccess = {
  status: "created";
  action: ApproveAction;
  contactId: string;
  companyId: string | null;
  companyCode: string | null;
  companyCreated: boolean;
};

type ApproveFailure = {
  error?: string;
  existingContactId?: string;
  existingCompanyId?: string;
};

type Conflict = {
  message: string;
  href: string | null;
  linkLabel: string | null;
};

type Phase =
  | { step: "idle"; error: string | null }
  | { step: "scanning" }
  | { step: "review"; scan: ScanResponse }
  | { step: "success"; result: ApproveSuccess; contactName: string; companyName: string | null };

const EMPTY_FIELDS: CardFields = { name: "", role: "", companyName: "", email: "", phone: "" };

const REASON_LABELS: Record<MatchReason, string> = {
  exact_email: "Exact email",
  phone_match: "Phone match",
  email_domain: "Domain match",
  company_name_exact: "Exact name",
  company_name_partial: "Partial name",
  full_name_match: "Same name",
};

const FIELD_DEFS: ReadonlyArray<{
  key: keyof CardFields;
  label: string;
  type: string;
  autoComplete: string;
  inputMode?: "email" | "tel" | "text";
}> = [
  { key: "name", label: "Name", type: "text", autoComplete: "name" },
  { key: "role", label: "Job Title", type: "text", autoComplete: "organization-title" },
  { key: "companyName", label: "Company", type: "text", autoComplete: "organization" },
  { key: "email", label: "Email", type: "email", autoComplete: "email", inputMode: "email" },
  { key: "phone", label: "Phone", type: "tel", autoComplete: "tel", inputMode: "tel" },
];

const BTN_BASE =
  "flex min-h-[48px] w-full items-center justify-center rounded-xl px-4 text-base font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:cursor-not-allowed disabled:opacity-50";
const BTN_PRIMARY = `${BTN_BASE} bg-sky-500 text-slate-950 hover:bg-sky-400 active:bg-sky-600`;
const BTN_SECONDARY = `${BTN_BASE} border border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700`;
const BTN_TERTIARY = `${BTN_BASE} text-slate-300 hover:bg-slate-800`;

function readError(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const { error } = payload as { error?: unknown };
    if (typeof error === "string" && error.length > 0) return error;
  }
  return fallback;
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function Spinner({ className = "h-12 w-12" }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block animate-spin rounded-full border-4 border-slate-700 border-t-sky-400 ${className}`}
    />
  );
}

export default function CardIntakePage() {
  const { user } = useAuth();
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>({ step: "idle", error: null });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [fields, setFields] = useState<CardFields>(EMPTY_FIELDS);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [conflict, setConflict] = useState<Conflict | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isSignedIn = user.id !== 0;
  const roleLabel = USER_ROLE_LABELS[user.role] ?? user.role;

  const authHeaders = useMemo<Record<string, string>>(
    () => ({
      [AUTH_ROLE_HEADER]: user.role,
      ...(user.id !== 0 ? { "x-sb-user-id": String(user.id) } : {}),
      ...(user.email ? { "x-sb-user-email": user.email } : {}),
    }),
    [user.role, user.id, user.email],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const replacePreview = useCallback((next: string | null) => {
    setPreviewUrl(next);
  }, []);

  const reset = useCallback(() => {
    replacePreview(null);
    setExpanded(false);
    setFields(EMPTY_FIELDS);
    setSelectedCompanyId(null);
    setConflict(null);
    setActionError(null);
    setSubmitting(false);
    setPhase({ step: "idle", error: null });
  }, [replacePreview]);

  const handleFile = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      replacePreview(URL.createObjectURL(file));
      setConflict(null);
      setActionError(null);
      setPhase({ step: "scanning" });

      try {
        const body = new FormData();
        body.append("file", file);
        const response = await fetch("/api/crm/intake/card/scan", {
          method: "POST",
          headers: authHeaders,
          body,
        });
        const payload = await readJson(response);
        if (!response.ok) {
          throw new Error(readError(payload, "Scan failed. Try again with a clearer photo."));
        }

        const scan = payload as ScanResponse;
        setFields(scan.extracted);
        setSelectedCompanyId(scan.matchResult.candidates.companies[0]?.company.id ?? null);
        setPhase({ step: "review", scan });
      } catch (error) {
        replacePreview(null);
        setPhase({
          step: "idle",
          error: error instanceof Error ? error.message : "Scan failed. Try again.",
        });
      }
    },
    [authHeaders, replacePreview],
  );

  const submit = useCallback(
    async (action: ApproveAction, scan: ScanResponse, companyName: string | null) => {
      setSubmitting(true);
      setConflict(null);
      setActionError(null);

      try {
        const response = await fetch("/api/crm/intake/card/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders },
          body: JSON.stringify({
            action,
            companyId: action === "attach_to_company" ? selectedCompanyId : undefined,
            contact: {
              name: fields.name,
              role: fields.role,
              companyName: fields.companyName,
              email: fields.email,
              phone: fields.phone,
            },
            evidenceUrl: scan.evidenceUrl,
          }),
        });
        const payload = await readJson(response);

        if (response.status === 409) {
          const failure = (payload ?? {}) as ApproveFailure;
          setConflict({
            message: readError(payload, "This card looks like a duplicate."),
            href: failure.existingContactId
              ? `/contacts/${encodeURIComponent(failure.existingContactId)}`
              : failure.existingCompanyId
                ? `/companies/${encodeURIComponent(failure.existingCompanyId)}`
                : null,
            linkLabel: failure.existingContactId
              ? "View existing contact"
              : failure.existingCompanyId
                ? "View existing company"
                : null,
          });
          return;
        }
        if (!response.ok) {
          setActionError(readError(payload, "Could not save this card. Try again."));
          return;
        }

        setPhase({
          step: "success",
          result: payload as ApproveSuccess,
          contactName: fields.name.trim(),
          companyName,
        });
      } catch {
        setActionError("Network error. Check your connection and try again.");
      } finally {
        setSubmitting(false);
      }
    },
    [authHeaders, fields, selectedCompanyId],
  );

  const setField = (key: keyof CardFields, value: string) => {
    setFields((current) => ({ ...current, [key]: value }));
    setConflict(null);
  };

  return (
    <div className="min-h-dvh bg-slate-900 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/95 backdrop-blur">
        <div className="mx-auto flex min-h-[56px] max-w-xl items-center justify-between gap-3 px-4">
          <h1 className="text-lg font-semibold tracking-tight">Card Intake</h1>
          <div className="flex min-w-0 items-center gap-2 text-right">
            <span
              aria-hidden
              className={`h-2 w-2 shrink-0 rounded-full ${isSignedIn ? "bg-emerald-400" : "bg-amber-400"}`}
            />
            <div className="min-w-0 leading-tight">
              <p className="truncate text-xs font-medium text-slate-200">
                {isSignedIn ? user.displayName : "Not signed in"}
              </p>
              <p className="truncate text-[11px] text-slate-400">{roleLabel}</p>
            </div>
          </div>
        </div>
      </header>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <input
        ref={libraryInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      <main className="mx-auto w-full max-w-xl px-4 pb-[max(2rem,env(safe-area-inset-bottom))] pt-6">
        {phase.step === "idle" && (
          <section className="flex min-h-[calc(100dvh-8rem)] flex-col justify-center gap-4">
            <div className="mb-2 text-center">
              <p className="text-xl font-semibold">Add a contact from a card</p>
              <p className="mt-2 text-sm text-slate-400">
                We read the card and check what SmartCRM already knows before saving anything.
              </p>
            </div>
            {phase.error && (
              <p
                role="alert"
                className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
              >
                {phase.error}
              </p>
            )}
            <button
              type="button"
              className={`${BTN_PRIMARY} min-h-[64px] text-lg`}
              onClick={() => cameraInputRef.current?.click()}
            >
              Snap Business Card
            </button>
            <button
              type="button"
              className={BTN_SECONDARY}
              onClick={() => libraryInputRef.current?.click()}
            >
              Choose from Photos / Genius Scan
            </button>
          </section>
        )}

        {phase.step === "scanning" && (
          <section
            aria-live="polite"
            className="flex min-h-[calc(100dvh-8rem)] flex-col items-center justify-center gap-6 text-center"
          >
            {previewUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt="Business card being scanned"
                className="h-28 w-44 rounded-lg border border-slate-700 object-cover opacity-70"
              />
            )}
            <Spinner />
            <p className="text-base text-slate-300">Scanning card &amp; analyzing CRM matches...</p>
          </section>
        )}

        {phase.step === "review" && (
          <ReviewPanel
            scan={phase.scan}
            fields={fields}
            previewUrl={previewUrl}
            selectedCompanyId={selectedCompanyId}
            submitting={submitting}
            conflict={conflict}
            actionError={actionError}
            onExpand={() => setExpanded(true)}
            onField={setField}
            onSelectCompany={setSelectedCompanyId}
            onSubmit={submit}
            onCancel={reset}
          />
        )}

        {phase.step === "success" && (
          <section
            role="status"
            aria-live="polite"
            className="flex min-h-[calc(100dvh-8rem)] flex-col justify-center gap-5"
          >
            <div className="rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5">
              <p className="text-sm font-medium uppercase tracking-wide text-emerald-300">Saved</p>
              <p className="mt-1 text-xl font-semibold text-slate-50">{phase.contactName}</p>
              <p className="mt-2 text-sm text-slate-300">
                {phase.result.companyCreated
                  ? `Added with new company ${phase.companyName ?? ""}. Its relationship role is Unclassified until you classify it.`
                  : phase.result.companyId
                    ? `Added to ${phase.companyName ?? "the selected company"}.`
                    : "Added as a contact without a company."}
              </p>
              <Link
                href={`/contacts/${encodeURIComponent(phase.result.contactId)}`}
                className={`${BTN_SECONDARY} mt-4`}
              >
                View Contact
              </Link>
            </div>
            <button type="button" className={BTN_PRIMARY} onClick={reset}>
              Scan Next Card
            </button>
          </section>
        )}
      </main>

      {expanded && previewUrl && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Business card photo"
          className="fixed inset-0 z-30 flex flex-col bg-slate-950/95"
          onClick={() => setExpanded(false)}
        >
          <div className="flex justify-end p-3">
            <button
              type="button"
              className={`${BTN_SECONDARY} !w-auto min-w-[44px] px-5`}
              onClick={() => setExpanded(false)}
            >
              Close
            </button>
          </div>
          <div className="flex flex-1 items-center justify-center overflow-auto p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Business card, full size"
              className="max-h-full max-w-full rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}

type ReviewPanelProps = {
  scan: ScanResponse;
  fields: CardFields;
  previewUrl: string | null;
  selectedCompanyId: string | null;
  submitting: boolean;
  conflict: Conflict | null;
  actionError: string | null;
  onExpand: () => void;
  onField: (key: keyof CardFields, value: string) => void;
  onSelectCompany: (id: string) => void;
  onSubmit: (action: ApproveAction, scan: ScanResponse, companyName: string | null) => void;
  onCancel: () => void;
};

function ReviewPanel({
  scan,
  fields,
  previewUrl,
  selectedCompanyId,
  submitting,
  conflict,
  actionError,
  onExpand,
  onField,
  onSelectCompany,
  onSubmit,
  onCancel,
}: ReviewPanelProps) {
  const { existingContact, companies, contacts } = scan.matchResult.candidates;
  const selected = companies.find((c) => c.company.id === selectedCompanyId) ?? null;

  // The exact-email match only applies while the email is unchanged.
  const duplicateOfExisting =
    existingContact !== null &&
    fields.email.trim().toLowerCase() === scan.extracted.email.trim().toLowerCase();

  const hasName = fields.name.trim().length > 0;
  const canCreateCompany = hasName && fields.companyName.trim().length > 0;
  const blocked = submitting || !hasName || duplicateOfExisting;
  const attachPrimary = selected !== null && !duplicateOfExisting;

  return (
    <section className="flex flex-col gap-5">
      {previewUrl && (
        <button
          type="button"
          onClick={onExpand}
          aria-label="Expand card photo"
          className="group relative flex min-h-[44px] items-center gap-3 rounded-xl border border-slate-700 bg-slate-800/60 p-2 text-left"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Scanned business card"
            className="h-16 w-24 shrink-0 rounded-lg object-cover"
          />
          <span className="text-sm text-slate-300">Tap to view card photo</span>
        </button>
      )}

      {duplicateOfExisting && existingContact && (
        <div className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-xs font-bold uppercase text-slate-950">
              Warning
            </span>
            <p className="font-semibold text-amber-100">Contact Already Exists (Exact Email)</p>
          </div>
          <p className="mt-2 text-sm text-amber-100/90">
            {existingContact.fullName ?? "This person"}
            {existingContact.jobTitle ? `, ${existingContact.jobTitle}` : ""}
            {existingContact.companyName ? ` at ${existingContact.companyName}` : ""} is already
            in SmartCRM. Saving again would create a duplicate.
          </p>
          <Link
            href={`/contacts/${encodeURIComponent(existingContact.id)}`}
            className={`${BTN_PRIMARY} mt-3`}
          >
            Open Existing Contact
          </Link>
        </div>
      )}

      {!duplicateOfExisting && companies.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-4">
          <p className="text-sm font-medium text-slate-200">
            {companies.length === 1 ? "Possible company match" : "Possible company matches"}
          </p>
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Company match candidates">
            {companies.map((candidate) => {
              const active = candidate.company.id === selectedCompanyId;
              return (
                <li key={candidate.company.id}>
                  <button
                    type="button"
                    aria-pressed={active}
                    onClick={() => onSelectCompany(candidate.company.id)}
                    className={`min-h-[44px] rounded-full border px-4 py-1.5 text-left text-sm transition ${
                      active
                        ? "border-sky-400 bg-sky-500/20 text-sky-100"
                        : "border-slate-600 bg-slate-900 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <span className="block font-medium">{candidate.company.name}</span>
                    <span className="block text-xs text-slate-400">
                      {candidate.reasons.map((r) => REASON_LABELS[r]).join(" · ")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {!duplicateOfExisting && contacts.length > 0 && (
        <p className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm text-slate-300">
          Similar person already on file:{" "}
          {contacts.map((c, index) => (
            <span key={c.contact.id}>
              {index > 0 && ", "}
              <Link
                href={`/contacts/${encodeURIComponent(c.contact.id)}`}
                className="text-sky-300 underline underline-offset-2"
              >
                {c.contact.fullName ?? "Unnamed contact"}
              </Link>{" "}
              ({c.reasons.map((r) => REASON_LABELS[r]).join(", ")})
            </span>
          ))}
        </p>
      )}

      {!duplicateOfExisting && companies.length === 0 && contacts.length === 0 && !existingContact && (
        <p className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 text-sm text-slate-300">
          Nothing in SmartCRM matches this card yet.
        </p>
      )}

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => event.preventDefault()}
        noValidate
      >
        {FIELD_DEFS.map((field) => (
          <label key={field.key} className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-300">{field.label}</span>
            <input
              type={field.type}
              inputMode={field.inputMode}
              autoComplete={field.autoComplete}
              value={fields[field.key]}
              onChange={(event) => onField(field.key, event.target.value)}
              className="min-h-[48px] w-full rounded-xl border border-slate-700 bg-slate-800 px-4 text-base text-slate-100 placeholder:text-slate-500 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-400/40"
            />
          </label>
        ))}
      </form>

      {conflict && (
        <div role="alert" className="rounded-xl border border-amber-500/50 bg-amber-500/10 p-4">
          <p className="text-sm font-medium text-amber-100">{conflict.message}</p>
          {conflict.href && conflict.linkLabel && (
            <Link
              href={conflict.href}
              className="mt-2 inline-flex min-h-[44px] items-center text-sm font-semibold text-sky-300 underline underline-offset-2"
            >
              {conflict.linkLabel}
            </Link>
          )}
        </div>
      )}

      {actionError && (
        <p
          role="alert"
          className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
        >
          {actionError}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {selected && (
          <button
            type="button"
            disabled={blocked}
            className={attachPrimary ? BTN_PRIMARY : BTN_SECONDARY}
            onClick={() => onSubmit("attach_to_company", scan, selected.company.name)}
          >
            {submitting ? "Saving..." : `Attach to ${selected.company.name}`}
          </button>
        )}
        <button
          type="button"
          disabled={blocked || !canCreateCompany}
          className={selected || duplicateOfExisting ? BTN_SECONDARY : BTN_PRIMARY}
          onClick={() => onSubmit("create_company_and_contact", scan, fields.companyName.trim())}
        >
          Create as New Company &amp; Contact
        </button>
        <button
          type="button"
          disabled={blocked}
          className={BTN_TERTIARY}
          onClick={() => onSubmit("attach_contact_only", scan, null)}
        >
          Save Contact Only
        </button>
        <button type="button" disabled={submitting} className={BTN_TERTIARY} onClick={onCancel}>
          Discard &amp; Rescan
        </button>
        {!canCreateCompany && hasName && (
          <p className="text-center text-xs text-slate-500">
            Add a company name to create a new company.
          </p>
        )}
      </div>
    </section>
  );
}
