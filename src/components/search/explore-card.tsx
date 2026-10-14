"use client";

import { useMemo, useState } from "react";
import type {
  CompanyExploration,
  ExploreImportResult,
  ExploreResult,
  ExploreSource,
} from "@/lib/smartassist/explore/types";
import type { CompanyType } from "@/types/company-type";

type ExploreCardProps = {
  result: ExploreResult;
  explorationId: string | null;
  accountOwner: { Id: number; Title: string } | null;
  onAddWebsite: (url: string) => void;
  onImported: (result: ExploreImportResult) => void;
  onNavigate: (href: string) => void;
  busy: boolean;
};

const SOURCE_ICON: Record<ExploreSource["kind"], string> = {
  crm: "🏢",
  registry: "🏛",
  website: "🌐",
  internal: "📨",
};

function SourceChip({ source }: { source: ExploreSource }) {
  const body = (
    <>
      <span aria-hidden>{SOURCE_ICON[source.kind]}</span>
      <span>{source.label}</span>
    </>
  );
  const className =
    "inline-flex items-center gap-1 border px-1.5 py-0.5 text-[10px] transition-colors hover:border-upcycle-orange/40 hover:text-upcycle-orange";
  if (source.url) {
    return (
      <a
        href={source.url}
        target="_blank"
        rel="noreferrer"
        className={className}
        style={{ borderColor: "var(--command-border)", color: "var(--command-muted)" }}
      >
        {body}
      </a>
    );
  }
  return (
    <span className={className} style={{ borderColor: "var(--command-border)", color: "var(--command-muted)" }}>
      {body}
    </span>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <p className="text-[9px] font-semibold uppercase tracking-[0.16em]" style={{ color: "var(--command-muted)" }}>
      {children}
    </p>
  );
}

function sourceLabel(sources: ExploreSource[], id: string): string {
  return sources.find((s) => s.id === id)?.label ?? "";
}

