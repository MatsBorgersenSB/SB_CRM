"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DiscoveredContact, WebsiteDiscoveryResult } from "@/lib/discovery/types";
import {
  buildWebsiteDiscoveryInsights,
  countEmailsFound,
  DISCOVERY_STEP_LABELS,
  DISCOVERY_STEP_ORDER,
  formatDuration,
  type DiscoveryStepId,
  type ImportCompletionSummary,
  type WebsiteDiscoveryInsights,
} from "@/lib/discovery/website-discovery-workflow";
import {
  prepareDiscoveryForImport,
  resolveDiscoveryCompanyName,
} from "@/lib/discovery/website-discovery";
import type { Company } from "@/types/company";
import { company360Href } from "@/types/company-360";
import { authUserToAccountOwner, resolveOwnerById } from "@/lib/company-owner";
import { CompanyOwnerSelect } from "@/components/companies/company-owner-select";
import { useAuth } from "@/context/auth-context";
import { canCreateCompany } from "@/lib/permissions";
import type { UserRole } from "@/types/auth";

type WebsiteDiscoveryPanelProps = {
  role: UserRole;
  onImported: (company: Company) => void;
  context?: "company" | "contact";
  embedded?: boolean;
  initialUrl?: string;
  companies?: Company[];
};

type PanelPhase = "idle" | "discovering" | "preview" | "importing" | "complete";

type DiscoveryLiveStats = {
  contactsFound: number;
  emailsFound: number;
  pagesAnalyzed: number;
};

type ImportProgressState = {
  companyDone: boolean;
  companyCreated: boolean;
  processed: number;
  total: number;
  currentContact: DiscoveredContact | null;
  newContacts: number;
  updatedContacts: number;
  skippedContacts: number;
  errors: string[];
};

const INITIAL_IMPORT_PROGRESS: ImportProgressState = {
  companyDone: false,
  companyCreated: false,
  processed: 0,
  total: 0,
  currentContact: null,
  newContacts: 0,
  updatedContacts: 0,
  skippedContacts: 0,
  errors: [],
};

