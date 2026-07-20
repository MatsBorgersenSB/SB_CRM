"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { ExternalLink, Mail, Phone } from "lucide-react";
import type { Company } from "@/types/company";
import type {
  EventContactDiscovery,
  EventOutreachRecommendation,
  EventPlanningContact,
  EventPlanningWorkspace,
} from "@/types/event-planning";
import { eventPlanningHref } from "@/types/event-planning";
import { company360Href } from "@/types/company-360";
import { buildEventPlanningWorkspace, industryForEventSeed } from "@/lib/growth-event-planning-engine";
import {
  markEventCompanyAdded,
  readEventPlanningState,
  updateEventContactStatus,
  type EventPlanningPersistedState,
} from "@/lib/event-planning-state";
import { stashEventCompanyPrefill } from "@/lib/event-planning-prefill";
import { stashSmartAssistPrefill } from "@/lib/smart-assist-prefill";
import { m365ComposeHref, telHref } from "@/lib/compose-actions";
import { overflowLabel } from "@/lib/signal-extraction";
import { SmartAssistCategoryBadge, SmartAssistConfidenceLabel } from "@/components/smartassist/smartassist-intelligence-display";
import { WorkspaceIntelContextLayout } from "@/components/ui/workspace-intel-context-layout";
import {
  EDITORIAL_BODY,
  EDITORIAL_FIELD_LABEL,
  EDITORIAL_GAP_BLOCK,
  EDITORIAL_HERO,
  EDITORIAL_LABEL,
  EDITORIAL_META,
} from "@/lib/editorial-design-system";
import {
  WORKSPACE_INTEL_METRICS_GRID,
  WORKSPACE_PANEL_SURFACE,
  WORKSPACE_SURFACE,
} from "@/lib/workspace-design-system";

const STATUS_LABELS: Record<EventPlanningContact["status"], string> = {
  identified: "Identified",
  meeting_requested: "Meeting requested",
  meeting_scheduled: "Meeting scheduled",
};

const PRIORITY_STYLES: Record<EventPlanningContact["priority"], string> = {
  high: "text-upcycle-orange",
  medium: "text-carbon-blue/60",
  low: "text-carbon-blue/40",
};