function CompanyCard({
  result,
  explorationId,
  accountOwner,
  onAddWebsite,
  onImported,
  onNavigate,
  busy,
}: ExploreCardProps & { result: CompanyExploration }) {
  const [companyType, setCompanyType] = useState<CompanyType>(result.next.defaultType);
  const [selectedPeople, setSelectedPeople] = useState<Set<string>>(
    () => new Set(result.found.people.filter((p) => p.email || p.phone).map((p) => p.id)),
  );
  const [website, setWebsite] = useState("");
  const [importing, setImporting] = useState(false);
  const [imported, setImported] = useState<ExploreImportResult | null>(null);
  const [error, setError] = useState("");

  const peopleWithDetails = useMemo(
    () => result.found.people.filter((p) => p.email || p.phone).length,
    [result.found.people],
  );

  const togglePerson = (id: string) => {
    setSelectedPeople((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    setImporting(true);
    setError("");
    try {
      const response = await fetch("/api/smartassist/explore/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exploration: result,
          companyType,
          selectedPeopleIds: [...selectedPeople],
          accountOwner,
          explorationId,
        }),
      });
      const payload = (await response.json()) as { success: boolean; result?: ExploreImportResult; error?: string };
      if (!response.ok || !payload.success || !payload.result) {
        throw new Error(payload.error || "Import failed.");
      }
      setImported(payload.result);
      onImported(payload.result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Import failed.");
    } finally {
      setImporting(false);
    }
  };

  const registry = result.found.registry;
  const known = result.known.companies[0];

  return (
    <div className="space-y-4">
      <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--command-text)" }}>
        {result.summary}
      </p>

      {result.found.facts.length > 0 ? (
        <section>
          <SectionTitle>What we found</SectionTitle>
          <ul className="mt-1.5 space-y-1">
            {result.found.facts.map((fact, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px]" style={{ color: "var(--command-text)" }}>
                <span className="mt-[3px] size-1.5 shrink-0 rounded-full bg-upcycle-orange/70" aria-hidden />
                <span className="flex-1">
                  {fact.text}{" "}
                  <span className="text-[10px]" style={{ color: "var(--command-muted)" }}>
                    — {sourceLabel(result.sources, fact.sourceId)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.found.alternatives.length > 0 ? (
        <section>
          <SectionTitle>Could also be</SectionTitle>
          <ul className="mt-1.5 space-y-0.5 text-[11px]" style={{ color: "var(--command-muted)" }}>
            {result.found.alternatives.map((alt) => (
              <li key={alt.registrationNumber}>
                {alt.legalName} · {alt.registrationNumber}
                {alt.city ? ` · ${alt.city}` : ""}
                {alt.industryDescription ? ` · ${alt.industryDescription}` : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.found.people.length > 0 ? (
        <section>
          <SectionTitle>People</SectionTitle>
          <ul className="mt-1.5 space-y-1">
            {result.found.people.map((person) => {
              const checked = selectedPeople.has(person.id);
              const selectable = result.next.canImport && !imported;
              return (
                <li key={person.id}>
                  <label
                    className={`flex items-start gap-2 text-[12px] ${selectable ? "cursor-pointer" : ""}`}
                    style={{ color: "var(--command-text)" }}
                  >
                    {selectable ? (
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePerson(person.id)}
                        className="mt-0.5 accent-upcycle-orange"
                      />
                    ) : (
                      <span className="mt-[3px] size-1.5 shrink-0 rounded-full bg-carbon-blue/30" aria-hidden />
                    )}
                    <span className="flex-1">
                      <span className="font-medium">{person.name}</span>
                      {person.role ? <span style={{ color: "var(--command-muted)" }}> · {person.role}</span> : null}
                      <span className="block text-[10px]" style={{ color: "var(--command-muted)" }}>
                        {[person.email, person.phone].filter(Boolean).join(" · ") ||
                          `No contact details — ${sourceLabel(result.sources, person.sourceId)}`}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}

      {result.known.internal.length > 0 ? (
        <section>
          <SectionTitle>In our mail, files and Teams</SectionTitle>
          <ul className="mt-1.5 space-y-1">
            {result.known.internal.slice(0, 4).map((hit) => (
              <li key={hit.id} className="text-[11px]">
                <a
                  href={hit.webUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium hover:text-upcycle-orange"
                  style={{ color: "var(--command-text)" }}
                >
                  {hit.title}
                </a>
                <span className="block line-clamp-1" style={{ color: "var(--command-muted)" }}>
                  {hit.snippet}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {result.unknown.length > 0 ? (
        <section>
          <SectionTitle>{"What we don't know"}</SectionTitle>
          <ul className="mt-1.5 space-y-1">
            {result.unknown.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-[12px]" style={{ color: "var(--command-muted)" }}>
                <span className="mt-[3px] size-1.5 shrink-0 rounded-full border border-current" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section
        className="border-t pt-3"
        style={{ borderColor: "var(--command-border)" }}
      >
        <SectionTitle>Next</SectionTitle>

        {imported ? (
          <p className="mt-1.5 text-[12px]" style={{ color: "var(--command-text)" }}>
            {imported.created ? "Added to SmartCRM" : "Already in SmartCRM — linked"} as {companyType}
            {imported.peopleImported > 0
              ? ` with ${imported.peopleImported} ${imported.peopleImported === 1 ? "person" : "people"}`
              : ""}
            .{" "}
            <button
              type="button"
              onClick={() => onNavigate(imported.href)}
              className="font-semibold text-upcycle-orange hover:underline"
            >
              Open the company →
            </button>
          </p>
        ) : known ? (
          <p className="mt-1.5 text-[12px]" style={{ color: "var(--command-text)" }}>
            <button
              type="button"
              onClick={() => onNavigate(known.href)}
              className="font-semibold text-upcycle-orange hover:underline"
            >
              Open {known.name} in SmartCRM →
            </button>
          </p>
        ) : result.next.canImport ? (
          <div className="mt-2 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-[10px]" style={{ color: "var(--command-muted)" }}>
              What kind of relationship is this?
              <select
                value={companyType}
                onChange={(event) => setCompanyType(event.target.value as CompanyType)}
                className="border bg-transparent px-2 py-1.5 text-[12px] outline-none"
                style={{ borderColor: "var(--command-border)", color: "var(--command-text)" }}
              >
                {result.next.typeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={importing || busy}
              onClick={() => void handleImport()}
              className="border border-upcycle-orange/30 bg-upcycle-orange px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40"
            >
              {importing
                ? "Adding…"
                : `Add ${registry ? "company" : result.subject}${
                    selectedPeople.size > 0 ? ` + ${selectedPeople.size} ${selectedPeople.size === 1 ? "person" : "people"}` : ""
                  }`}
            </button>
            {peopleWithDetails === 0 && result.found.people.length > 0 ? (
              <span className="text-[10px]" style={{ color: "var(--command-muted)" }}>
                People without contact details are unticked; tick to import them anyway.
              </span>
            ) : null}
          </div>
        ) : (
          <p className="mt-1.5 text-[12px]" style={{ color: "var(--command-muted)" }}>
            Nothing confirmed enough to import yet.
          </p>
        )}

        {!result.found.website && !imported ? (
          <form
            className="mt-3 flex items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (website.trim()) onAddWebsite(website.trim());
            }}
          >
            <input
              type="text"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="Know their website? Paste it and I'll read it"
              className="min-w-0 flex-1 border bg-transparent px-2 py-1.5 text-[12px] outline-none placeholder:opacity-50"
              style={{ borderColor: "var(--command-border)", color: "var(--command-text)" }}
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !website.trim()}
              className="border px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-40"
              style={{ borderColor: "var(--command-border)", color: "var(--command-text)" }}
            >
              Read it
            </button>
          </form>
        ) : null}

        {error ? <p className="mt-2 text-[11px] text-orange-700">{error}</p> : null}
      </section>

      {result.sources.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[10px]" style={{ color: "var(--command-muted)" }}>
            Sources
          </span>
          {result.sources.map((source) => (
            <SourceChip key={source.id} source={source} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function UnsupportedCard({ result }: { result: Exclude<ExploreResult, CompanyExploration> }) {
  return (
    <div className="space-y-4">
      <p className="text-sm font-medium leading-relaxed" style={{ color: "var(--command-text)" }}>
        {result.summary}
      </p>
      {result.known.internal.length > 0 ? (
        <section>
          <SectionTitle>In our mail, files and Teams</SectionTitle>
          <ul className="mt-1.5 space-y-1">
            {result.known.internal.slice(0, 5).map((hit) => (
              <li key={hit.id} className="text-[11px]">
                <a
                  href={hit.webUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium hover:text-upcycle-orange"
                  style={{ color: "var(--command-text)" }}
                >
                  {hit.title}
                </a>
                <span className="block line-clamp-1" style={{ color: "var(--command-muted)" }}>
                  {hit.snippet}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section>
        <SectionTitle>{"What we don't know"}</SectionTitle>
        <ul className="mt-1.5 space-y-1">
          {result.unknown.map((item, i) => (
            <li key={i} className="text-[12px]" style={{ color: "var(--command-muted)" }}>
              {item}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** One card: what we know, what we found, what we don't, what next. */
export function ExploreCard(props: ExploreCardProps) {
  if (props.result.kind === "company") {
    return <CompanyCard {...props} result={props.result} />;
  }
  return <UnsupportedCard result={props.result} />;
}
