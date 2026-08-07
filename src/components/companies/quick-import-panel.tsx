"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { QuickImportPreview, QuickImportResult } from "@/lib/discovery/quick-import";
import {
  formatDuration,
  QUICK_IMPORT_STEP_LABELS,
  QUICK_IMPORT_STEP_ORDER,
} from "@/lib/discovery/quick-import-workflow";
import type { Company } from "@/types/company";
import { company360Href } from "@/types/company-360";
import { canCreateCompany } from "@/lib/permissions";
import type { UserRole } from "@/types/auth";
import { authUserToAccountOwner, resolveOwnerById } from "@/lib/company-owner";
import { CompanyOwnerSelect } from "@/components/companies/company-owner-select";
import { useAuth } from "@/context/auth-context";
import { companyWebsiteHref } from "@/lib/company-identity";

type QuickImportPanelProps = {
  role: UserRole;
  onImported: (company: Company) => void;
  contextCompanyId?: string;
  onRunWebsiteDiscovery?: (url: string) => void;
  embedded?: boolean;
  companies?: Company[];
};

type PanelPhase = "idle" | "analyzing" | "preview" | "importing" | "complete";

const SUPPORTED_INPUT_HINTS = [
  "Email signatures",
  "Business cards",
  "LinkedIn text",
  "PDF contact details",
  "Raw company information",
];

