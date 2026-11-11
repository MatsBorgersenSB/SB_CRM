"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import { canUploadSmartDocs } from "@/lib/permissions";
import type { Document360Snapshot } from "@/lib/document-360-data";
import type { PipelineRow } from "@/types/pipeline";
import { deal360Href, projectDocumentsHref } from "@/types/relationship-navigation";
import Link from "next/link";

/**
 * FS-006 Phase 2 — optional opportunity/project links on company-owned SmartDocs.
 * Ownership stays on the company; links only change where the file also appears.
 */
export function DocumentOptionalLinksPanel({
  snapshot,
  pipelines,
}: {
  snapshot: Document360Snapshot;
  pipelines: PipelineRow[];
}) {
  const { user } = useAuth();
  const router = useRouter();
  const record = snapshot.libraryRecord;
  const canEdit = canUploadSmartDocs(user.role) || user.role === "admin";

  const companyPipelines = useMemo(() => {
    const companyId = record?.OwnerCompanyId;
    if (!companyId) return [] as PipelineRow[];
    return pipelines.filter((deal) =>
      snapshot.companies.some(
        (company) =>
          company.CompanyID === companyId && company.pipelineIds.includes(deal.id),
      ),
    );
  }, [pipelines, record?.OwnerCompanyId, snapshot.companies]);

  const [dealId, setDealId] = useState(record?.LinkedDealId ?? "");
  const [projectId, setProjectId] = useState(record?.LinkedProjectId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!record || snapshot.businessContext.ownershipKind !== "company") {
    return null;
  }

  const save = async () => {
    if (!canEdit) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/smartdocs/${encodeURIComponent(record.SmartDocID)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            [AUTH_ROLE_HEADER]: user.role,
          },
          body: JSON.stringify({
            LinkedDealId: dealId.trim() || null,
            LinkedProjectId: projectId.trim() || null,
          }),
        },
      );
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error?.trim() || "Unable to save links");
      }
      setNotice("Links saved — ownership stays on the company.");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to save links");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 border border-carbon-blue/10 bg-carbon-blue/[0.02] px-4 py-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-carbon-blue/55">
          Also show on
        </p>
        <p className="mt-1 text-[13px] text-carbon-blue/60">
          Optional links — company still owns this file. No fake deals.
        </p>
      </div>

      <label className="flex flex-col gap-1 text-[13px] text-carbon-blue">
        <span className="font-semibold">Opportunity</span>
        <select
          value={dealId}
          disabled={!canEdit || saving}
          onChange={(event) => setDealId(event.target.value)}
          className="border border-carbon-blue/15 bg-white px-2 py-1.5"
        >
          <option value="">Not linked</option>
          {companyPipelines.map((deal) => (
            <option key={deal.id} value={deal.id}>
              {deal.assetName || deal.id}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-[13px] text-carbon-blue">
        <span className="font-semibold">Project code</span>
        <input
          value={projectId}
          disabled={!canEdit || saving}
          onChange={(event) => setProjectId(event.target.value)}
          placeholder="PRJ-…"
          className="border border-carbon-blue/15 bg-white px-2 py-1.5 font-mono text-[12px]"
        />
      </label>

      {dealId ? (
        <p className="text-[12px] text-carbon-blue/55">
          Opens on{" "}
          <Link href={deal360Href(dealId, "documents")} className="font-semibold text-upcycle-orange hover:underline">
            opportunity documents
          </Link>
        </p>
      ) : null}
      {projectId.trim() ? (
        <p className="text-[12px] text-carbon-blue/55">
          Opens on{" "}
          <Link
            href={projectDocumentsHref(projectId.trim())}
            className="font-semibold text-upcycle-orange hover:underline"
          >
            project documents
          </Link>
        </p>
      ) : null}

      {error ? <p className="text-[13px] text-red-600">{error}</p> : null}
      {notice ? <p className="text-[13px] text-emerald-700">{notice}</p> : null}

      {canEdit ? (
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="self-start border border-carbon-blue/20 bg-white px-3 py-1.5 text-[13px] font-semibold text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save links"}
        </button>
      ) : null}
    </div>
  );
}