export function EventPlanningWorkspaceView({
  eventId,
  companies,
}: {
  eventId: string;
  companies: Company[];
}) {
  const router = useRouter();
  const [persisted, setPersisted] = useState<EventPlanningPersistedState>(() =>
    readEventPlanningState(eventId),
  );

  const workspace = useMemo(
    () => buildEventPlanningWorkspace(eventId, companies, persisted),
    [eventId, companies, persisted],
  );

  const refreshPersisted = useCallback(() => {
    setPersisted(readEventPlanningState(eventId));
  }, [eventId]);

  if (!workspace) {
    return (
      <div className={WORKSPACE_SURFACE}>
        <Link
          href="/growth/events"
          className="text-[11px] font-medium text-carbon-blue/45 transition-colors hover:text-upcycle-orange"
        >
          ← Events
        </Link>
        <p className="mt-4 text-sm text-carbon-blue/60">Event not found.</p>
      </div>
    );
  }

  const handleContactStatus = (contactTargetId: string, status: EventPlanningContact["status"]) => {
    setPersisted(updateEventContactStatus(eventId, contactTargetId, status));
  };

  const handleAddCompany = (prospectId: string, name: string, discovery: EventContactDiscovery) => {
    const industry = industryForEventSeed(eventId);
    stashEventCompanyPrefill({
      Title: name,
      Domain: discovery.website?.replace(/^https?:\/\//, ""),
      Industry: industry,
      Phone: discovery.phone,
      sourceEventId: eventId,
      sourceProspectId: prospectId,
    });
    markEventCompanyAdded(eventId, prospectId);
    refreshPersisted();
    router.push("/companies");
  };

  const handleAddContact = (contact: EventPlanningContact) => {
    if (contact.inCrm && contact.contactId) {
      const company = companies.find((c) => c.CompanyID === contact.companyTargetId);
      if (company) {
        router.push(company360Href(company.CompanyID));
      }
      return;
    }
    handleAddCompany(contact.companyTargetId, contact.companyName, contact.discovery);
  };

  const handleCreateActivity = (contact: EventPlanningContact, recommendation?: EventOutreachRecommendation) => {
    const company = companies.find((c) => c.CompanyID === contact.companyTargetId);
    stashSmartAssistPrefill({
      ActivityType: "Meeting",
      Subject: `${workspace.event.name} — meeting with ${contact.name}`,
      companyId: company?.CompanyID,
      contactId: contact.contactId,
      knowledgeDraft: {
        Summary: recommendation?.whyContact ?? contact.whyRelevant,
        NextAction: contact.discussionTopics.join("; "),
        ActionRequired: true,
        ActionStatus: "Planned",
      },
    });
    router.push("/activities");
  };

  const handleDraftOutreach = (recommendation: EventOutreachRecommendation) => {
    const contact = workspace.contacts.find((c) => c.id === recommendation.contactTargetId);
    const email = contact?.discovery.email;
    if (!email || !recommendation.emailSubject || !recommendation.emailBody) return;
    window.open(m365ComposeHref(email, recommendation.emailSubject, recommendation.emailBody), "_blank");
    handleContactStatus(recommendation.contactTargetId, "meeting_requested");
  };

  return (
    <div className={`${WORKSPACE_SURFACE} ${EDITORIAL_GAP_BLOCK}`}>
      <Link
        href="/growth/events"
        className="text-[11px] font-medium text-carbon-blue/45 transition-colors hover:text-upcycle-orange"
      >
        ← Events
      </Link>

      <WorkspaceIntelContextLayout
        header={
          <header>
            <p className={EDITORIAL_LABEL}>Event planning intelligence</p>
            <h1 className={`mt-2 ${EDITORIAL_HERO}`}>{workspace.event.name}</h1>
            <p className={`mt-2 ${EDITORIAL_META}`}>
              {workspace.event.location} · {workspace.event.dateLabel}
            </p>
            <p className={`mt-4 max-w-3xl ${EDITORIAL_BODY}`}>{workspace.headline}</p>
            <div className="mt-4 flex flex-wrap gap-3">
              {workspace.focusQuestions.map((question) => (
                <span
                  key={question}
                  className="border border-carbon-blue/10 bg-carbon-blue/[0.03] px-2.5 py-1 text-[11px] font-medium text-carbon-blue/65"
                >
                  {question}
                </span>
              ))}
            </div>
          </header>
        }
        intelligence={
          <>
            <section className={WORKSPACE_PANEL_SURFACE}>
              <p className={EDITORIAL_LABEL}>Execution tracking</p>
              <div className={`mt-4 ${WORKSPACE_INTEL_METRICS_GRID}`}>
                <TrackingMetric label="Companies identified" value={workspace.metrics.companiesIdentified} />
                <TrackingMetric label="Contacts identified" value={workspace.metrics.contactsIdentified} />
                <TrackingMetric label="Meetings requested" value={workspace.metrics.meetingsRequested} />
                <TrackingMetric label="Meetings scheduled" value={workspace.metrics.meetingsScheduled} />
              </div>
            </section>

            {workspace.primaryAction ? (
              <section className={`${WORKSPACE_PANEL_SURFACE} border-upcycle-orange/20 bg-upcycle-orange/[0.03]`}>
                <p className={EDITORIAL_LABEL}>What should happen next</p>
                <p className="mt-3 text-[16px] font-medium text-carbon-blue">{workspace.primaryAction}</p>
              </section>
            ) : null}

            <section className={WORKSPACE_PANEL_SURFACE}>
              <p className={EDITORIAL_LABEL}>Top recommended meetings</p>
              <p className={`mt-1 ${EDITORIAL_META}`}>
                {overflowLabel(workspace.metrics.contactsShown, workspace.metrics.contactsIdentified) ??
                  "Not all exhibitors — only meetings that matter."}
              </p>
              <div className="mt-4 space-y-3">
                {workspace.signals.topToMeet.map((signal) => (
                  <article key={signal.contactTargetId} className="border border-carbon-blue/8 px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-[14px] font-medium text-carbon-blue">
                          {signal.rank}. {signal.name}
                        </p>
                        <p className={`mt-0.5 ${EDITORIAL_META}`}>{signal.companyName}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <SmartAssistCategoryBadge category={signal.insightCategory} />
                        <SmartAssistConfidenceLabel confidence={signal.confidence} />
                      </div>
                    </div>
                    <p className={`mt-2 ${EDITORIAL_BODY}`}>
                      <span className="text-carbon-blue/40">Why: </span>
                      {signal.whyMeet}
                    </p>
                    <p className={`mt-1 ${EDITORIAL_META}`}>
                      Category: {signal.category.replace(/_/g, " ")}
                    </p>
                  </article>
                ))}
              </div>
            </section>

            <section className={WORKSPACE_PANEL_SURFACE}>
              <p className={EDITORIAL_LABEL}>Who to contact</p>
              <p className={`mt-1 ${EDITORIAL_META}`}>The system recommends — you decide.</p>
              <div className="mt-5 space-y-4">
                {workspace.recommendations.map((recommendation) => (
                  <RecommendationCard
                    key={recommendation.contactTargetId}
                    recommendation={recommendation}
                    contact={workspace.contacts.find((c) => c.id === recommendation.contactTargetId)}
                    onDraftOutreach={() => handleDraftOutreach(recommendation)}
                    onCreateActivity={() => {
                      const contact = workspace.contacts.find(
                        (c) => c.id === recommendation.contactTargetId,
                      );
                      if (contact) handleCreateActivity(contact, recommendation);
                    }}
                    onRequestMeeting={() =>
                      handleContactStatus(recommendation.contactTargetId, "meeting_requested")
                    }
                    onScheduleMeeting={() =>
                      handleContactStatus(recommendation.contactTargetId, "meeting_scheduled")
                    }
                  />
                ))}
              </div>
            </section>

            <section className={WORKSPACE_PANEL_SURFACE}>
              <p className={EDITORIAL_LABEL}>Signal companies</p>
              <p className={`mt-1 ${EDITORIAL_META}`}>
                {overflowLabel(workspace.metrics.companiesShown, workspace.metrics.companiesIdentified) ??
                  "Top companies only."}
              </p>
              <div className="mt-4 space-y-3">
                {workspace.companies.map((company) => (
                  <article
                    key={company.id}
                    className="border border-carbon-blue/8 px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        {company.href ? (
                          <Link
                            href={company.href}
                            className="text-[14px] font-medium text-carbon-blue hover:text-upcycle-orange"
                          >
                            {company.name}
                          </Link>
                        ) : (
                          <p className="text-[14px] font-medium text-carbon-blue">{company.name}</p>
                        )}
                        <p className={`mt-0.5 ${EDITORIAL_META}`}>
                          {[company.industry, company.geography].filter(Boolean).join(" · ")}
                          {company.inCrm ? " · In CRM" : " · Prospect"}
                        </p>
                      </div>
                      <span className="text-[11px] font-semibold text-upcycle-orange">
                        {company.relevanceScore}% relevant
                      </span>
                    </div>
                    <ul className="mt-2 space-y-0.5">
                      {company.relevanceReasons.map((reason) => (
                        <li key={reason} className={`${EDITORIAL_META}`}>
                          · {reason}
                        </li>
                      ))}
                    </ul>
                    <DiscoveryLinks discovery={company.discovery} />
                    {!company.inCrm ? (
                      <button
                        type="button"
                        onClick={() =>
                          handleAddCompany(company.id, company.name, company.discovery)
                        }
                        className="mt-3 text-[12px] font-medium text-upcycle-orange hover:text-carbon-blue"
                      >
                        Add company
                      </button>
                    ) : null}
                  </article>
                ))}
              </div>
            </section>

            <section className={WORKSPACE_PANEL_SURFACE}>
              <p className={EDITORIAL_LABEL}>Signal contacts</p>
              <p className={`mt-1 ${EDITORIAL_META}`}>Activities affecting event outreach only.</p>
              <div className="mt-4 space-y-3">
                {workspace.contacts.map((contact) => (
                  <ContactRow
                    key={contact.id}
                    contact={contact}
                    onAddContact={() => handleAddContact(contact)}
                    onCreateActivity={() => handleCreateActivity(contact)}
                    onStatusChange={(status) => handleContactStatus(contact.id, status)}
                  />
                ))}
              </div>
            </section>
          </>
        }
        context={
          <div className="space-y-5">
            <section className={WORKSPACE_PANEL_SURFACE}>
              <p className={EDITORIAL_LABEL}>Event intelligence</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <ContextMetric label="Recommendation" value={workspace.event.recommendation} />
                <ContextMetric label="Planning" value={workspace.event.planningStatus.replace(/_/g, " ")} />
                <ContextMetric label="Audience" value={workspace.event.audienceQuality} />
                <ContextMetric label="Decision makers" value={workspace.event.decisionMakerDensity} />
                <ContextMetric label="Cost" value={workspace.event.estimatedCost} />
                <ContextMetric label="Return potential" value={workspace.event.returnPotential} />
              </div>
              {workspace.event.competitivePresence.length > 0 ? (
                <p className={`mt-4 ${EDITORIAL_META}`}>
                  Competitive presence: {workspace.event.competitivePresence.join(" · ")}
                </p>
              ) : null}
              <div className="mt-4 border-l-2 border-upcycle-orange/30 pl-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-upcycle-orange/80">
                  Why this event matters
                </p>
                <ul className="mt-2 space-y-1">
                  {workspace.event.impact.map((item) => (
                    <li key={item} className={`${EDITORIAL_META}`}>
                      · {item}
                    </li>
                  ))}
                </ul>
              </div>
            </section>

            <section className={WORKSPACE_PANEL_SURFACE}>
              <p className={EDITORIAL_LABEL}>What should happen next</p>
              <ul className="mt-3 space-y-2">
                {workspace.nextActions.map((action) => (
                  <li key={action} className={`${EDITORIAL_BODY}`}>
                    → {action}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        }
      />
    </div>
  );
}

function TrackingMetric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className={EDITORIAL_FIELD_LABEL}>{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums text-carbon-blue">{value}</p>
    </div>
  );
}

function ContextMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className={EDITORIAL_FIELD_LABEL}>{label}</p>
      <p className={`mt-0.5 ${EDITORIAL_BODY}`}>{value}</p>
    </div>
  );
}

