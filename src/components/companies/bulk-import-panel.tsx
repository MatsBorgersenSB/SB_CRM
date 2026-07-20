"use client";

import Link from "next/link";
import { useState } from "react";
import { splitBulkImportBlocks } from "@/lib/discovery/bulk-import";
import { formatDuration } from "@/lib/discovery/quick-import-workflow";
import type { QuickImportPreview, QuickImportResult } from "@/lib/discovery/quick-import";
import type { Company } from "@/types/company";
import { company360Href } from "@/types/company-360";
import { canCreateCompany } from "@/lib/permissions";
import type { UserRole } from "@/types/auth";
import { authUserToAccountOwner, resolveOwnerById } from "@/lib/company-owner";
import { CompanyOwnerSelect } from "@/components/companies/company-owner-select";
import { useAuth } from "@/context/auth-context";

type BulkImportPanelProps = {
  role: UserRole;
  onImported: (company: Company) => void;
  embedded?: boolean;
  companies?: Company[];
};

type BulkEntry = {
  id: string;
  rawText: string;
  preview: QuickImportPreview | null;
  error: string | null;
};

type PanelPhase = "idle" | "analyzing" | "preview" | "importing" | "complete";

export function BulkImportPanel({
  role,
  onImported,
  embedded = false,
  companies = [],
}: BulkImportPanelProps) {
  const { user } = useAuth();
  const defaultOwner = authUserToAccountOwner(user);
  const [text, setText] = useState("");
  const [phase, setPhase] = useState<PanelPhase>("idle");
  const [entries, setEntries] = useState<BulkEntry[]>([]);
  const [progress, setProgress] = useState({ done: 0, total: 0, current: "" });
  const [results, setResults] = useState<QuickImportResult[]>([]);
  const [durationMs, setDurationMs] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [accountOwnerId, setAccountOwnerId] = useState(defaultOwner.Id);

  if (!canCreateCompany(role)) return null;

  const reset = () => {
    setPhase("idle");
    setEntries([]);
    setProgress({ done: 0, total: 0, current: "" });
    setResults([]);
    setDurationMs(0);
    setError(null);
  };

  const handleAnalyze = async () => {
    const blocks = splitBulkImportBlocks(text);
    if (blocks.length === 0) return;

    setPhase("analyzing");
    setError(null);
    const analyzed: BulkEntry[] = [];

    for (let index = 0; index < blocks.length; index++) {
      const rawText = blocks[index]!;
      try {
        const response = await fetch("/api/discovery/quick-import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: rawText }),
        });
        const body = (await response.json()) as QuickImportPreview | { error?: string };
        if (!response.ok) {
          throw new Error("error" in body && body.error ? body.error : "Analysis failed");
        }
        analyzed.push({ id: `bulk-${index}`, rawText, preview: body as QuickImportPreview, error: null });
      } catch (analyzeError) {
        analyzed.push({
          id: `bulk-${index}`,
          rawText,
          preview: null,
          error: analyzeError instanceof Error ? analyzeError.message : "Analysis failed",
        });
      }
    }

    setEntries(analyzed);
    setPhase("preview");
  };

  const handleImport = async () => {
    const importable = entries.filter((entry) => entry.preview);
    if (importable.length === 0) return;

    const startedAt = Date.now();
    setPhase("importing");
    setProgress({ done: 0, total: importable.length, current: "" });
    const imported: QuickImportResult[] = [];

    for (let index = 0; index < importable.length; index++) {
      const entry = importable[index]!;
      const name = entry.preview!.extracted.companyName || entry.preview!.extracted.contactName || "Record";
      setProgress({ done: index, total: importable.length, current: name });

      try {
        const accountOwner = resolveOwnerById(accountOwnerId, companies) ?? defaultOwner;
        const response = await fetch("/api/discovery/quick-import/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ preview: entry.preview, accountOwner }),
        });
        const body = (await response.json()) as QuickImportResult | { error?: string };
        if (!response.ok) {
          throw new Error("error" in body && body.error ? body.error : "Import failed");
        }
        const result = body as QuickImportResult;
        imported.push(result);
        onImported(result.company);
      } catch (importError) {
        setError(importError instanceof Error ? importError.message : "Import failed");
      }

      setProgress({ done: index + 1, total: importable.length, current: name });
    }

    setResults(imported);
    setDurationMs(Date.now() - startedAt);
    setPhase("complete");
  };

  const busy = phase === "analyzing" || phase === "importing";

  return (
    <section className="border border-carbon-blue/15 bg-white">
      {embedded ? null : (
        <div className="border-b border-carbon-blue/10 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Bulk Import
          </p>
        </div>
      )}

      <div className="space-y-3 p-3">
        <p className="text-[11px] text-carbon-blue/55">
          Paste multiple company blocks separated by a blank line. Each block is parsed and imported
          with visible progress — no silent imports.
        </p>

        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={busy || phase === "complete"}
          rows={10}
          placeholder={`SmartGAS Mikrosensorik GmbH\nHuenderstraße 1\n74080 Heilbronn\n\njulian.tessarzik@smartgas.eu\nhttps://www.smartgas.eu\n\n--- next company below ---`}
          className="w-full resize-y border border-carbon-blue/15 px-2.5 py-2 text-xs leading-relaxed text-carbon-blue outline-none focus:border-upcycle-orange"
        />

        {phase === "idle" || phase === "analyzing" ? (
          <button
            type="button"
            disabled={!text.trim() || busy}
            onClick={() => void handleAnalyze()}
            className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange disabled:opacity-50"
          >
            {phase === "analyzing" ? "Analyzing…" : "Analyze Blocks"}
          </button>
        ) : null}

        {entries.length > 0 && (phase === "preview" || phase === "importing" || phase === "complete") ? (
          <div className="space-y-2 border border-carbon-blue/10 p-2">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              {entries.length} block{entries.length === 1 ? "" : "s"} detected
            </p>
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-2 text-[10px]">
                  <span className="truncate font-medium text-carbon-blue">
                    {entry.preview?.extracted.companyName ||
                      entry.preview?.extracted.contactName ||
                      entry.rawText.split("\n")[0]}
                  </span>
                  <span className={entry.error ? "text-thermal-red" : "text-carbon-blue/45"}>
                    {entry.error
                      ? entry.error
                      : entry.preview?.company.action === "create"
                        ? "Create"
                        : "Update"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {phase === "importing" ? (
          <div className="space-y-1 border border-upcycle-orange/20 bg-upcycle-orange/[0.03] p-2">
            <p className="text-[10px] font-semibold text-upcycle-orange">
              Importing {progress.done} / {progress.total}
            </p>
            {progress.current ? (
              <p className="text-[10px] text-carbon-blue/55">Current: {progress.current}</p>
            ) : null}
            <div className="h-1.5 overflow-hidden rounded-full bg-carbon-blue/10">
              <div
                className="h-full bg-upcycle-orange transition-all"
                style={{
                  width: `${progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0}%`,
                }}
              />
            </div>
          </div>
        ) : null}

        {phase === "preview" ? (
          <div className="space-y-3">
            <CompanyOwnerSelect
              companies={companies}
              value={resolveOwnerById(accountOwnerId, companies) ?? defaultOwner}
              onChange={(owner) => setAccountOwnerId(owner.Id)}
              required
              label="Company Owner"
              compact
            />
            <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void handleImport()}
              className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white"
            >
              Import All
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

        {phase === "complete" ? (
          <div className="space-y-2 border border-emerald-500/25 bg-emerald-500/[0.04] p-3">
            <p className="text-[11px] font-bold text-emerald-800">Bulk Import Complete</p>
            <p className="text-[10px] text-carbon-blue/60">
              {results.length} record{results.length === 1 ? "" : "s"} processed in{" "}
              {formatDuration(durationMs)}
            </p>
            {error ? <p className="text-[10px] text-thermal-red">{error}</p> : null}
            <div className="flex flex-wrap gap-2">
              {results[0] ? (
                <Link
                  href={company360Href(results[0].company.CompanyID)}
                  className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-white"
                >
                  View Latest Company
                </Link>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setText("");
                  reset();
                }}
                className="border border-carbon-blue/15 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60"
              >
                New Bulk Import
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
