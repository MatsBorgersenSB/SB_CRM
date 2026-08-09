"use client";

import { useState } from "react";
import { OpportunityOfferingsPicker } from "@/components/opportunity/opportunity-offerings-picker";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import { buildSmartCrmUrl } from "@/lib/m365/outlook-context";
import type { UserRole } from "@/types/auth";
import { COMPANY_ROLES, type CompanyRole } from "@/types/pipeline";
import { deal360Href } from "@/types/relationship-navigation";

type OutlookAddOpportunityDialogProps = {
  open: boolean;
  companyId: string;
  companyName: string;
  suggestedTitle?: string;
  role?: UserRole;
  onClose: () => void;
  onCreated?: (result: { dealId: string; title: string }) => void;
};

export function OutlookAddOpportunityDialog({
  open,
  companyId,
  companyName,
  suggestedTitle = "",
  role = "superuser",
  onClose,
  onCreated,
}: OutlookAddOpportunityDialogProps) {
  const [title, setTitle] = useState(suggestedTitle);
  const [companyRole, setCompanyRole] = useState<CompanyRole>("Technology Buyer");
  const [offeringIds, setOfferingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdDealId, setCreatedDealId] = useState<string | null>(null);

  if (!open) return null;

  const canSubmit = title.trim().length > 0 && offeringIds.length > 0 && !loading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/m365/outlook/add-opportunity", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [AUTH_ROLE_HEADER]: role,
        },
        body: JSON.stringify({
          companyId,
          title: title.trim(),
          companyRole,
          offeringIds,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        detail?: string;
        dealId?: string;
        title?: string;
      };
      if (!response.ok) {
        throw new Error(payload.detail || payload.error || "Unable to create opportunity");
      }
      const dealId = payload.dealId ?? "";
      setCreatedDealId(dealId || null);
      onCreated?.({ dealId, title: payload.title ?? title.trim() });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to create opportunity",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-carbon-blue/20 p-4 sm:items-center">
      <div
        className="w-full max-w-sm border border-carbon-blue/10 bg-white shadow-lg"
        role="dialog"
        aria-labelledby="outlook-add-opportunity-title"
      >
        <div className="border-b border-carbon-blue/8 px-4 py-3">
          <p
            id="outlook-add-opportunity-title"
            className="text-sm font-semibold text-carbon-blue"
          >
            {createdDealId ? "Opportunity created" : "Create opportunity"}
          </p>
          <p className="mt-1 text-[11px] text-carbon-blue/50">
            {createdDealId
              ? "Open it in SmartCRM when you are ready."
              : `For ${companyName}. You confirm — SmartCRM does not invent the deal.`}
          </p>
        </div>

        <div className="max-h-[70dvh] space-y-3 overflow-y-auto px-4 py-4">
          {createdDealId ? (
            <a
              href={buildSmartCrmUrl(deal360Href(createdDealId))}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center border border-upcycle-orange bg-upcycle-orange px-3 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white"
            >
              Open opportunity
            </a>
          ) : (
            <>
              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
                  Company
                </span>
                <input
                  type="text"
                  readOnly
                  value={companyName}
                  className="mt-1 w-full border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-2 text-[12px] text-carbon-blue"
                />
              </label>

              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
                  Opportunity name
                </span>
                <input
                  type="text"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Carbon Emergente — feedstock study"
                  className="mt-1 w-full border border-carbon-blue/15 px-3 py-2 text-[12px] text-carbon-blue"
                />
              </label>

              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
                  Company role
                </span>
                <select
                  value={companyRole}
                  onChange={(event) =>
                    setCompanyRole(event.target.value as CompanyRole)
                  }
                  className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
                >
                  {COMPANY_ROLES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <div>
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
                  Offerings in scope
                </span>
                <div className="mt-1">
                  <OpportunityOfferingsPicker
                    selectedIds={offeringIds}
                    onChange={setOfferingIds}
                    required
                    defaultOpen
                    label="Selected offerings"
                    helper="Select at least one — required to create."
                  />
                </div>
              </div>
            </>
          )}

          {error ? <p className="text-[11px] text-red-700">{error}</p> : null}
        </div>

        <div className="flex gap-2 border-t border-carbon-blue/8 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 border border-carbon-blue/15 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60"
          >
            {createdDealId ? "Done" : "Cancel"}
          </button>
          {!createdDealId ? (
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
              className="flex-1 border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create opportunity"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
