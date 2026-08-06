"use client";

import { useCallback, useEffect, useState } from "react";
import { copyTextToClipboard } from "@/lib/compose-actions";
import type {
  ContractAuditResult,
  ContractRiskScore,
} from "@/lib/assistant/contract-auditor";

const RISK_STYLES: Record<ContractRiskScore, string> = {
  LOW: "border-emerald-600/25 bg-emerald-50 text-emerald-800",
  MEDIUM: "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange",
  HIGH: "border-thermal-red/30 bg-thermal-red/5 text-thermal-red",
  CRITICAL: "border-thermal-red/50 bg-thermal-red/15 text-thermal-red",
};

const RISK_METER: Record<ContractRiskScore, number> = {
  LOW: 25,
  MEDIUM: 50,
  HIGH: 75,
  CRITICAL: 100,
};

type ContractAuditPanelProps = {
  documentId?: string;
  documentType?: string;
  companyId?: string;
  opportunityId?: string;
  className?: string;
};

export function ContractAuditPanel({
  documentId,
  documentType,
  companyId,
  opportunityId,
  className = "",
}: ContractAuditPanelProps) {
  const [rawText, setRawText] = useState("");
  const [audit, setAudit] = useState<ContractAuditResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingPrior, setLoadingPrior] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const loadPrior = useCallback(async () => {
    if (!documentId && !opportunityId) {
      setLoadingPrior(false);
      return;
    }
    setLoadingPrior(true);
    try {
      const params = new URLSearchParams();
      if (documentId) params.set("documentId", documentId);
      if (opportunityId) params.set("opportunityId", opportunityId);
      const response = await fetch(
        `/api/assistant/audit-contract?${params.toString()}`,
      );
      const body = (await response.json()) as {
        audit?: ContractAuditResult | null;
        error?: string;
      };
      if (response.ok && body.audit) {
        setAudit(body.audit);
      }
    } catch {
      // no prior audit — fine
    } finally {
      setLoadingPrior(false);
    }
  }, [documentId, opportunityId]);

  useEffect(() => {
    void loadPrior();
  }, [loadPrior]);

  const runAudit = async () => {
    if (!rawText.trim()) {
      setError("Paste contract text to run the audit.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/assistant/audit-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentId,
          rawText,
          documentType,
          companyId,
          opportunityId,
          persist: true,
        }),
      });
      const body = (await response.json()) as {
        audit?: ContractAuditResult;
        error?: string;
      };
      if (!response.ok || !body.audit) {
        setError(body.error ?? "Audit failed");
        return;
      }
      setAudit(body.audit);
    } catch {
      setError("Contract audit unavailable");
    } finally {
      setLoading(false);
    }
  };

  const copyClause = async (id: string, clause: string) => {
    const ok = await copyTextToClipboard(clause);
    if (ok) {
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 1600);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Contract Audit & Compliance
          </p>
          <p className="text-[13px] font-semibold text-carbon-blue">
            {documentType?.trim() || "Legal document review"}
          </p>
          <p className="mt-0.5 text-[11px] text-carbon-blue/50">
            Paste clause text for a Reality-First compliance scan (GDPR/DPA,
            liability, payment, termination).
          </p>
        </div>
        {audit ? (
          <span
            className={`border px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider ${RISK_STYLES[audit.overallRiskScore]}`}
          >
            Risk {audit.overallRiskScore}
          </span>
        ) : null}
      </div>

      <label className="block">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
          Contract text
        </span>
        <textarea
          value={rawText}
          onChange={(event) => setRawText(event.target.value)}
          rows={6}
          placeholder="Paste NDA, MSA, DPA, or contract clauses here…"
          className="mt-1.5 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue outline-none focus:border-upcycle-orange"
        />
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void runAudit()}
          disabled={loading}
          className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-3 py-1.5 text-[11px] font-semibold text-upcycle-orange hover:bg-upcycle-orange/15 disabled:opacity-50"
        >
          {loading ? "Auditing…" : "Run Compliance Audit"}
        </button>
      </div>

      {error ? <p className="text-[11px] text-thermal-red">{error}</p> : null}
      {loadingPrior ? (
        <p className="text-[11px] text-carbon-blue/45">Loading prior audit…</p>
      ) : null}

      {audit ? (
        <>
          <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-3">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Risk meter
            </p>
            <div className="mt-2 h-2 w-full overflow-hidden bg-carbon-blue/8">
              <div
                className={`h-full transition-all ${
                  audit.overallRiskScore === "LOW"
                    ? "bg-emerald-600"
                    : audit.overallRiskScore === "MEDIUM"
                      ? "bg-upcycle-orange"
                      : "bg-thermal-red"
                }`}
                style={{ width: `${RISK_METER[audit.overallRiskScore]}%` }}
              />
            </div>
            <p className="mt-2 text-[12px] leading-relaxed text-carbon-blue/75">
              {audit.summary}
            </p>
          </div>

          {audit.redFlags.length > 0 ? (
            <div className="border border-thermal-red/25 bg-thermal-red/5 p-3">
              <p className="text-[9px] font-semibold uppercase tracking-wider text-thermal-red">
                Red flags — legal review
              </p>
              <ul className="mt-2 space-y-1.5">
                {audit.redFlags.map((flag) => (
                  <li
                    key={flag}
                    className="text-[11px] leading-relaxed text-thermal-red/90"
                  >
                    ⚠ {flag}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Compliance checklist
            </p>
            <ul className="divide-y divide-carbon-blue/8 border border-carbon-blue/10">
              {audit.complianceChecklist.map((item) => (
                <li
                  key={item.rule}
                  className="flex items-start gap-3 px-3 py-2.5"
                >
                  <span
                    className={`mt-0.5 shrink-0 text-[10px] font-semibold uppercase tracking-wider ${
                      item.passed ? "text-emerald-700" : "text-thermal-red"
                    }`}
                  >
                    {item.passed ? "Pass" : "Fail"}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-carbon-blue">
                      {item.rule}
                    </p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-carbon-blue/60">
                      {item.details}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {audit.suggestedRemediations.length > 0 ? (
            <div>
              <p className="mb-2 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                Suggested remediations
              </p>
              <ul className="space-y-2">
                {audit.suggestedRemediations.map((item) => (
                  <li
                    key={item.id}
                    className="border border-carbon-blue/10 bg-[var(--dashboard-surface)] p-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-[12px] font-semibold text-carbon-blue">
                        {item.title}
                      </p>
                      <button
                        type="button"
                        onClick={() => void copyClause(item.id, item.clause)}
                        className="border border-upcycle-orange/30 bg-upcycle-orange/10 px-2 py-1 text-[10px] font-semibold text-upcycle-orange hover:bg-upcycle-orange/15"
                      >
                        {copiedId === item.id
                          ? "Copied"
                          : "Copy Remediation Clause"}
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-carbon-blue/55">
                      {item.talkingPoint}
                    </p>
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap border border-carbon-blue/8 bg-carbon-blue/[0.02] p-2 text-[11px] leading-relaxed text-carbon-blue/70">
                      {item.clause}
                    </pre>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
