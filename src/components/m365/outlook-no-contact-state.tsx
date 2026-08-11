"use client";

/**
 * FS-012 Relationship Intake — Outlook surface.
 * Propose → Yes/No → Confirm → Persist. Never auto-create.
 */

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { OutlookAddOpportunityDialog } from "@/components/m365/outlook-add-opportunity-dialog";
import { OutlookEnrichmentPanel } from "@/components/m365/outlook-enrichment-panel";
import {
  buildSmartCrmUrl,
  resolveOutlookOpenMessageSeed,
} from "@/lib/m365/outlook-context";
import {
  resolveDevMessageBody,
  resolveOutlookMessageBody,
} from "@/lib/m365/outlook-message-body";
import { acceptedEnrichmentToContactFields } from "@/lib/m365/signature-intelligence";
import type { SignatureSuggestion } from "@/lib/m365/signature-intelligence";
import type { OutlookAddContactResult } from "@/lib/m365/outlook-sender-types";
import { IndustrySelect } from "@/components/ui/industry-select";
import { ContactRoleSelect } from "@/components/ui/contact-role-select";
import type { CompanyIndustry } from "@/types/company";
import {
  resolveContactListRole,
  suggestContactListRoleFromTitle,
  type ContactListRole,
} from "@/types/contact";
import { contact360Href, companyHref } from "@/types/relationship-navigation";
import {
  COMPANY_TYPE_SELECT_OPTIONS,
  type CompanyType,
} from "@/types/company-type";
import type {
  RelationshipIntakeApproveResult,
  RelationshipIntakeProposal,
} from "@/types/relationship-intake";

type Phase = "loading" | "propose" | "confirm" | "done" | "dismissed" | "error";

