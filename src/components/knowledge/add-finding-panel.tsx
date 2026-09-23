"use client";

import { useState } from "react";
import { useAuth } from "@/context/auth-context";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import { canUploadSmartDocs } from "@/lib/permissions";
import {
  appendSourceFinding,
  applySourceFindingDecision,
  createSourceFinding,
  extractFirstUrl,
  previewFromNote,
  type SourceFinding,
  type SourceFindingClaim,
  type SourceFindingDecision,
  type SourceFindingPreview,
} from "@/lib/source-findings";

export function AddFindingPanel({
  targetLabel,
  findings,
  onFindingsChange,
}: {
  /** e.g. "this opportunity" / "this company" */
  targetLabel: string;
  findings: SourceFinding[];
  onFindingsChange: (next: SourceFinding[]) => Promise<void>;
}) {
  const { user } = useAuth();
  const canAdd = canUploadSmartDocs(user.role) || user.role === "admin";
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [claimBusy, setClaimBusy] = useState<string | null>(null);

  const add = async () => {
    const raw = draft.trim();
    if (!raw || busy) return;
    setBusy(true);
    setError(null);
    try {
      const url = extractFirstUrl(raw);
      const leftover = url ? raw.replace(url, "").trim() : raw;
      let preview: SourceFindingPreview;
      if (url) {
        const response = await fetch("/api/findings/read", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [AUTH_ROLE_HEADER]: user.role,
          },
          body: JSON.stringify({ url }),
        });
        const payload = (await response.json().catch(() => null)) as
          | (SourceFindingPreview & { error?: string })
          | null;
        if (!response.ok) {
          throw new Error(payload?.error || "Could not read that URL");
        }
        preview = {
          title: payload?.title?.trim() || hostname(url),
          claims: Array.isArray(payload?.claims) ? payload.claims : [],
        };
        if (leftover) {
          preview.claims = [
            ...preview.claims,
            ...previewFromNote(leftover).claims.map((claim) => ({
              ...claim,
              id: "your-note",
            })),
          ];
        }
      } else {
        preview = previewFromNote(raw);
      }

      const finding = createSourceFinding({
        title: preview.title,
        url: url ?? undefined,
        note: leftover || (!url ? raw : undefined),
        claims: preview.claims,
      });
      await onFindingsChange(appendSourceFinding(findings, finding));
      setDraft("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not add finding");
    } finally {
      setBusy(false);
    }
  };

  const decide = async (
    findingId: string,
    claim: SourceFindingClaim,
    decision: SourceFindingDecision,
  ) => {
    setClaimBusy(claim.id);
    setError(null);
    const next = applySourceFindingDecision(findings, findingId, claim.id, decision);
    try {
      await onFindingsChange(next);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save");
    } finally {
      setClaimBusy(null);
    }
  };

  return (
    <section
      id="add-finding"
      aria-labelledby="add-finding-title"
      className="rounded-lg border-2 border-upcycle-orange/55 bg-upcycle-orange/[0.06] px-4 py-4 shadow-sm dark:bg-upcycle-orange/10"
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-upcycle-orange">
        Add knowledge here
      </p>
      <h2
        id="add-finding-title"
        className="mt-1 text-[18px] font-semibold tracking-tight text-carbon-blue"
      >
        Add a finding
      </h2>
      <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-carbon-blue/70">
        Paste a public URL or write what you learned. This is the place findings go on{" "}
        <span className="font-semibold text-carbon-blue">{targetLabel}</span>. SmartAssist
        proposes facts. You confirm. Nothing is invented.
      </p>

      {canAdd ? (
        <div className="mt-3">
          <label htmlFor="finding-input" className="sr-only">
            Paste a URL or write a finding
          </label>
          <textarea
            id="finding-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={3}
            placeholder="Paste a URL here, or write what you know — e.g. https://byggeprosjekter.bygg.no/…"
            className="w-full resize-y rounded-md border border-upcycle-orange/35 bg-white px-3 py-2.5 text-[14px] text-carbon-blue shadow-inner outline-none ring-upcycle-orange/30 placeholder:text-carbon-blue/35 focus:border-upcycle-orange focus:ring-2"
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                void add();
              }
            }}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void add()}
              disabled={busy || !draft.trim()}
              className="inline-flex rounded-md bg-upcycle-orange px-3.5 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-upcycle-orange/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Reading…" : `Add to ${targetLabel}`}
            </button>
            <span className="text-[12px] text-carbon-blue/50">
              Ctrl+Enter to add · Confirm each fact after it appears
            </span>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-[13px] text-carbon-blue/60">
          You can read findings here. A commercial or engineering user adds them.
        </p>
      )}

      {error ? (
        <p className="mt-2 text-[12px] font-medium text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {findings.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {findings.map((finding) => (
            <li
              key={finding.id}
              className="rounded-md border border-carbon-blue/10 bg-white px-3 py-3 dark:bg-slate-950"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/45">
                From the market
              </p>
              <p className="mt-1 text-[14px] font-semibold text-carbon-blue">
                {finding.title}
              </p>
              {finding.url ? (
                <a
                  href={finding.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 inline-block break-all text-[12px] font-medium text-upcycle-orange hover:underline"
                >
                  {finding.url}
                </a>
              ) : null}
              <ul className="mt-2 space-y-2">
                {finding.claims
                  .filter((row) => row.decision !== "dismissed")
                  .map((claim) => (
                    <li key={claim.id} className="border-t border-carbon-blue/8 pt-2">
                      <p className="text-[13px] leading-snug text-carbon-blue">
                        {claim.statement}
                      </p>
                      <p className="mt-0.5 text-[12px] text-carbon-blue/55">{claim.impact}</p>
                      {claim.decision === "confirmed" ? (
                        <p className="mt-1 text-[11px] font-semibold text-emerald-700">
                          Confirmed on {targetLabel}
                        </p>
                      ) : canAdd ? (
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={claimBusy === claim.id}
                            onClick={() => void decide(finding.id, claim, "confirmed")}
                            className="rounded-md bg-upcycle-orange/12 px-2.5 py-1 text-[11px] font-semibold text-upcycle-orange hover:bg-upcycle-orange/18 disabled:opacity-50"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            disabled={claimBusy === claim.id}
                            onClick={() => void decide(finding.id, claim, "dismissed")}
                            className="rounded-md px-2.5 py-1 text-[11px] font-medium text-carbon-blue/55 hover:bg-carbon-blue/5 disabled:opacity-50"
                          >
                            Not this
                          </button>
                        </div>
                      ) : null}
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[12px] text-carbon-blue/45">
          Nothing added yet. Paste the article or note above — that is how this record learns.
        </p>
      )}
    </section>
  );
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Public source";
  }
}
