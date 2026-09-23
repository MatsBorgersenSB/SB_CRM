"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import {
  applyDocumentKnowledgeDecision,
  buildCompanyDocumentKnowledge,
  type CompanyDocumentKnowledgeState,
  type DocumentKnowledgeClaim,
  type DocumentKnowledgeDecision,
} from "@/lib/company-document-knowledge";
import { canUploadSmartDocs } from "@/lib/permissions";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";
import { company360Href } from "@/types/company-360";

function ClaimRow({
  claim,
  confirmed,
  canConfirm,
  canDismiss,
  busy,
  onDecide,
}: {
  claim: DocumentKnowledgeClaim;
  confirmed: boolean;
  canConfirm: boolean;
  canDismiss: boolean;
  busy: boolean;
  onDecide: (decision: DocumentKnowledgeDecision) => void;
}) {
  return (
    <li className="border-t border-carbon-blue/8 py-2.5 first:border-t-0 first:pt-0">
      <p className="text-[13px] leading-snug text-carbon-blue">
        {confirmed ? (
          <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45">
            Confirmed
          </span>
        ) : claim.confidence === "moderate" ? (
          <span className="mr-1.5 text-[10px] font-semibold uppercase tracking-wider text-upcycle-orange/80">
            Assumed
          </span>
        ) : null}
        {claim.statement}
      </p>
      <p className="mt-0.5 text-[12px] leading-relaxed text-carbon-blue/55">{claim.impact}</p>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
        {claim.sources.map((source) => (
          <Link
            key={source.id}
            href={source.href}
            className="font-medium text-upcycle-orange hover:underline"
          >
            {source.name}
          </Link>
        ))}
      </p>
      {canConfirm || canDismiss ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {canConfirm ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide("confirmed")}
              className="inline-flex h-7 items-center border border-upcycle-orange/30 bg-upcycle-orange px-2.5 text-[11px] font-semibold text-white hover:bg-upcycle-orange/90 disabled:opacity-50"
            >
              Confirm
            </button>
          ) : null}
          {canDismiss ? (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDecide("dismissed")}
              className="inline-flex h-7 items-center border border-carbon-blue/15 px-2.5 text-[11px] font-semibold text-carbon-blue/70 hover:border-upcycle-orange hover:text-upcycle-orange disabled:opacity-50"
            >
              Not now
            </button>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

export function CompanyDocumentKnowledgePanel({
  companyId,
  documents,
  initialState,
}: {
  companyId: string;
  documents: SmartDocLibraryRecord[];
  initialState: CompanyDocumentKnowledgeState;
}) {
  const { user } = useAuth();
  const canDecide = canUploadSmartDocs(user.role);
  const [state, setState] = useState(initialState);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const snapshot = useMemo(
    () => buildCompanyDocumentKnowledge(companyId, documents, state),
    [companyId, documents, state],
  );

  if (snapshot.documentCount === 0 && snapshot.facts.length === 0) {
    return (
      <p className="px-1 text-[12px] text-carbon-blue/50">
        No documents on file yet.{" "}
        <Link
          href={company360Href(companyId, "documents")}
          className="font-semibold text-upcycle-orange hover:underline"
        >
          Add a document
        </Link>{" "}
        so SmartAssist can turn it into company knowledge.
      </p>
    );
  }

  const decide = async (claimId: string, decision: DocumentKnowledgeDecision) => {
    setBusyId(claimId);
    setError(null);
    const optimistic = applyDocumentKnowledgeDecision(state, claimId, decision);
    setState(optimistic);
    try {
      const response = await fetch(
        `/api/companies/${encodeURIComponent(companyId)}/document-knowledge`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            [AUTH_ROLE_HEADER]: user.role,
          },
          body: JSON.stringify({ claimId, decision }),
        },
      );
      if (!response.ok) {
        throw new Error("Could not save that decision.");
      }
      const payload = (await response.json()) as { state?: CompanyDocumentKnowledgeState };
      if (payload.state) setState(payload.state);
    } catch (caught) {
      setState(state);
      setError(caught instanceof Error ? caught.message : "Could not save that decision.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section id="document-knowledge" className="dashboard-card overflow-hidden">
      <div className="px-6 py-5">
        <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/40">
          From documents
        </p>
        <p className="mt-1 text-[12px] text-carbon-blue/50">
          From the names and types of files on this company — not a full read of every PDF yet.
          Nothing is written onto the company until you confirm.
        </p>

        {snapshot.facts.length > 0 ? (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/45">
              What we know
            </p>
            <ul className="mt-1">
              {snapshot.facts.map((claim) => (
                <ClaimRow
                  key={claim.id}
                  claim={claim}
                  confirmed={Boolean(state.confirmed[claim.id])}
                  canConfirm={canDecide && !state.confirmed[claim.id]}
                  canDismiss={canDecide && !state.confirmed[claim.id]}
                  busy={busyId === claim.id}
                  onDecide={(decision) => void decide(claim.id, decision)}
                />
              ))}
            </ul>
          </div>
        ) : null}

        {snapshot.unknowns.length > 0 ? (
          <div className="mt-4">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/45">
              What we don&apos;t know
            </p>
            <ul className="mt-1">
              {snapshot.unknowns.map((claim) => (
                <ClaimRow
                  key={claim.id}
                  claim={claim}
                  confirmed={false}
                  canConfirm={false}
                  canDismiss={canDecide}
                  busy={busyId === claim.id}
                  onDecide={(decision) => void decide(claim.id, decision)}
                />
              ))}
            </ul>
          </div>
        ) : null}

        {snapshot.nextAction ? (
          <div className="mt-4 border-l-2 border-upcycle-orange/50 pl-3">
            <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/40">
              Next
            </p>
            <Link
              href={snapshot.nextAction.href}
              className="mt-0.5 block text-[14px] font-semibold text-carbon-blue hover:text-upcycle-orange"
            >
              {snapshot.nextAction.label}
            </Link>
            <p className="mt-0.5 text-[12px] leading-relaxed text-carbon-blue/55">
              {snapshot.nextAction.reason}
            </p>
          </div>
        ) : null}

        {snapshot.facts.length === 0 && snapshot.unknowns.length === 0 ? (
          <p className="mt-3 text-[12px] text-carbon-blue/50">
            {snapshot.documentCount} document{snapshot.documentCount === 1 ? "" : "s"} on
            file.{" "}
            <Link
              href={company360Href(companyId, "documents")}
              className="font-semibold text-upcycle-orange hover:underline"
            >
              Open documents
            </Link>
          </p>
        ) : null}

        {error ? <p className="mt-3 text-[12px] text-red-700">{error}</p> : null}
      </div>
    </section>
  );
}