function DiscoveryLinks({ discovery }: { discovery: EventContactDiscovery }) {
  const links = [
    discovery.website ? { label: "Website", href: discovery.website } : null,
    discovery.contactPageUrl ? { label: "Contact page", href: discovery.contactPageUrl } : null,
    discovery.email ? { label: discovery.email, href: m365ComposeHref(discovery.email) } : null,
    discovery.linkedInUrl ? { label: "LinkedIn", href: discovery.linkedInUrl } : null,
    discovery.phone ? { label: discovery.phone, href: telHref(discovery.phone) } : null,
  ].filter(Boolean) as Array<{ label: string; href: string }>;

  if (links.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-3">
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-carbon-blue/50 hover:text-upcycle-orange"
        >
          {link.label.includes("@") ? <Mail className="size-3" /> : null}
          {link.label.startsWith("+") ? <Phone className="size-3" /> : null}
          {link.label}
          <ExternalLink className="size-2.5 opacity-50" />
        </a>
      ))}
    </div>
  );
}

function RecommendationCard({
  recommendation,
  contact,
  onDraftOutreach,
  onCreateActivity,
  onRequestMeeting,
  onScheduleMeeting,
}: {
  recommendation: EventOutreachRecommendation;
  contact?: EventPlanningContact;
  onDraftOutreach: () => void;
  onCreateActivity: () => void;
  onRequestMeeting: () => void;
  onScheduleMeeting: () => void;
}) {
  const hasEmail = Boolean(contact?.discovery.email && recommendation.emailBody);

  return (
    <article className="border border-carbon-blue/10 bg-carbon-blue/[0.02] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[15px] font-medium text-carbon-blue">
            {recommendation.contactName}
          </p>
          <p className={`mt-0.5 ${EDITORIAL_META}`}>{recommendation.companyName}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold text-carbon-blue/35">#{recommendation.priority}</span>
          <SmartAssistConfidenceLabel confidence={recommendation.confidence} />
        </div>
      </div>

      <p className={`mt-3 ${EDITORIAL_BODY}`}>
        <span className="text-carbon-blue/40">Why: </span>
        {recommendation.whyContact}
      </p>

      <div className="mt-3">
        <p className={EDITORIAL_FIELD_LABEL}>Suggested discussion topics</p>
        <ul className="mt-1 space-y-0.5">
          {recommendation.discussionTopics.map((topic) => (
            <li key={topic} className={`${EDITORIAL_META}`}>
              · {topic}
            </li>
          ))}
        </ul>
      </div>

      {contact ? <DiscoveryLinks discovery={contact.discovery} /> : null}

      <div className="mt-4 flex flex-wrap gap-3">
        {hasEmail ? (
          <ActionButton onClick={onDraftOutreach}>Draft outreach</ActionButton>
        ) : null}
        <ActionButton onClick={onCreateActivity}>Create activity</ActionButton>
        <ActionButton onClick={onRequestMeeting}>Meeting requested</ActionButton>
        <ActionButton onClick={onScheduleMeeting}>Meeting scheduled</ActionButton>
      </div>
    </article>
  );
}