export function WebsiteDiscoveryPanel({
  role,
  onImported,
  context = "company",
  embedded = false,
  initialUrl = "",
  companies = [],
}: WebsiteDiscoveryPanelProps) {
  const router = useRouter();
  const { user } = useAuth();
  const defaultOwner = authUserToAccountOwner(user);
  const [open, setOpen] = useState(embedded);
  const [url, setUrl] = useState(initialUrl);
  const [phase, setPhase] = useState<PanelPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [discovery, setDiscovery] = useState<WebsiteDiscoveryResult | null>(null);
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [discoveryStepIndex, setDiscoveryStepIndex] = useState(0);
  const [liveStats, setLiveStats] = useState<DiscoveryLiveStats>({
    contactsFound: 0,
    emailsFound: 0,
    pagesAnalyzed: 0,
  });
  const [importProgress, setImportProgress] = useState<ImportProgressState>(
    INITIAL_IMPORT_PROGRESS,
  );
  const [completion, setCompletion] = useState<ImportCompletionSummary | null>(null);
  const [insights, setInsights] = useState<WebsiteDiscoveryInsights | null>(null);
  const [accountOwnerId, setAccountOwnerId] = useState(defaultOwner.Id);
  const discoveryTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearDiscoveryTimer = () => {
    if (discoveryTimerRef.current) {
      clearInterval(discoveryTimerRef.current);
      discoveryTimerRef.current = null;
    }
  };

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 4000);
  }, []);

  const reset = useCallback(() => {
    clearDiscoveryTimer();
    setPhase("idle");
    setError(null);
    setDiscovery(null);
    setSelectedContactIds(new Set());
    setDiscoveryStepIndex(0);
    setLiveStats({ contactsFound: 0, emailsFound: 0, pagesAnalyzed: 0 });
    setImportProgress(INITIAL_IMPORT_PROGRESS);
    setCompletion(null);
    setInsights(null);
    setAccountOwnerId(defaultOwner.Id);
    setUrl("");
  }, [defaultOwner.Id]);

  useEffect(() => {
    if (initialUrl) setUrl(initialUrl);
  }, [initialUrl]);

  useEffect(() => {
    return () => {
      clearDiscoveryTimer();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  if (!canCreateCompany(role)) return null;

  const handleDiscover = useCallback(async () => {
    if (!url.trim()) return;

    setPhase("discovering");
    setError(null);
    setCompletion(null);
    setDiscoveryStepIndex(0);
    setLiveStats({ contactsFound: 0, emailsFound: 0, pagesAnalyzed: 0 });

    discoveryTimerRef.current = setInterval(() => {
      setDiscoveryStepIndex((current) =>
        current < DISCOVERY_STEP_ORDER.length - 1 ? current + 1 : current,
      );
      setLiveStats((stats) => ({
        contactsFound: stats.contactsFound,
        emailsFound: stats.emailsFound,
        pagesAnalyzed: stats.pagesAnalyzed > 0 ? stats.pagesAnalyzed : stats.pagesAnalyzed + 1,
      }));
    }, 650);

    try {
      const response = await fetch("/api/discovery/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });

      const body = (await response.json()) as WebsiteDiscoveryResult | { error?: string };
      if (!response.ok) {
        throw new Error("error" in body && body.error ? body.error : "Discovery failed");
      }

      const result = body as WebsiteDiscoveryResult;
      clearDiscoveryTimer();
      setDiscoveryStepIndex(DISCOVERY_STEP_ORDER.length - 1);
      setDiscovery(result);
      setInsights(buildWebsiteDiscoveryInsights(result));
      setLiveStats({
        contactsFound: result.contacts.length,
        emailsFound: countEmailsFound(result),
        pagesAnalyzed: result.pagesAnalyzed.length,
      });
      setSelectedContactIds(new Set());
      setPhase("preview");
    } catch (discoverError) {
      clearDiscoveryTimer();
      setError(discoverError instanceof Error ? discoverError.message : "Discovery failed");
      setPhase("idle");
    }
  }, [url]);

  const toggleContact = (contactId: string) => {
    setSelectedContactIds((current) => {
      const next = new Set(current);
      if (next.has(contactId)) next.delete(contactId);
      else next.add(contactId);
      return next;
    });
  };

  const handleImport = async () => {
    if (!discovery) return;

    // Contacts are optional — never block company-only import
    const selected = discovery.contacts.filter((c) => selectedContactIds.has(c.id));
    const startedAt = Date.now();

    setPhase("importing");
    setError(null);
    setImportProgress({
      ...INITIAL_IMPORT_PROGRESS,
      total: selected.length,
    });

    try {
      const accountOwner = resolveOwnerById(accountOwnerId, companies) ?? defaultOwner;
      const preparedDiscovery = prepareDiscoveryForImport(discovery);

      const companyResponse = await fetch("/api/discovery/website/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          discovery: preparedDiscovery,
          phase: "company",
          accountOwner,
          selectedContactIds: selected.map((contact) => contact.id),
        }),
      });

      const companyBody = (await companyResponse.json()) as
        | { company: Company; created: boolean }
        | { error?: string };

      if (!companyResponse.ok) {
        throw new Error(
          "error" in companyBody && companyBody.error ? companyBody.error : "Company import failed",
        );
      }

      const { company, created } = companyBody as { company: Company; created: boolean };

      setImportProgress((prev) => ({
        ...prev,
        companyDone: true,
        companyCreated: created,
      }));

      const importedIds: string[] = [];
      let newContacts = 0;
      let updatedContacts = 0;
      let skippedContacts = 0;
      const errors: string[] = [];

      for (let index = 0; index < selected.length; index++) {
        const contact = selected[index]!;
        setImportProgress((prev) => ({
          ...prev,
          currentContact: contact,
          processed: index,
        }));

        const contactResponse = await fetch("/api/discovery/website/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            discovery: preparedDiscovery,
            phase: "contact",
            companyId: company.CompanyID,
            contactId: contact.id,
          }),
        });

        const contactBody = (await contactResponse.json()) as
          | { status: string; contact?: { ContactID: string }; reason?: string; error?: string }
          | { error?: string };

        if (!contactResponse.ok) {
          const message =
            "error" in contactBody && contactBody.error ? contactBody.error : "Contact import failed";
          errors.push(`${contact.name}: ${message}`);
          skippedContacts += 1;
        } else {
          const result = contactBody as {
            status: string;
            contact?: { ContactID: string };
            reason?: string;
          };
          if (result.status === "imported" && result.contact) {
            newContacts += 1;
            importedIds.push(result.contact.ContactID);
          } else if (result.status === "updated") {
            updatedContacts += 1;
            if (result.contact) importedIds.push(result.contact.ContactID);
          } else {
            skippedContacts += 1;
            if (result.reason) errors.push(`${contact.name}: ${result.reason}`);
          }
        }

        setImportProgress((prev) => ({
          ...prev,
          processed: index + 1,
          newContacts,
          updatedContacts,
          skippedContacts,
          errors,
        }));
      }

      const durationMs = Date.now() - startedAt;
      setCompletion({
        company,
        companyCreated: created,
        newContacts,
        updatedContacts,
        skippedContacts,
        errors,
        durationMs,
        importedContactIds: importedIds,
      });
      setImportProgress((prev) => ({
        ...prev,
        currentContact: null,
        processed: selected.length,
      }));

      onImported(company);
      router.refresh();
      showToast("Company imported successfully!");
      reset();
    } catch (importError) {
      console.error("[WebsiteDiscovery] Failed to import company:", importError);
      showToast("Failed to import company");
      setError(
        importError instanceof Error ? importError.message : "Failed to import company",
      );
      setPhase("preview");
    }
  };

  const busy = phase === "discovering" || phase === "importing";

  const panelOpen = embedded || open;

  return (
    <section className="border border-carbon-blue/15 bg-white">
      {embedded ? null : (
        <div className="flex items-center justify-between border-b border-carbon-blue/10 px-3 py-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Website Discovery
            </p>
            <p className="text-[10px] text-carbon-blue/45">
              {context === "contact"
                ? "Discover people on a company site — always see progress, never silent imports."
                : "Paste a URL — live discovery, transparent import, actionable next steps."}
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
            {open ? "Close" : "Discover"}
          </button>
        </div>
      )}

      {panelOpen ? (
        <div className="space-y-3 p-3">
          <WorkflowHero phase={phase} error={error} />

          <label className="block">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Website URL
            </span>
            <div className="mt-1 flex gap-2">
              <input
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://fjordfilter.com"
                disabled={busy || phase === "complete"}
                className="min-w-0 flex-1 border border-carbon-blue/15 px-2 py-1.5 text-xs text-carbon-blue outline-none focus:border-upcycle-orange"
              />
              <button
                type="button"
                disabled={!url.trim() || busy || phase === "complete"}
                onClick={() => void handleDiscover()}
                className="shrink-0 border border-upcycle-orange/30 bg-upcycle-orange/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange disabled:opacity-50"
              >
                {phase === "discovering" ? "Discovering…" : "Analyze"}
              </button>
            </div>
          </label>

          {error ? <p className="text-[11px] text-thermal-red">{error}</p> : null}

          {phase === "discovering" ? (
            <DiscoveryProgressView stepIndex={discoveryStepIndex} stats={liveStats} />
          ) : null}

          {discovery && phase === "preview" ? (
            <>
              <DiscoveryProgressView
                stepIndex={DISCOVERY_STEP_ORDER.length - 1}
                stats={{
                  contactsFound: discovery.contacts.length,
                  emailsFound: countEmailsFound(discovery),
                  pagesAnalyzed: discovery.pagesAnalyzed.length,
                }}
                complete
              />
              <CompanyOwnerSelect
                companies={companies}
                value={resolveOwnerById(accountOwnerId, companies) ?? defaultOwner}
                onChange={(owner) => setAccountOwnerId(owner.Id)}
                required
                label="Company Owner"
                compact
              />
              <PreviewPanel
                discovery={discovery}
                selectedContactIds={selectedContactIds}
                onToggleContact={toggleContact}
                onImport={() => void handleImport()}
              />
            </>
          ) : null}

          {phase === "importing" ? (
            <ImportProgressView progress={importProgress} />
          ) : null}

          {phase === "complete" && completion ? (
            <CompletionView
              completion={completion}
              insights={insights}
              onStartOver={reset}
            />
          ) : null}

          {toast ? (
            <div
              role="status"
              className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 border border-emerald-600/30 bg-emerald-700 px-4 py-2.5 text-[12px] font-semibold text-white shadow-lg"
            >
              {toast}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function WorkflowHero({ phase, error }: { phase: PanelPhase; error: string | null }) {
  const headline =
    phase === "discovering"
      ? "What is happening? Analyzing the website and building contact candidates."
      : phase === "importing"
        ? "What is happening? Importing the company — contacts only if you selected them."
        : phase === "complete"
          ? "What matters? Import finished — review results and open the company."
          : phase === "preview"
            ? "What should you do next? Import the company alone, or select contacts to include."
            : "What should you do next? Paste a company website URL to discover.";

  return (
    <div className="rounded-lg border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-2">
      <p className="text-[9px] font-bold uppercase tracking-wider text-upcycle-orange">
        Live workflow
      </p>
      <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/70">{headline}</p>
      {error ? null : (
        <p className="mt-1 text-[10px] text-carbon-blue/45">No silent imports. No hidden processing.</p>
      )}
    </div>
  );
}

function DiscoveryProgressView({
  stepIndex,
  stats,
  complete = false,
}: {
  stepIndex: number;
  stats: DiscoveryLiveStats;
  complete?: boolean;
}) {
  return (
    <div className="space-y-3 border border-carbon-blue/10 bg-white p-3">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
        Discovery {complete ? "Complete" : "In Progress"}
      </p>
      <ul className="space-y-1.5">
        {DISCOVERY_STEP_ORDER.map((stepId, index) => (
          <DiscoveryStepRow
            key={stepId}
            label={DISCOVERY_STEP_LABELS[stepId]}
            state={
              index < stepIndex || complete
                ? "done"
                : index === stepIndex
                  ? "active"
                  : "pending"
            }
          />
        ))}
      </ul>
      <dl className="grid grid-cols-3 gap-2 border-t border-carbon-blue/8 pt-2">
        <Stat label="Contacts Found" value={String(stats.contactsFound)} />
        <Stat label="Emails Found" value={String(stats.emailsFound)} />
        <Stat label="Pages Analyzed" value={String(stats.pagesAnalyzed)} />
      </dl>
    </div>
  );
}

function DiscoveryStepRow({
  label,
  state,
}: {
  label: string;
  state: "done" | "active" | "pending";
}) {
  const icon =
    state === "done" ? "✓" : state === "active" ? "⟳" : "○";
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

function ImportProgressView({ progress }: { progress: ImportProgressState }) {
  const companyOnly = progress.total === 0;
  const percent =
    progress.total > 0
      ? Math.round((progress.processed / progress.total) * 100)
      : progress.companyDone
        ? 100
        : 0;

  return (
    <div className="space-y-3 border border-upcycle-orange/20 bg-upcycle-orange/[0.03] p-3">
      <p className="text-[9px] font-semibold uppercase tracking-wider text-upcycle-orange">
        {companyOnly ? "Importing Company" : "Importing Company & Contacts"}
      </p>

      {progress.companyDone ? (
        <p className="text-[11px] font-medium text-emerald-700">
          Company {progress.companyCreated ? "Created" : "Updated"} ✓
        </p>
      ) : (
        <p className="text-[11px] text-carbon-blue/60">Updating company record…</p>
      )}

      {!companyOnly ? (
        <div>
          <div className="mb-1 flex justify-between text-[10px] text-carbon-blue/55">
            <span>Contacts Imported</span>
            <span>
              {progress.processed} / {progress.total}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-carbon-blue/10">
            <div
              className="h-full rounded-full bg-upcycle-orange transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="mt-1 text-[10px] tabular-nums text-carbon-blue/45">{percent}%</p>
        </div>
      ) : null}

      {progress.currentContact ? (
        <div className="rounded-md border border-carbon-blue/10 bg-white px-2.5 py-2">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Current Contact
          </p>
          <p className="mt-0.5 text-[12px] font-semibold text-carbon-blue">
            {progress.currentContact.name}
          </p>
          {progress.currentContact.jobTitle ? (
            <p className="text-[10px] text-carbon-blue/50">{progress.currentContact.jobTitle}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function CompletionView({
  completion,
  insights,
  onStartOver,
}: {
  completion: ImportCompletionSummary;
  insights: WebsiteDiscoveryInsights | null;
  onStartOver: () => void;
}) {
  return (
    <div className="space-y-3 border border-emerald-500/25 bg-emerald-500/[0.04] p-3">
      <p className="text-[11px] font-bold text-emerald-800">Import Complete</p>

      <dl className="grid gap-2 sm:grid-cols-2">
        <Stat
          label="Company"
          value={completion.companyCreated ? "Created" : "Updated"}
        />
        <Stat label="New Contacts" value={String(completion.newContacts)} />
        <Stat label="Updated Contacts" value={String(completion.updatedContacts)} />
        <Stat label="Skipped Contacts" value={String(completion.skippedContacts)} />
        <Stat label="Errors" value={String(completion.errors.length)} />
        <Stat label="Duration" value={formatDuration(completion.durationMs)} />
      </dl>

      {completion.errors.length > 0 ? (
        <ul className="space-y-1 text-[10px] text-thermal-red">
          {completion.errors.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      {insights ? (
        <div className="space-y-2 border-t border-carbon-blue/10 pt-2">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Intelligence
          </p>
          {insights.keyStakeholders.length > 0 ? (
            <InsightList title="Key stakeholders discovered" items={insights.keyStakeholders} />
          ) : null}
          {insights.decisionMakers.length > 0 ? (
            <InsightList
              title="Potential decision makers"
              items={insights.decisionMakers}
            />
          ) : null}
          <InsightList title="Relationship coverage" items={insights.coverageNotes} />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <Link
          href={company360Href(completion.company.CompanyID)}
          className="inline-flex border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white"
        >
          View Company
        </Link>
        <Link
          href={company360Href(completion.company.CompanyID, "contacts")}
          className="inline-flex border border-carbon-blue/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue hover:border-upcycle-orange/30"
        >
          View Imported Contacts
        </Link>
        <button
          type="button"
          onClick={onStartOver}
          className="inline-flex border border-carbon-blue/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60"
        >
          New Discovery
        </button>
      </div>
    </div>
  );
}

function PreviewPanel({
  discovery,
  selectedContactIds,
  onToggleContact,
  onImport,
}: {
  discovery: WebsiteDiscoveryResult;
  selectedContactIds: Set<string>;
  onToggleContact: (id: string) => void;
  onImport: () => void;
}) {
  return (
    <div className="space-y-3 border border-carbon-blue/10 bg-carbon-blue/[0.02] p-3">
      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Company Found
        </p>
        <p className="mt-1 text-sm font-semibold text-carbon-blue">
          {resolveDiscoveryCompanyName(
            discovery.company.name,
            discovery.company.domain || discovery.company.website,
          )}
        </p>
        {discovery.matchedCompanyId ? (
          <p className="mt-1 text-[10px] text-carbon-blue/50">
            Matches {discovery.matchedCompanyId}
            {discovery.matchedCompanyName ? ` · ${discovery.matchedCompanyName}` : ""} — import updates
            fields.
          </p>
        ) : (
          <p className="mt-1 text-[10px] text-carbon-blue/50">New company — import will create the record.</p>
        )}
      </div>

      <dl className="grid gap-2 sm:grid-cols-2">
        <PreviewField label="Main Phone" value={discovery.company.phone} />
        <PreviewField label="Main Email" value={discovery.company.email} />
        <PreviewField label="Website" value={discovery.company.website} />
        <PreviewField label="Address" value={discovery.company.address} className="sm:col-span-2" />
      </dl>

      <div>
        <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Contacts Found — optional; leave unchecked to import company only
        </p>
        {discovery.contacts.length > 0 ? (
          <ul className="mt-2 space-y-2">
            {discovery.contacts.map((contact) => (
              <li key={contact.id}>
                <label className="flex items-start gap-2 text-xs text-carbon-blue">
                  <input
                    type="checkbox"
                    checked={selectedContactIds.has(contact.id)}
                    onChange={() => onToggleContact(contact.id)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-semibold">{contact.name}</span>
                    {contact.jobTitle ? (
                      <span className="text-carbon-blue/55"> · {contact.jobTitle}</span>
                    ) : null}
                    {contact.email ? (
                      <span className="block text-[10px] text-carbon-blue/45">{contact.email}</span>
                    ) : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11px] text-carbon-blue/50">
            No named contacts found — you can still import the company.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={onImport}
        className="w-full border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white"
      >
        {selectedContactIds.size === 0
          ? "Import Company Only"
          : `Import Company & ${selectedContactIds.size} Contact${selectedContactIds.size === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}

function InsightList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-carbon-blue">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[10px] text-carbon-blue/60">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">{label}</dt>
      <dd className="mt-0.5 text-[12px] font-semibold tabular-nums text-carbon-blue">{value}</dd>
    </div>
  );
}

function PreviewField({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">{label}</dt>
      <dd className="mt-0.5 text-[11px] text-carbon-blue/75">{value.trim() ? value : "—"}</dd>
    </div>
  );
}
