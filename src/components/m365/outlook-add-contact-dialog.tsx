"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OutlookEnrichmentPanel } from "@/components/m365/outlook-enrichment-panel";
import type { OutlookAddContactResult, OutlookSenderPrepopulation } from "@/lib/m365/outlook-sender-types";
import { acceptedEnrichmentToContactFields } from "@/lib/m365/signature-intelligence";
import type { SignatureSuggestion } from "@/lib/m365/signature-intelligence";
import {
  resolveDevMessageBody,
  resolveOutlookMessageBody,
  logOutlookImportClient,
} from "@/lib/m365/outlook-message-body";
import { IndustrySelect } from "@/components/ui/industry-select";
import { ContactRoleSelect } from "@/components/ui/contact-role-select";
import type { CompanyIndustry } from "@/types/company";
import {
  resolveContactListRole,
  suggestContactListRoleFromTitle,
  type ContactListRole,
} from "@/types/contact";
import {
  COMPANY_TYPE_SELECT_OPTIONS,
  type CompanyType,
} from "@/types/company-type";

type OutlookAddContactDialogProps = {
  open: boolean;
  email: string;
  displayName?: string | null;
  onClose: () => void;
  onCreated: (result: OutlookAddContactResult) => void;
};

export function OutlookAddContactDialog({
  open,
  email,
  displayName,
  onClose,
  onCreated,
}: OutlookAddContactDialogProps) {
  const searchParams = useSearchParams();
  const [prepopulation, setPrepopulation] = useState<OutlookSenderPrepopulation | null>(null);
  const [companyName, setCompanyName] = useState("");
  const [companyOverride, setCompanyOverride] = useState(false);
  const [role, setRole] = useState<ContactListRole | "">("");
  const [industry, setIndustry] = useState<CompanyIndustry | "">("");
  const [companyType, setCompanyType] = useState<CompanyType | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrichmentDismissed, setEnrichmentDismissed] = useState(false);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<SignatureSuggestion[] | null>(
    null,
  );
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) {
      setEnrichmentDismissed(false);
      setAcceptedSuggestions(null);
      setPrepopulation(null);
      setCompanyOverride(false);
      setRole("");
      setIndustry("");
      setCompanyType("");
      return;
    }

    let active = true;
    setError(null);
    setLoading(true);

    void (async () => {
      const devBody = resolveDevMessageBody(searchParams);
      const messageBody = devBody ?? (await resolveOutlookMessageBody());

      logOutlookImportClient("RAW OUTLOOK BODY", {
        source: devBody ? "dev-signature-param" : "office-js",
        length: messageBody?.length ?? 0,
        preview: messageBody?.slice(0, 500) ?? null,
      });

      try {
        const response = await fetch("/api/m365/outlook/sender-context", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email,
            displayName: displayName ?? undefined,
            messageBody: messageBody ?? undefined,
          }),
        });

        if (!active || !mountedRef.current) return;

        if (!response.ok) {
          setError("Unable to prepare contact details.");
          setLoading(false);
          return;
        }

        const data = (await response.json()) as OutlookSenderPrepopulation;
        if (!active || !mountedRef.current) return;

        logOutlookImportClient("SENDER-CONTEXT RESPONSE", data);

        setPrepopulation(data);
        setCompanyName(data.companyName);
        setCompanyOverride(false);
        setLoading(false);
      } catch {
        if (!active || !mountedRef.current) return;
        setError("Unable to prepare contact details.");
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [open, email, displayName, searchParams]);

  if (!open) return null;

  const showMatchedCompany =
    prepopulation?.companyResolved && !companyOverride && prepopulation.companyId;

  const showEnrichment =
    prepopulation &&
    !enrichmentDismissed &&
    acceptedSuggestions === null &&
    prepopulation.enrichment.suggestions.length > 0;

  const handleAcceptEnrichment = () => {
    if (!prepopulation) return;
    const suggestions = prepopulation.enrichment.suggestions;
    setAcceptedSuggestions(suggestions);

    const fields = acceptedEnrichmentToContactFields(suggestions);
    if (fields.companyName && !showMatchedCompany) {
      setCompanyName(fields.companyName);
    }
    if (fields.jobTitle && !role) {
      const matchedRole =
        suggestContactListRoleFromTitle(fields.jobTitle) ||
        resolveContactListRole(fields.jobTitle);
      if (matchedRole) setRole(matchedRole);
    }
  };

  const handleChangeCompany = () => {
    setCompanyOverride(true);
  };

  const handleSubmit = async () => {
    if (!prepopulation || !role) return;
    const useMatchedCompany = Boolean(
      showMatchedCompany && prepopulation.companyId,
    );
    if (!useMatchedCompany && !industry) return;
    if (!useMatchedCompany && !companyType) return;

    setLoading(true);
    setError(null);

    const enrichmentFields = acceptedSuggestions
      ? acceptedEnrichmentToContactFields(acceptedSuggestions)
      : null;

    const requestPayload = {
      email: prepopulation.email,
      firstName: prepopulation.firstName,
      lastName: prepopulation.lastName,
      companyName: useMatchedCompany ? prepopulation.companyName : companyName,
      role,
      industry: useMatchedCompany ? undefined : industry || undefined,
      companyTypes: useMatchedCompany ? undefined : companyType ? [companyType] : undefined,
      matchedCompanyId: useMatchedCompany ? prepopulation.companyId : undefined,
      skipAutoCompanyMatch:
        prepopulation.companyResolved && companyOverride ? true : undefined,
      enrichment: enrichmentFields
        ? {
            jobTitle: enrichmentFields.jobTitle || undefined,
            mobile: enrichmentFields.mobile || undefined,
            phone: enrichmentFields.phone || undefined,
            companyName: enrichmentFields.companyName || undefined,
            address: enrichmentFields.address || undefined,
            website: enrichmentFields.website || undefined,
          }
        : undefined,
    };

    logOutlookImportClient("ADD-CONTACT PAYLOAD", {
      accepted: Boolean(acceptedSuggestions),
      ignored: enrichmentDismissed,
      payload: requestPayload,
    });

    try {
      const response = await fetch("/api/m365/outlook/add-contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestPayload),
      });

      if (!mountedRef.current) return;

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Unable to create contact.");
        setLoading(false);
        return;
      }

      const result = (await response.json()) as OutlookAddContactResult;
      onCreated(result);
      onClose();
    } catch {
      if (!mountedRef.current) return;
      setError("Unable to create contact.");
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-carbon-blue/20 p-4 sm:items-center">
      <div
        className="w-full max-w-sm border border-carbon-blue/10 bg-white shadow-lg"
        role="dialog"
        aria-labelledby="outlook-add-contact-title"
      >
        <div className="border-b border-carbon-blue/8 px-4 py-3">
          <p
            id="outlook-add-contact-title"
            className="text-sm font-semibold text-carbon-blue"
          >
            Add to SmartCRM
          </p>
          <p className="mt-1 text-[11px] text-carbon-blue/50">
            Confirm contact and company — nothing is created until you say so.
          </p>
        </div>

        <div className="max-h-[70dvh] space-y-3 overflow-y-auto px-4 py-4">
          {loading && !prepopulation ? (
            <p className="text-[11px] text-carbon-blue/50">Preparing contact details…</p>
          ) : (
            <>
              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
                  Name
                </span>
                <input
                  type="text"
                  readOnly
                  value={prepopulation?.displayName ?? displayName ?? ""}
                  className="mt-1 w-full border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-2 text-[12px] text-carbon-blue"
                />
              </label>

              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
                  Email
                </span>
                <input
                  type="email"
                  readOnly
                  value={prepopulation?.email ?? email}
                  className="mt-1 w-full border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-2 text-[12px] text-carbon-blue/60"
                />
              </label>

              <label className="block">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
                  Role
                </span>
                <ContactRoleSelect
                  value={role}
                  onChange={(value) => setRole(value)}
                  allowEmpty
                  className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
                />
              </label>

              {showMatchedCompany ? (
                <div>
                  <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
                    Link to company
                  </span>
                  <div className="mt-1 flex items-center justify-between gap-2 border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-2">
                    <p className="text-[12px] font-medium text-carbon-blue">
                      {prepopulation.companyName}
                    </p>
                    <button
                      type="button"
                      onClick={handleChangeCompany}
                      className="shrink-0 border border-carbon-blue/15 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/60 hover:border-upcycle-orange hover:text-upcycle-orange"
                    >
                      Change
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] text-carbon-blue/45">
                    Existing company — contact will be linked here.
                  </p>
                </div>
              ) : (
                <>
                  <label className="block">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
                      Create company
                    </span>
                    <input
                      type="text"
                      value={companyName}
                      onChange={(event) => setCompanyName(event.target.value)}
                      className="mt-1 w-full border border-carbon-blue/15 px-3 py-2 text-[12px] text-carbon-blue"
                    />
                    <p className="mt-1 text-[10px] text-carbon-blue/45">
                      {companyOverride
                        ? "A new company will be created with this name."
                        : (prepopulation?.companyHint ??
                          "A new company will be created when you confirm.")}
                    </p>
                  </label>
                  <label className="block">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
                      Relationship type
                    </span>
                    <select
                      value={companyType}
                      onChange={(event) =>
                        setCompanyType(event.target.value as CompanyType | "")
                      }
                      className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
                    >
                      <option value="">What kind of company?…</option>
                      {COMPANY_TYPE_SELECT_OPTIONS.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[10px] text-carbon-blue/45">
                      Supplier, Prospect, Partner… — this decides whether opportunities make sense.
                    </p>
                  </label>
                  <label className="block">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
                      Industry
                    </span>
                    <IndustrySelect
                      value={industry}
                      onChange={(value) => setIndustry(value)}
                      allowEmpty
                      className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
                    />
                  </label>
                </>
              )}

              {showEnrichment ? (
                <OutlookEnrichmentPanel
                  suggestions={prepopulation.enrichment.suggestions}
                  onAccept={handleAcceptEnrichment}
                  onIgnore={() => setEnrichmentDismissed(true)}
                />
              ) : null}

              {acceptedSuggestions ? (
                <p className="text-[10px] text-carbon-blue/45">
                  Signature details accepted — they will be saved with this contact.
                </p>
              ) : null}
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
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={
              loading ||
              !prepopulation ||
              !role ||
              !prepopulation.displayName.trim() ||
              (!showMatchedCompany &&
                (!companyName.trim() || !industry || !companyType))
            }
            className="flex-1 border border-upcycle-orange bg-upcycle-orange px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-white disabled:opacity-50"
          >
            {loading
              ? "Creating…"
              : showMatchedCompany
                ? "Create contact"
                : "Create contact + company"}
          </button>
        </div>
      </div>
    </div>
  );
}