export function OutlookNoContactState({
  email,
  displayName,
  onContactCreated,
}: {
  email: string;
  displayName?: string | null;
  onContactCreated: () => void;
}) {
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("loading");
  const [error, setError] = useState<string | null>(null);
  const [proposal, setProposal] = useState<RelationshipIntakeProposal | null>(null);
  const [created, setCreated] = useState<RelationshipIntakeApproveResult | null>(null);
  const [opportunityOpen, setOpportunityOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [role, setRole] = useState<ContactListRole | "">("");
  const [industry, setIndustry] = useState<CompanyIndustry | "">("");
  const [companyType, setCompanyType] = useState<CompanyType | "">("");
  const [companyName, setCompanyName] = useState("");
  const [companyOverride, setCompanyOverride] = useState(false);
  const [linkKind, setLinkKind] = useState<"none" | "opportunity" | "project">("none");
  const [selectedLinkId, setSelectedLinkId] = useState("");
  const [enrichmentDismissed, setEnrichmentDismissed] = useState(false);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<SignatureSuggestion[] | null>(
    null,
  );

  useEffect(() => {
    let active = true;
    setPhase("loading");
    setError(null);

    void (async () => {
      try {
        const devBody = resolveDevMessageBody(searchParams);
        const messageBody = devBody ?? (await resolveOutlookMessageBody());
        const response = await fetch("/api/m365/outlook/relationship-intake", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "propose",
            email,
            displayName: displayName ?? undefined,
            messageBody: messageBody ?? undefined,
          }),
        });

        if (!active) return;

        if (!response.ok) {
          setError("Unable to prepare relationship intake.");
          setPhase("error");
          return;
        }

        const data = (await response.json()) as RelationshipIntakeProposal;
        if (!active) return;
        setProposal(data);
        setCompanyName(data.companyName);
        setPhase("propose");
      } catch {
        if (!active) return;
        setError("Unable to prepare relationship intake.");
        setPhase("error");
      }
    })();

    return () => {
      active = false;
    };
  }, [email, displayName, searchParams]);

  const opportunityEligible =
    created?.relationshipCard?.opportunityEligible === true;

  const showMatchedCompany =
    Boolean(proposal?.companyResolved && proposal.companyId && !companyOverride);

  const showEnrichment =
    proposal &&
    phase === "confirm" &&
    !enrichmentDismissed &&
    acceptedSuggestions === null &&
    proposal.enrichment.suggestions.length > 0;

  const applyEnrichmentSuggestions = (suggestions: SignatureSuggestion[]) => {
    setAcceptedSuggestions(suggestions);
    setEnrichmentDismissed(false);
    const fields = acceptedEnrichmentToContactFields(suggestions);
    if (fields.companyName && !(proposal?.companyResolved && proposal.companyId && !companyOverride)) {
      setCompanyName(fields.companyName);
    }
    if (fields.jobTitle) {
      const matchedRole =
        suggestContactListRoleFromTitle(fields.jobTitle) ||
        resolveContactListRole(fields.jobTitle);
      if (matchedRole) setRole((current) => current || matchedRole);
    }
  };

  const handleYes = () => {
    setPhase("confirm");
    setError(null);
    if (proposal?.enrichment.suggestions.length) {
      applyEnrichmentSuggestions(proposal.enrichment.suggestions);
    }
  };

  const handleNo = () => {
    setPhase("dismissed");
  };

  const handleAcceptEnrichment = () => {
    if (!proposal) return;
    applyEnrichmentSuggestions(proposal.enrichment.suggestions);
  };

  const handleCreate = async () => {
    if (!proposal || !role) return;
    if (!showMatchedCompany && !industry) return;
    if (!showMatchedCompany && !companyType) return;
    if (linkKind !== "none" && !selectedLinkId) return;

    setBusy(true);
    setError(null);

    const enrichmentFields = acceptedSuggestions
      ? acceptedEnrichmentToContactFields(acceptedSuggestions)
      : null;

    const seed = await resolveOutlookOpenMessageSeed().catch(() => null);

    try {
      const response = await fetch("/api/m365/outlook/relationship-intake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          email: proposal.email,
          firstName: proposal.firstName,
          lastName: proposal.lastName,
          companyName: showMatchedCompany ? proposal.companyName : companyName,
          role,
          industry: showMatchedCompany ? undefined : industry || undefined,
          companyTypes: showMatchedCompany
            ? undefined
            : companyType
              ? [companyType]
              : undefined,
          matchedCompanyId: showMatchedCompany ? proposal.companyId : undefined,
          skipAutoCompanyMatch:
            proposal.companyResolved && companyOverride ? true : undefined,
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
          conversationId: seed?.conversationId ?? undefined,
          opportunityId: linkKind === "opportunity" ? selectedLinkId : undefined,
          projectId: linkKind === "project" ? selectedLinkId : undefined,
          message: seed
            ? {
                externalMessageId: seed.externalMessageId,
                subject: seed.subject,
                senderEmail: seed.senderEmail,
                sentAt: seed.sentAt,
              }
            : undefined,
        }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Unable to create in SmartCRM.");
        setBusy(false);
        return;
      }

      const result = (await response.json()) as RelationshipIntakeApproveResult;
      setCreated(result);
      setPhase("done");
      setBusy(false);
    } catch {
      setError("Unable to create in SmartCRM.");
      setBusy(false);
    }
  };

  return (
    <>
      <div className="flex h-[100dvh] flex-col justify-center bg-white px-6">
        <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-upcycle-orange">
          SmartCRM
        </p>

        {phase === "loading" ? (
          <p className="mt-2 text-[11px] text-carbon-blue/50">
            Checking SmartCRM for this relationship…
          </p>
        ) : null}

        {phase === "error" ? (
          <>
            <p className="mt-2 text-sm font-semibold text-carbon-blue">Unable to prepare</p>
            <p className="mt-1 text-[11px] text-carbon-blue/50">{error}</p>
          </>
        ) : null}

        {phase === "dismissed" ? (
          <>
            <p className="mt-2 text-sm font-semibold text-carbon-blue">Left unchanged</p>
            <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">
              Nothing was created. You can add this relationship later from Outlook.
            </p>
            <button
              type="button"
              onClick={() => setPhase("propose")}
              className="mt-5 border border-carbon-blue/20 bg-white px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue"
            >
              Review again
            </button>
          </>
        ) : null}

        {phase === "done" && created ? (
          <>
            <p className="mt-2 text-sm font-semibold text-carbon-blue">Added to SmartCRM</p>
            <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">
              {created.companyCreated
                ? "Contact and company created — stay in Outlook, or open SmartCRM."
                : "Contact linked to the existing company."}
              {created.threadLinked ? " This thread was connected." : ""}
            </p>
            <a
              href={buildSmartCrmUrl(
                contact360Href(created.contactId, created.companyId),
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex w-full items-center justify-center border border-upcycle-orange bg-upcycle-orange px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white"
            >
              View contact in SmartCRM
            </a>
            <a
              href={buildSmartCrmUrl(companyHref(created.companyId))}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex w-full items-center justify-center border border-carbon-blue/20 bg-white px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange"
            >
              View company in SmartCRM
            </a>
            <button
              type="button"
              onClick={onContactCreated}
              className="mt-3 border border-carbon-blue/15 bg-white px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60"
            >
              Continue in Outlook
            </button>
            {opportunityEligible ? (
              <button
                type="button"
                onClick={() => setOpportunityOpen(true)}
                className="mt-3 border border-carbon-blue/20 bg-white px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue hover:border-upcycle-orange hover:text-upcycle-orange"
              >
                Create opportunity
              </button>
            ) : null}
          </>
        ) : null}

        {phase === "propose" && proposal ? (
          <>
            <p className="mt-2 text-sm font-semibold text-carbon-blue">
              {proposal.companyResolved ? "Add contact?" : "New relationship"}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-carbon-blue/50">
              {proposal.decisionQuestion}
            </p>
            <p className="mt-3 text-[12px] font-medium text-carbon-blue">
              {proposal.displayName || email}
            </p>
            <p className="mt-0.5 text-[10px] text-carbon-blue/40">{proposal.email}</p>
            <p className="mt-3 text-[11px] text-carbon-blue/70">
              {proposal.companyResolved
                ? `Company already in SmartCRM: ${proposal.companyName}`
                : proposal.companyName
                  ? `Suggested company: ${proposal.companyName}`
                  : "Company: not yet known"}
            </p>
            <p className="mt-2 text-[10px] leading-relaxed text-carbon-blue/45">
              {proposal.decisionImpact}
            </p>
            <button
              type="button"
              onClick={handleYes}
              className="mt-5 border border-upcycle-orange bg-upcycle-orange px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white"
            >
              {proposal.companyResolved ? "Yes, add contact" : "Yes — create company & contact"}
            </button>
            <button
              type="button"
              onClick={handleNo}
              className="mt-3 border border-carbon-blue/20 bg-white px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue"
            >
              No — leave unchanged
            </button>
            <a
              href={buildSmartCrmUrl("/companies")}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 text-center text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/45 hover:text-upcycle-orange"
            >
              Open SmartCRM
            </a>
          </>
        ) : null}

        {phase === "confirm" && proposal ? (
          <div className="mt-2 max-h-[78dvh] space-y-3 overflow-y-auto">
            <p className="text-sm font-semibold text-carbon-blue">
              {showMatchedCompany ? "Confirm add contact" : "Confirm create"}
            </p>
            <p className="text-[11px] text-carbon-blue/50">
              {showMatchedCompany
                ? `${proposal.companyName} is already in SmartCRM. Choose a role, then add the contact.`
                : "SmartAssist prepared this draft. Nothing is saved until you create."}
            </p>

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

            {acceptedSuggestions && acceptedSuggestions.length > 0 ? (
              <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-2">
                <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
                  Captured from email signature
                </p>
                <ul className="mt-1.5 space-y-1">
                  {acceptedSuggestions.map((item) => (
                    <li
                      key={item.id}
                      className="flex gap-2 text-[11px] text-carbon-blue/75"
                    >
                      <span className="shrink-0 font-semibold text-carbon-blue/45">
                        {item.label}
                      </span>
                      <span className="min-w-0 whitespace-pre-wrap break-words">
                        {item.value}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {showMatchedCompany ? (
              <div>
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
                  Link to company
                </span>
                <div className="mt-1 flex items-center justify-between gap-2 border border-carbon-blue/10 bg-carbon-blue/[0.02] px-3 py-2">
                  <p className="text-[12px] font-medium text-carbon-blue">
                    {proposal.companyName}
                  </p>
                  <button
                    type="button"
                    onClick={() => setCompanyOverride(true)}
                    className="shrink-0 border border-carbon-blue/15 px-2 py-1 text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/60"
                  >
                    Change
                  </button>
                </div>
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

            {(proposal.opportunityOptions.length > 0 ||
              proposal.projectOptions.length > 0) && (
              <div className="space-y-2 border-t border-carbon-blue/8 pt-3">
                <label className="block">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-carbon-blue/40">
                    Connect this thread (optional)
                  </span>
                  <select
                    value={
                      linkKind === "none"
                        ? "none"
                        : `${linkKind}:${selectedLinkId || ""}`
                    }
                    onChange={(event) => {
                      const value = event.target.value;
                      if (value === "none") {
                        setLinkKind("none");
                        setSelectedLinkId("");
                        return;
                      }
                      const [kind, ...rest] = value.split(":");
                      const id = rest.join(":");
                      if (kind === "opportunity" || kind === "project") {
                        setLinkKind(kind);
                        setSelectedLinkId(id);
                      }
                    }}
                    className="mt-1 w-full border border-carbon-blue/15 bg-white px-3 py-2 text-[12px] text-carbon-blue"
                  >
                    <option value="none">Do not link yet</option>
                    {proposal.opportunityOptions.length > 0 ? (
                      <optgroup label="Opportunities">
                        {proposal.opportunityOptions.map((option) => (
                          <option
                            key={`opportunity:${option.id}`}
                            value={`opportunity:${option.id}`}
                          >
                            {option.label}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                    {proposal.projectOptions.length > 0 ? (
                      <optgroup label="Projects">
                        {proposal.projectOptions.map((option) => (
                          <option
                            key={`project:${option.id}`}
                            value={`project:${option.id}`}
                          >
                            {option.label}
                          </option>
                        ))}
                      </optgroup>
                    ) : null}
                  </select>
                </label>
                {proposal.opportunityOptions.length === 0 ? (
                  <p className="text-[10px] text-carbon-blue/45">
                    No open opportunities on this company yet.
                  </p>
                ) : null}
              </div>
            )}

            {showEnrichment ? (
              <OutlookEnrichmentPanel
                suggestions={proposal.enrichment.suggestions}
                onAccept={handleAcceptEnrichment}
                onIgnore={() => setEnrichmentDismissed(true)}
              />
            ) : null}

            {error ? <p className="text-[11px] text-red-600">{error}</p> : null}

            <button
              type="button"
              disabled={
                busy ||
                !role ||
                (!showMatchedCompany && (!industry || !companyType || !companyName.trim()))
              }
              onClick={() => void handleCreate()}
              className="w-full border border-upcycle-orange bg-upcycle-orange px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-white disabled:opacity-40"
            >
              {busy
                ? showMatchedCompany
                  ? "Adding…"
                  : "Creating…"
                : showMatchedCompany
                  ? "Add contact to SmartCRM"
                  : "Create in SmartCRM"}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => setPhase("propose")}
              className="w-full border border-carbon-blue/15 bg-white px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/60"
            >
              Back
            </button>
          </div>
        ) : null}
      </div>

      {created && opportunityEligible ? (
        <OutlookAddOpportunityDialog
          open={opportunityOpen}
          companyId={created.companyId}
          companyName={created.relationshipCard?.companyName ?? "Company"}
          onClose={() => setOpportunityOpen(false)}
          onCreated={() => {
            setOpportunityOpen(false);
            onContactCreated();
          }}
        />
      ) : null}
    </>
  );
}

/** @deprecated Alias kept for clarity in docs — same component. */
export type OutlookRelationshipIntakeResult = OutlookAddContactResult;