export function QuickImportPanel({
  role,
  onImported,
  contextCompanyId,
  onRunWebsiteDiscovery,
  embedded = false,
  companies = [],
}: QuickImportPanelProps) {
  const { user } = useAuth();
  const defaultOwner = authUserToAccountOwner(user);
  const [open, setOpen] = useState(embedded);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<PanelPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<QuickImportPreview | null>(null);
  const [result, setResult] = useState<QuickImportResult | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [accountOwnerId, setAccountOwnerId] = useState(defaultOwner.Id);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  if (!canCreateCompany(role)) return null;

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const reset = () => {
    clearTimer();
    setPhase("idle");
    setError(null);
    setPreview(null);
    setResult(null);
    setStepIndex(0);
    setDurationMs(0);
    setAccountOwnerId(defaultOwner.Id);
  };

  useEffect(() => () => clearTimer(), []);

  const handleAnalyze = useCallback(async () => {
    if (!text.trim()) return;

    const startedAt = Date.now();
    setPhase("analyzing");
    setError(null);
    setResult(null);
    setStepIndex(0);

    timerRef.current = setInterval(() => {
      setStepIndex((current) =>
        current < QUICK_IMPORT_STEP_ORDER.length - 2 ? current + 1 : current,
      );
    }, 500);

    try {
      const response = await fetch("/api/discovery/quick-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), contextCompanyId }),
      });

      const body = (await response.json()) as QuickImportPreview | { error?: string };
      if (!response.ok) {
        throw new Error("error" in body && body.error ? body.error : "Analysis failed");
      }

      clearTimer();
      setStepIndex(QUICK_IMPORT_STEP_ORDER.length - 2);
      setPreview(body as QuickImportPreview);
      setPhase("preview");
    } catch (analyzeError) {
      clearTimer();
      setError(analyzeError instanceof Error ? analyzeError.message : "Analysis failed");
      setPhase("idle");
    } finally {
      setDurationMs(Date.now() - startedAt);
    }
  }, [text, contextCompanyId]);

  const handleImport = async () => {
    if (!preview) return;

    const startedAt = Date.now();
    setPhase("importing");
    setError(null);
    setStepIndex(QUICK_IMPORT_STEP_ORDER.length - 1);

    try {
      const accountOwner = resolveOwnerById(accountOwnerId, companies) ?? defaultOwner;
      const response = await fetch("/api/discovery/quick-import/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview, accountOwner }),
      });

      const body = (await response.json()) as QuickImportResult | { error?: string };
      if (!response.ok) {
        throw new Error("error" in body && body.error ? body.error : "Import failed");
      }

      const importResult = body as QuickImportResult;
      setResult(importResult);
      setDurationMs(Date.now() - startedAt);
      onImported(importResult.company);
      setPhase("complete");
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Import failed");
      setPhase("preview");
    }
  };

  const busy = phase === "analyzing" || phase === "importing";
  const panelOpen = embedded || open;

  return (
    <section className="border border-carbon-blue/15 bg-white">
      {embedded ? null : (
        <div className="flex items-center justify-between border-b border-carbon-blue/10 px-3 py-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Quick Import
            </p>
            <p className="text-[10px] text-carbon-blue/45">
              Paste signatures, cards, or LinkedIn — never type what text already contains.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen((value) => !value);
              if (open) reset();
            }}
            className="border border-carbon-blue/15 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue transition-colors hover:border-upcycle-orange/30 hover:bg-upcycle-orange/[0.04] hover:text-upcycle-orange"
          >
            {open ? "Close" : "Quick Import"}
          </button>
        </div>
      )}

      {panelOpen ? (
        <div className="space-y-3 p-3">
          <WorkflowHero phase={phase} error={error} />

          <label className="block">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Paste company or contact information
            </span>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={`Paste email signature, business card, LinkedIn profile, or company details…\n\nExample:\nJohn Smith\nSales Director\nAcme Recycling AS\njohn.smith@acme.no | +47 900 00 000\nwww.acme.no`}
              disabled={busy || phase === "complete"}
              rows={8}
              className="mt-1 w-full resize-y border border-carbon-blue/15 px-2.5 py-2 text-xs leading-relaxed text-carbon-blue outline-none focus:border-upcycle-orange"
            />
          </label>

          <div className="flex flex-wrap gap-1.5">
            {SUPPORTED_INPUT_HINTS.map((hint) => (
              <span
                key={hint}
                className="border border-carbon-blue/10 px-1.5 py-0.5 text-[9px] text-carbon-blue/45"
              >
                {hint}
              </span>
            ))}
          </div>

          {phase === "idle" || phase === "analyzing" ? (
            <button
              type="button"
              disabled={!text.trim() || busy}
              onClick={() => void handleAnalyze()}
              className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange disabled:opacity-50"
            >
              {phase === "analyzing" ? "Analyzing…" : "Analyze"}
            </button>
          ) : null}

          {phase === "analyzing" || phase === "importing" ? (
            <ImportProgressView stepIndex={stepIndex} importing={phase === "importing"} />
          ) : null}

          {preview && (phase === "preview" || phase === "complete") ? (
            <PreviewView preview={preview} />
          ) : null}

          {preview && phase === "preview" ? (
            <div className="space-y-3">
              <CompanyOwnerSelect
                companies={companies}
                value={resolveOwnerById(accountOwnerId, companies) ?? defaultOwner}
                onChange={(owner) => setAccountOwnerId(owner.Id)}
                required
                label="Account Owner"
                compact
              />
              <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={!preview.hasCompanyData && !preview.hasContactData}
                className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white"
              >
                Import
              </button>
              <button
                type="button"
                onClick={reset}
                className="border border-carbon-blue/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60"
              >
                Start Over
              </button>
            </div>
            </div>
          ) : null}

          {result && phase === "complete" ? (
            <CompletionView
              result={result}
              durationMs={durationMs}
              onStartOver={reset}
              onRunWebsiteDiscovery={onRunWebsiteDiscovery}
            />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function WorkflowHero({ phase, error }: { phase: PanelPhase; error: string | null }) {
  const messages: Record<PanelPhase, { title: string; detail: string }> = {
    idle: {
      title: "What is happening?",
      detail: "Paste unstructured business text — SmartCRM extracts structured records.",
    },
    analyzing: {
      title: "What is happening?",
      detail: "Parsing text, matching records, and preparing your import preview.",
    },
    preview: {
      title: "What matters?",
      detail: "Review detected company, contact, and field actions before importing.",
    },
    importing: {
      title: "What is happening?",
      detail: "Creating or updating company and contact records — no silent imports.",
    },
    complete: {
      title: "What should happen next?",
      detail: "Review results and follow the recommended next action.",
    },
  };

  const message = messages[phase];

  return (
    <div className="rounded-lg border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/50">
        {message.title}
      </p>
      <p className="mt-0.5 text-[11px] text-carbon-blue/65">{message.detail}</p>
      {error ? <p className="mt-1 text-[11px] text-thermal-red">{error}</p> : null}
    </div>
  );
}

function ImportProgressView({
  stepIndex,
  importing,
}: {
  stepIndex: number;
  importing: boolean;
}) {
  return (
    <div className="space-y-2 border border-upcycle-orange/20 bg-upcycle-orange/[0.03] p-3">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-upcycle-orange">
        {importing ? "Import Progress" : "Analysis Progress"}
      </p>
      <ul className="space-y-1.5">
        {QUICK_IMPORT_STEP_ORDER.map((stepId, index) => (
          <StepRow
            key={stepId}
            label={QUICK_IMPORT_STEP_LABELS[stepId]}
            state={
              index < stepIndex
                ? "done"
                : index === stepIndex
                  ? "active"
                  : "pending"
            }
          />
        ))}
      </ul>
    </div>
  );
}

function StepRow({
  label,
  state,
}: {
  label: string;
  state: "done" | "active" | "pending";
}) {
  const icon = state === "done" ? "✓" : state === "active" ? "⟳" : "○";
  const tone =
    state === "done"
      ? "text-emerald-700"
      : state === "active"
        ? "text-upcycle-orange"
        : "text-carbon-blue/35";

  return (
    <li className={`flex items-center gap-2 text-[11px] ${tone}`}>
      <span className="w-4 shrink-0 text-center font-semibold" aria-hidden>
        {icon}
      </span>
      <span className={state === "pending" ? "text-carbon-blue/45" : "font-medium"}>{label}</span>
    </li>
  );
}

function PreviewView({ preview }: { preview: QuickImportPreview }) {
  return (
    <div className="space-y-3 border border-carbon-blue/10 p-3">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        Import Preview
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <MatchCard
          title="Company Detected"
          name={preview.extracted.companyName || preview.company.companyName || "—"}
          action={preview.company.action}
          reason={preview.company.reason}
          confidence={preview.company.confidence}
        />
        <MatchCard
          title="Contact Detected"
          name={preview.extracted.contactName || preview.contact.contactName || "—"}
          action={preview.contact.action}
          reason={preview.contact.reason}
          confidence={preview.contact.confidence}
        />
      </div>

      <div>
        <p className="mb-1.5 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Fields Extracted
        </p>
        <ul className="max-h-40 space-y-1 overflow-y-auto">
          {preview.fields.map((field) => (
            <li
              key={field.field}
              className="flex items-center justify-between gap-2 text-[10px] text-carbon-blue/70"
            >
              <span className="text-carbon-blue/45">{field.field}</span>
              <span className="truncate font-medium">{field.value}</span>
              <ActionBadge action={field.action} />
            </li>
          ))}
        </ul>
      </div>

      <IntelligencePanel preview={preview} />
    </div>
  );
}

function MatchCard({
  title,
  name,
  action,
  reason,
  confidence,
}: {
  title: string;
  name: string;
  action: "create" | "update" | "skip";
  reason: string;
  confidence: string;
}) {
  return (
    <div className="rounded-md border border-carbon-blue/10 bg-white px-2.5 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        {title}
      </p>
      <p className="mt-0.5 text-[12px] font-semibold text-carbon-blue">{name}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <ActionBadge action={action} />
        <span className="text-[9px] uppercase tracking-wider text-carbon-blue/35">
          {confidence} confidence
        </span>
      </div>
      <p className="mt-1 text-[10px] text-carbon-blue/50">{reason}</p>
    </div>
  );
}

function ActionBadge({ action }: { action: "create" | "update" | "skip" | "unchanged" }) {
  const styles = {
    create: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800",
    update: "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange",
    skip: "border-carbon-blue/15 bg-carbon-blue/[0.03] text-carbon-blue/45",
    unchanged: "border-carbon-blue/10 text-carbon-blue/35",
  };

  const labels = {
    create: "Create",
    update: "Update",
    skip: "Skip",
    unchanged: "—",
  };

  return (
    <span
      className={`shrink-0 border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider ${styles[action]}`}
    >
      {labels[action]}
    </span>
  );
}

function IntelligencePanel({ preview }: { preview: QuickImportPreview }) {
  const { intelligence } = preview;
  const notes: string[] = [];

  if (intelligence.emailDomain) {
    notes.push(`Email domain: ${intelligence.emailDomain}`);
  }
  if (intelligence.websiteValid) {
    notes.push(`Website validated: ${intelligence.websiteDomain}`);
  }
  if (intelligence.emailDomainMatchesWebsite) {
    notes.push("Email domain matches website");
  }
  if (intelligence.addressNormalized) {
    notes.push("Address normalized");
  }
  if (intelligence.freeEmailProvider) {
    notes.push("Free email provider — company match may be less reliable");
  }
  if (intelligence.duplicateWarning) {
    notes.push(`Duplicate: ${intelligence.duplicateWarning}`);
  }

  if (notes.length === 0) return null;

  return (
    <div className="border-t border-carbon-blue/8 pt-2">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        Intelligence
      </p>
      <ul className="mt-1 space-y-0.5 text-[10px] text-carbon-blue/55">
        {notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

function CompletionView({
  result,
  durationMs,
  onStartOver,
  onRunWebsiteDiscovery,
}: {
  result: QuickImportResult;
  durationMs: number;
  onStartOver: () => void;
  onRunWebsiteDiscovery?: (url: string) => void;
}) {
  const companyLabel = result.companyCreated
    ? "Created"
    : result.companyUpdated
      ? "Updated"
      : "Unchanged";
  const contactLabel = result.contactCreated
    ? "Created"
    : result.contactUpdated
      ? "Updated"
      : result.contactSkipped
        ? "Skipped"
        : "—";

  const websiteUrl = result.company.Domain
    ? companyWebsiteHref(result.company.Domain)
    : null;

  return (
    <div className="space-y-3 border border-emerald-500/25 bg-emerald-500/[0.04] p-3">
      <p className="text-[11px] font-bold text-emerald-800">Import Complete</p>

      <dl className="grid gap-2 sm:grid-cols-2">
        <Stat label="Company" value={companyLabel} />
        <Stat label="Contact" value={contactLabel} />
        <Stat label="Website Linked" value={result.websiteLinked ? "Yes" : "No"} />
        <Stat label="Duration" value={formatDuration(durationMs)} />
        <Stat label="Errors" value={String(result.errors.length)} />
      </dl>

      {result.errors.length > 0 ? (
        <ul className="space-y-1 text-[10px] text-thermal-red">
          {result.errors.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      {result.recommendedNextAction ? (
        <div className="rounded-md border border-upcycle-orange/20 bg-upcycle-orange/[0.04] px-2.5 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-upcycle-orange">
            Recommended Next Action
          </p>
          <p className="mt-0.5 text-[11px] text-carbon-blue/70">{result.recommendedNextAction}</p>
          {websiteUrl && onRunWebsiteDiscovery ? (
            <button
              type="button"
              onClick={() => onRunWebsiteDiscovery(websiteUrl)}
              className="mt-2 border border-upcycle-orange/30 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange"
            >
              Run Website Discovery
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <Link
          href={company360Href(result.company)}
          className="inline-flex border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white"
        >
          View Company
        </Link>
        {result.contact ? (
          <Link
            href={company360Href(result.company, "contacts")}
            className="inline-flex border border-carbon-blue/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue hover:border-upcycle-orange/30"
          >
            View Contact
          </Link>
        ) : null}
        <button
          type="button"
          onClick={onStartOver}
          className="inline-flex border border-carbon-blue/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60"
        >
          New Import
        </button>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-carbon-blue/8 bg-white px-2 py-1.5">
      <dt className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        {label}
      </dt>
      <dd className="mt-0.5 text-[12px] font-semibold text-carbon-blue">{value}</dd>
    </div>
  );
}