function ContactRow({
  contact,
  onAddContact,
  onCreateActivity,
  onStatusChange,
}: {
  contact: EventPlanningContact;
  onAddContact: () => void;
  onCreateActivity: () => void;
  onStatusChange: (status: EventPlanningContact["status"]) => void;
}) {
  return (
    <article className="border border-carbon-blue/8 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[13px] font-medium text-carbon-blue">{contact.name}</p>
          <p className={`mt-0.5 ${EDITORIAL_META}`}>
            {contact.companyName}
            {contact.jobTitle ? ` · ${contact.jobTitle}` : ""}
          </p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider ${PRIORITY_STYLES[contact.priority]}`}>
          {contact.priority}
        </span>
      </div>
      <p className={`mt-2 ${EDITORIAL_META}`}>{contact.whyRelevant}</p>
      <p className={`mt-1 ${EDITORIAL_META}`}>
        Status: {STATUS_LABELS[contact.status]}
        {contact.inCrm ? " · In CRM" : " · Not in CRM"}
      </p>
      <DiscoveryLinks discovery={contact.discovery} />
      <div className="mt-3 flex flex-wrap gap-3">
        {!contact.inCrm ? <ActionButton onClick={onAddContact}>Add contact</ActionButton> : null}
        <ActionButton onClick={onCreateActivity}>Create activity</ActionButton>
        {contact.status === "identified" ? (
          <ActionButton onClick={() => onStatusChange("meeting_requested")}>
            Meeting requested
          </ActionButton>
        ) : null}
        {contact.status !== "meeting_scheduled" ? (
          <ActionButton onClick={() => onStatusChange("meeting_scheduled")}>
            Meeting scheduled
          </ActionButton>
        ) : null}
      </div>
    </article>
  );
}

function ActionButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[12px] font-medium text-upcycle-orange transition-colors hover:text-carbon-blue"
    >
      {children}
    </button>
  );
}

export { eventPlanningHref };
