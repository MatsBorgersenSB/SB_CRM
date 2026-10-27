"use client";

import { formatDate } from "@/lib/regional-format-preference";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { ACTIVITY_TYPE_OPTIONS } from "@/components/activities/activity-type-icon";
import type { AuthUser } from "@/types/auth";
import type { Company, SharePointPerson } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type {
  CreateActivityInput,
  ActivityPriority,
  SmartActivityType,
  SmartAssistAssessment,
} from "@/types/activity";
import {
  ACTIVITY_PRIORITIES,
  isAllDayActivityType,
  SMART_ACTIVITY_DISPLAY,
  toSmartActivityType,
} from "@/types/activity";
import { inferM365Targets } from "@/lib/activity-workspace";
import { syncActivityCreate } from "@/lib/sync-activity";
import { getContactDisplayName } from "@/types/contact";
import { parseAgreedActions, parseMemoryLines } from "@/lib/relationship-memory";
import { ActivityKnowledgeCapturePanel } from "@/components/activities/activity-knowledge-capture-panel";
import { SmartAssistResolutionCard } from "@/components/smartassist/SmartAssistResolutionCard";
import type { SmartAssistResolution } from "@/lib/smartassist/omniOrchestrator";
import type { EventProposal } from "@/lib/smartassist/eventExtract";
import { TaskAssigneeSelect } from "@/components/activities/task-assignee-select";
import { TaskShareWithPicker } from "@/components/activities/task-share-control";
import { RegionalDateInput, RegionalTimeInput } from "@/components/ui/regional-inputs";
import { mergeStandardBioUserOptions } from "@/lib/standard-bio-users";
import type { StandardBioUserRecord } from "@/types/user-access";

/**
 * One screen to plan or log any activity.
 *
 * The type is a choice, not a step. The form shows only what that type needs:
 * events ask where and why; tasks ask who and by when; meetings ask when and
 * with whom. SmartAssist can read an event link and propose the details —
 * the person confirms before anything is saved.
 */

type Timing = "planned" | "done";

type ActivityCreateWizardProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  companies: Company[];
  pipelines: PipelineRow[];
  preset?: Partial<CreateActivityInput>;
  defaultOwner?: AuthUser;
  /** Assignable Standard Bio colleagues — who owns this activity. */
  assignableUsers?: StandardBioUserRecord[];
};

const INPUT =
  "mt-1 w-full border border-carbon-blue/12 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange/40 disabled:bg-carbon-blue/[0.03] disabled:text-carbon-blue/70";
const TEXTAREA =
  "mt-1 w-full resize-none border border-carbon-blue/12 bg-carbon-blue/[0.015] px-3 py-2.5 text-sm leading-relaxed text-carbon-blue outline-none focus:border-upcycle-orange/40";
const LABEL = "text-[11px] font-semibold uppercase tracking-wider text-carbon-blue/60";
const SECONDARY_BUTTON =
  "border border-carbon-blue/15 bg-white px-3 py-2 text-left text-xs font-medium text-carbon-blue hover:border-upcycle-orange/40 disabled:opacity-40";

const TITLE_PLACEHOLDER: Record<SmartActivityType, string> = {
  MEETING: "Meeting with…",
  TEAMS_MEETING: "Teams meeting with…",
  PHONE_CALL: "Call about…",
  EMAIL_FOLLOW_UP: "Follow up on…",
  SITE_VISIT: "Visit to…",
  COMMERCIAL_REVIEW: "Review of…",
  TASK: "What needs to be done",
  NOTE: "What to remember",
  TRADESHOW: "Tradeshow or fair name",
  SEMINAR: "Seminar or conference name",
};

function combineDateTime(date: string, time: string): string {
  if (!date) return new Date().toISOString();
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = (time || "09:00").split(":").map(Number);
  if (!year || !month || !day) return new Date().toISOString();
  return new Date(year, month - 1, day, hour || 0, minute || 0, 0, 0).toISOString();
}

function inclusiveDayCount(start: string, end: string): number {
  const [startYear, startMonth, startDay] = start.split("-").map(Number);
  const [endYear, endMonth, endDay] = end.split("-").map(Number);
  if (!startYear || !endYear) return 1;
  const startUtc = Date.UTC(startYear, (startMonth || 1) - 1, startDay || 1);
  const endUtc = Date.UTC(endYear, (endMonth || 1) - 1, endDay || 1);
  return Math.max(1, Math.round((endUtc - startUtc) / 86_400_000) + 1);
}

function presetCompanyId(preset?: Partial<CreateActivityInput>): string {
  const company = preset?.Company;
  return company && "CompanyID" in company ? company.CompanyID : "";
}

function presetContactId(preset?: Partial<CreateActivityInput>): string {
  const contact = preset?.Contact;
  return contact && "ContactID" in contact ? contact.ContactID : "";
}

function presetContactIds(preset?: Partial<CreateActivityInput>): string[] {
  const primary = presetContactId(preset);
  const extras = (preset?.Stakeholders ?? [])
    .map((person) => person.contactId?.trim())
    .filter((id): id is string => Boolean(id));
  return [...new Set([primary, ...extras].filter(Boolean))];
}

function presetDealId(preset?: Partial<CreateActivityInput>): string {
  const deal = preset?.Deal;
  if (!deal) return "";
  return "DealID" in deal ? deal.DealID : (deal.Title ?? "");
}

function formatProposalDates(proposal: EventProposal): string {
  if (!proposal.startDate) return "Dates not found";
  const fmt = (value: string) =>
    formatDate(new Date(`${value}T00:00:00`));
  if (!proposal.endDate || proposal.endDate === proposal.startDate) return fmt(proposal.startDate);
  return `${fmt(proposal.startDate)} – ${fmt(proposal.endDate)}`;
}

/** One form for every activity. Mounted only while open, so each opening starts clean. */
export function ActivityCreateWizard({ open, ...props }: ActivityCreateWizardProps) {
  if (!open) return null;
  return <ActivityForm {...props} />;
}

function ActivityForm({
  onClose,
  onCreated,
  companies,
  pipelines,
  preset,
  defaultOwner,
  assignableUsers = [],
}: Omit<ActivityCreateWizardProps, "open">) {
  const me = useMemo<SharePointPerson | null>(
    () => (defaultOwner ? { Id: defaultOwner.id, Title: defaultOwner.displayName } : null),
    [defaultOwner],
  );
  const presetDate = preset?.ActivityDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [activityType, setActivityType] = useState<SmartActivityType>(
    () => toSmartActivityType(preset?.ActivityType) || "MEETING",
  );
  const [timing, setTiming] = useState<Timing>(
    preset?.ActionStatus === "Completed" ? "done" : "planned",
  );

  const [title, setTitle] = useState(preset?.Subject ?? "");
  const [notes, setNotes] = useState(preset?.ActivityDescription ?? "");
  const [date, setDate] = useState(presetDate);
  const [endDate, setEndDate] = useState(presetDate);
  const [time, setTime] = useState(preset?.ActivityDate?.slice(11, 16) || "09:00");
  const [durationMinutes, setDurationMinutes] = useState(String(preset?.DurationMinutes ?? 60));
  const [priority, setPriority] = useState<ActivityPriority>(preset?.Priority ?? "Normal");

  const [companyId, setCompanyId] = useState(() => presetCompanyId(preset));
  const [contactIds, setContactIds] = useState(() => presetContactIds(preset));
  const [dealId, setDealId] = useState(() => presetDealId(preset));
  // Project context comes from the caller (project workspace); the form does not change it.
  const projectId = preset?.ProjectId?.trim() ?? "";
  const projectName = preset?.ProjectName?.trim() ?? "";

  const [assignee, setAssignee] = useState<SharePointPerson | null>(
    me ?? preset?.ActivityOwner ?? null,
  );
  const [sharedWith, setSharedWith] = useState<SharePointPerson[]>(preset?.SharedWith ?? []);

  const [followUp, setFollowUp] = useState(preset?.ActionRequired ?? false);
  const [nextAction, setNextAction] = useState(preset?.NextAction ?? "");
  const [dueDate, setDueDate] = useState(preset?.NextActionDate ?? "");

  // Logged interactions: what we learned.
  const [summary, setSummary] = useState(preset?.Summary ?? "");
  const [keyDecisionsText, setKeyDecisionsText] = useState(preset?.KeyDecisions?.join("\n") ?? "");
  const [agreedActionsText, setAgreedActionsText] = useState(
    () =>
      preset?.AgreedActions?.map((a) => (a.dueDate ? `${a.text} | ${a.dueDate}` : a.text)).join("\n") ??
      "",
  );
  const [risksText, setRisksText] = useState(preset?.Risks?.join("\n") ?? "");
  const [assessment, setAssessment] = useState<SmartAssistAssessment | null>(
    preset?.SmartAssistAssessment ?? null,
  );

  // Events: where it is and what SmartAssist read.
  const [eventSource, setEventSource] = useState("");
  const [eventProposal, setEventProposal] = useState<EventProposal | null>(null);
  const [eventReading, setEventReading] = useState(false);
  const [eventError, setEventError] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventWebsite, setEventWebsite] = useState("");
  const [eventOrganizer, setEventOrganizer] = useState("");
  const [eventThemes, setEventThemes] = useState<string[]>([]);
  const [eventFromAssist, setEventFromAssist] = useState(false);

  // Context and suppliers for unlinked work.
  const [resolution, setResolution] = useState<SmartAssistResolution | null>(null);
  const [resolving, setResolving] = useState(false);

  const isEvent = isAllDayActivityType(activityType);
  const isTask = activityType === "TASK";
  const displayType = SMART_ACTIVITY_DISPLAY[activityType];
  const contextLocked = Boolean(presetDealId(preset) || preset?.ProjectId?.trim());

  const assigneeOptions = useMemo(
    () => mergeStandardBioUserOptions(assignableUsers, me ? [me] : []),
    [assignableUsers, me],
  );

  const selectedCompany = companies.find((c) => c.CompanyID === companyId);
  const contacts = selectedCompany?.contacts ?? [];
  const selectedDeal = pipelines.find((p) => p.id === dealId);
  const contactPool = companies.flatMap((company) => company.contacts);
  const selectedContacts = contactIds
    .map((id) => contactPool.find((contact) => contact.ContactID === id))
    .filter((contact): contact is NonNullable<typeof contact> => Boolean(contact));
  const addableContacts = (contacts.length ? contacts : contactPool).filter(
    (contact) => !contactIds.includes(contact.ContactID),
  );

  const handleDealChange = (id: string) => {
    setDealId(id);
    const company = companies.find((c) => c.pipelineIds.includes(id));
    if (company) setCompanyId(company.CompanyID);
  };

  const handleAddContact = (id: string) => {
    if (!id || contactIds.includes(id)) return;
    setContactIds((prev) => [...prev, id]);
    if (companyId) return;
    for (const company of companies) {
      if (company.contacts.some((contact) => contact.ContactID === id)) {
        setCompanyId(company.CompanyID);
        break;
      }
    }
  };

  const handleRemoveContact = (id: string) => {
    setContactIds((prev) => prev.filter((contactId) => contactId !== id));
  };

  const handleCompanyChange = (id: string) => {
    setCompanyId(id);
    if (!id) return;
    const allowed = new Set(
      companies.find((company) => company.CompanyID === id)?.contacts.map((contact) => contact.ContactID) ??
        [],
    );
    setContactIds((prev) => prev.filter((contactId) => allowed.has(contactId)));
  };

  const readEventSource = () => {
    const source = eventSource.trim();
    if (!source) return;
    const looksLikeUrl = /^(https?:\/\/)?[\w.-]+\.[a-z]{2,}(\/\S*)?$/i.test(source) && !/\s/.test(source);
    setEventReading(true);
    setEventError("");
    void fetch("/api/smartassist/extract-event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(looksLikeUrl ? { url: source } : { text: source }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as { proposal?: EventProposal; error?: string };
        if (!response.ok || !payload.proposal) throw new Error(payload.error ?? "EXTRACTION_FAILED");
        setEventProposal(payload.proposal);
      })
      .catch((reason: Error) => {
        setEventError(
          reason.message === "NOTHING_FOUND"
            ? "No event name or dates found there. Paste the invitation text, or fill in the details below."
            : "SmartAssist could not read that right now. You can fill in the details below.",
        );
      })
      .finally(() => setEventReading(false));
  };

  const applyEventProposal = (proposal: EventProposal) => {
    if (proposal.title) setTitle(proposal.title);
    if (proposal.startDate) {
      setDate(proposal.startDate);
      setEndDate(proposal.endDate ?? proposal.startDate);
    }
    setEventLocation(proposal.location ?? "");
    setEventWebsite(proposal.website ?? "");
    setEventOrganizer(proposal.organizer ?? "");
    setEventThemes(proposal.themes);
    setNotes((current) => current.trim() || proposal.summary);
    setEventFromAssist(true);
    setEventProposal(null);
  };

  const askSmartAssist = () => {
    const taskDescription = [title, notes].filter((part) => part.trim()).join("\n");
    if (!taskDescription) return;
    setResolving(true);
    void fetch("/api/smartassist/omni-resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskDescription, dateLimit: date || undefined }),
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("resolve failed");
        const payload = (await response.json()) as { resolution?: SmartAssistResolution };
        if (!payload.resolution) throw new Error("empty resolution");
        setResolution(payload.resolution);
      })
      .catch(() => undefined)
      .finally(() => setResolving(false));
  };

  const canSave =
    Boolean(title.trim()) &&
    Boolean(date) &&
    (!isEvent || Boolean(endDate && endDate >= date)) &&
    (!isTask || Boolean(assignee)) &&
    (!followUp || Boolean(nextAction.trim())) &&
    (timing === "planned" || isEvent || Boolean(notes.trim()));

  const handleSubmit = async () => {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      const activityDate = isEvent
        ? combineDateTime(date, "00:00")
        : isTask
          ? combineDateTime(date, "09:00")
          : combineDateTime(date, time);
      const owner = assignee ?? me;
      const eventDetails = isEvent
        ? {
            location: eventLocation.trim() || null,
            website: eventWebsite.trim() || null,
            organizer: eventOrganizer.trim() || null,
            objective: notes.trim() || null,
            themes: eventThemes,
          }
        : null;
      const eventLines = eventDetails
        ? [
            eventDetails.location ? `Where: ${eventDetails.location}` : null,
            eventDetails.organizer ? `Organiser: ${eventDetails.organizer}` : null,
            eventDetails.website ? `Event page: ${eventDetails.website}` : null,
            eventDetails.themes.length ? `Themes: ${eventDetails.themes.join(", ")}` : null,
          ].filter((line): line is string => Boolean(line))
        : [];
      const description = [
        notes.trim() || (timing === "planned" ? `Planned ${displayType.toLowerCase()}.` : ""),
        ...eventLines,
      ]
        .filter(Boolean)
        .join("\n");

      await syncActivityCreate({
        ActivityType: displayType,
        ActivityDate: activityDate,
        Subject: title.trim(),
        Summary: summary.trim() || title.trim(),
        ActivityDescription: description,
        KeyDecisions: parseMemoryLines(keyDecisionsText),
        AgreedActions: parseAgreedActions(agreedActionsText),
        Risks: parseMemoryLines(risksText),
        Company: companyId ? { CompanyID: companyId } : null,
        Contact: contactIds[0] ? { ContactID: contactIds[0] } : null,
        Deal: dealId ? { DealID: dealId } : null,
        ProjectId: projectId || null,
        ProjectName: projectId ? projectName || null : null,
        LinkedDeals: dealId ? [{ Id: 0, Title: dealId }] : [],
        LinkedContacts: selectedContacts.map((contact, index) => ({
          Id: index,
          Title: contact.Title?.trim() || getContactDisplayName(contact),
        })),
        Stakeholders: selectedContacts.map((contact) => ({
          name: contact.Title?.trim() || getContactDisplayName(contact),
          role: contact.JobTitle?.trim() || contact.Role?.trim() || "Meeting attendee",
          contactId: contact.ContactID,
        })),
        ActivityOwner: owner,
        SharedWith: isTask
          ? sharedWith.filter((person) => person.Id !== owner?.Id)
          : undefined,
        DurationMinutes: isEvent
          ? inclusiveDayCount(date, endDate || date) * 24 * 60
          : isTask
            ? undefined
            : Number(durationMinutes) || undefined,
        Priority: priority,
        M365Targets: inferM365Targets(displayType),
        ActionRequired: isTask ? true : followUp,
        NextAction: isTask ? title.trim() : followUp ? nextAction.trim() : "",
        NextActionDate: isTask ? date : followUp ? dueDate : "",
        ActionStatus: timing === "done" ? "Completed" : isTask ? "Open" : "Planned",
        ActionOutcome: "",
        SmartAssistAssessment: assessment ?? undefined,
        EventDetails: eventDetails,
        IsAiProposed: isEvent && eventFromAssist,
      });
      onCreated();
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not save the activity.");
    } finally {
      setSaving(false);
    }
  };

  const showSmartAssistContext =
    timing === "planned" && !isEvent && !companyId && Boolean(title.trim() || notes.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-blue/40 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col border border-carbon-blue/15 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-carbon-blue/10 px-5 py-3">
          <h2 className="text-sm font-semibold text-carbon-blue">
            {timing === "done" ? "Log an activity" : "Plan an activity"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="border border-carbon-blue/10 p-1.5 text-carbon-blue/50 transition-colors hover:text-carbon-blue"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="grid flex-1 gap-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <label className="block">
              <span className={LABEL}>Type</span>
              <select
                value={activityType}
                onChange={(e) => {
                  const next = e.target.value as SmartActivityType;
                  setActivityType(next);
                  if (isAllDayActivityType(next)) setEndDate((current) => current || date);
                }}
                className={INPUT}
              >
                {ACTIVITY_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.type} value={opt.type}>
                    {opt.emoji} {opt.label}
                  </option>
                ))}
              </select>
            </label>
            {isEvent ? null : (
              <div className="block">
                <span className={LABEL}>When</span>
                <div className="mt-1 inline-flex border border-carbon-blue/12">
                  {(["planned", "done"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setTiming(value)}
                      aria-pressed={timing === value}
                      className={`px-3 py-2 text-xs font-medium ${
                        timing === value
                          ? "bg-carbon-blue text-white"
                          : "text-carbon-blue/60 hover:bg-carbon-blue/[0.04]"
                      }`}
                    >
                      {value === "planned" ? "Upcoming" : "Already happened"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {isEvent ? (
            <div className="grid gap-2 border border-carbon-blue/10 bg-carbon-blue/[0.015] p-3">
              <label className="block">
                <span className={LABEL}>Event link or invitation</span>
                <textarea
                  value={eventSource}
                  onChange={(e) => setEventSource(e.target.value)}
                  rows={2}
                  placeholder="Paste the event web address or the invitation text — SmartAssist fills in the name, dates and place"
                  className={TEXTAREA}
                />
              </label>
              {eventProposal ? (
                <div className="border border-carbon-blue/12 bg-white">
                  <div className="border-b border-carbon-blue/8 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-upcycle-orange">
                      SmartAssist found this event
                    </p>
                    <p className="mt-1 text-sm font-semibold text-carbon-blue">
                      {eventProposal.title || "Name not found"}
                    </p>
                    <p className="text-xs text-carbon-blue/70">
                      {formatProposalDates(eventProposal)}
                      {eventProposal.location ? ` · ${eventProposal.location}` : ""}
                    </p>
                    {eventProposal.organizer ? (
                      <p className="text-xs text-carbon-blue/50">Organised by {eventProposal.organizer}</p>
                    ) : null}
                  </div>
                  {eventProposal.summary || eventProposal.themes.length ? (
                    <div className="grid gap-1 px-3 py-2 text-xs text-carbon-blue/80">
                      {eventProposal.summary ? <p>{eventProposal.summary}</p> : null}
                      {eventProposal.themes.length ? (
                        <p className="text-carbon-blue/55">{eventProposal.themes.join(" · ")}</p>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between gap-2 border-t border-carbon-blue/8 px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setEventProposal(null)}
                      className="text-xs text-carbon-blue/50 hover:text-carbon-blue"
                    >
                      Not this
                    </button>
                    <button
                      type="button"
                      onClick={() => applyEventProposal(eventProposal)}
                      className="border border-upcycle-orange/30 bg-upcycle-orange px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Use these details
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  disabled={eventReading || !eventSource.trim()}
                  onClick={readEventSource}
                  className="justify-self-start border border-upcycle-orange/30 bg-upcycle-orange/10 px-3 py-1.5 text-xs font-semibold text-upcycle-orange disabled:opacity-40"
                >
                  {eventReading ? "Reading…" : "Let SmartAssist read it"}
                </button>
              )}
              {eventError ? <p className="text-[12px] text-orange-800">{eventError}</p> : null}
            </div>
          ) : null}

          <label className="block">
            <span className={LABEL}>{isEvent ? "Event name" : "Title"}</span>
            {eventFromAssist ? (
              <span className="ml-2 text-[11px] font-semibold text-upcycle-orange">
                Proposed by SmartAssist — check and adjust
              </span>
            ) : null}
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus={!isEvent}
              placeholder={TITLE_PLACEHOLDER[activityType]}
              className={`${INPUT} font-medium`}
            />
          </label>

          {isEvent ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className={LABEL}>First day</span>
                  <RegionalDateInput
                    value={date}
                    onValueChange={(next) => {
                      setDate(next);
                      setEndDate((current) => (current && current >= next ? current : next));
                    }}
                    className={INPUT}
                  />
                </label>
                <label className="block">
                  <span className={LABEL}>Last day</span>
                  <RegionalDateInput
                    value={endDate}
                    min={date}
                    onValueChange={setEndDate}
                    className={INPUT}
                  />
                </label>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className={LABEL}>Where</span>
                  <input
                    type="text"
                    value={eventLocation}
                    onChange={(e) => setEventLocation(e.target.value)}
                    placeholder="City, Country"
                    className={INPUT}
                  />
                </label>
                <label className="block">
                  <span className={LABEL}>Organiser</span>
                  <input
                    type="text"
                    value={eventOrganizer}
                    onChange={(e) => setEventOrganizer(e.target.value)}
                    placeholder="Who runs it"
                    className={INPUT}
                  />
                </label>
                <label className="block">
                  <span className={LABEL}>Event page</span>
                  <input
                    type="url"
                    value={eventWebsite}
                    onChange={(e) => setEventWebsite(e.target.value)}
                    placeholder="https://"
                    className={INPUT}
                  />
                </label>
              </div>
              <label className="block">
                <span className={LABEL}>Why we go</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Who we want to meet, what we want to learn, what we want to show"
                  className={TEXTAREA}
                />
              </label>
              {eventThemes.length ? (
                <p className="-mt-2 text-[12px] text-carbon-blue/55">Themes · {eventThemes.join(" · ")}</p>
              ) : null}
            </>
          ) : (
            <>
              <div className={`grid gap-3 ${isTask ? "sm:grid-cols-2" : "sm:grid-cols-4"}`}>
                <label className="block">
                  <span className={LABEL}>{isTask ? "Due" : timing === "done" ? "Date" : "Date"}</span>
                  <RegionalDateInput value={date} onValueChange={setDate} className={INPUT} />
                </label>
                {isTask ? null : (
                  <>
                    <label className="block">
                      <span className={LABEL}>Time</span>
                      <RegionalTimeInput value={time} onValueChange={setTime} className={INPUT} />
                    </label>
                    <label className="block">
                      <span className={LABEL}>Minutes</span>
                      <input
                        type="number"
                        min={15}
                        step={15}
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(e.target.value)}
                        className={INPUT}
                      />
                    </label>
                  </>
                )}
                <label className="block">
                  <span className={LABEL}>Priority</span>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as ActivityPriority)}
                    className={INPUT}
                  >
                    {ACTIVITY_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className={`grid gap-3 ${isTask ? "sm:grid-cols-2" : ""}`}>
                <TaskAssigneeSelect
                  value={assignee}
                  onChange={setAssignee}
                  options={assigneeOptions}
                  required={isTask}
                  disabled={saving}
                  label="Assign to"
                />
                {isTask ? (
                  <TaskShareWithPicker
                    value={sharedWith}
                    onChange={setSharedWith}
                    options={assigneeOptions}
                    excludeIds={assignee ? [assignee.Id] : []}
                    disabled={saving}
                  />
                ) : null}
              </div>

              <fieldset className="grid gap-3">
                <legend className={LABEL}>
                  About
                  {contextLocked ? (
                    <span className="ml-2 normal-case tracking-normal text-upcycle-orange">
                      {projectId
                        ? `Project · ${projectName || projectId}`
                        : `Opportunity · ${selectedDeal?.assetName || dealId}`}
                    </span>
                  ) : null}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block">
                    <span className={LABEL}>Company</span>
                    <select
                      value={companyId}
                      onChange={(e) => handleCompanyChange(e.target.value)}
                      disabled={Boolean(presetCompanyId(preset)) && contextLocked}
                      className={INPUT}
                    >
                      <option value="">None</option>
                      {companies.map((c) => (
                        <option key={c.CompanyID} value={c.CompanyID}>
                          {c.Title}
                        </option>
                      ))}
                    </select>
                  </label>
                  {projectId ? null : (
                    <label className="block">
                      <span className={LABEL}>Opportunity</span>
                      <select
                        value={dealId}
                        onChange={(e) => handleDealChange(e.target.value)}
                        disabled={Boolean(presetDealId(preset))}
                        className={INPUT}
                      >
                        <option value="">None</option>
                        {pipelines.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.code ?? p.id} — {p.assetName}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="block sm:col-span-2">
                    <span className={LABEL}>People</span>
                    {selectedContacts.length > 0 ? (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {selectedContacts.map((contact) => {
                          const name = contact.Title?.trim() || getContactDisplayName(contact);
                          return (
                            <span
                              key={contact.ContactID}
                              className="inline-flex items-center gap-1 border border-carbon-blue/12 bg-carbon-blue/[0.03] px-2 py-1 text-xs text-carbon-blue"
                            >
                              {name}
                              <button
                                type="button"
                                onClick={() => handleRemoveContact(contact.ContactID)}
                                className="text-carbon-blue/50 hover:text-carbon-blue"
                                aria-label={`Remove ${name}`}
                              >
                                <X className="size-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    ) : null}
                    <select
                      value=""
                      onChange={(e) => handleAddContact(e.target.value)}
                      className={INPUT}
                    >
                      <option value="">
                        {selectedContacts.length ? "Add another person" : "Add a person"}
                      </option>
                      {addableContacts.map((contact) => (
                        <option key={contact.ContactID} value={contact.ContactID}>
                          {contact.Title?.trim() || getContactDisplayName(contact)}
                          {contact.Email?.trim() ? ` · ${contact.Email.trim()}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </fieldset>

              {timing === "done" ? (
                <ActivityKnowledgeCapturePanel
                  activityType={displayType}
                  subject={title}
                  company={selectedCompany}
                  deal={selectedDeal}
                  contactName={
                    selectedContacts.length
                      ? selectedContacts
                          .map((contact) => contact.Title?.trim() || getContactDisplayName(contact))
                          .join(", ")
                      : undefined
                  }
                  existingNotes={notes}
                  onApply={(state) => {
                    setSummary(state.summary);
                    setNotes(state.notes);
                    setKeyDecisionsText(state.keyDecisionsText);
                    setAgreedActionsText(state.agreedActionsText);
                    setRisksText(state.risksText);
                    setNextAction(state.nextAction);
                    setDueDate(state.dueDate);
                    setFollowUp(state.followUp);
                    setAssessment(state.assessment);
                  }}
                />
              ) : null}

              <label className="block">
                <span className={LABEL}>{timing === "done" ? "What happened" : "Notes"}</span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={timing === "done" ? 4 : 3}
                  placeholder={
                    timing === "done"
                      ? "What was discussed, decided, and observed"
                      : isTask
                        ? "Context the assignee needs"
                        : "Agenda or preparation notes"
                  }
                  className={TEXTAREA}
                />
              </label>

              {timing === "done" ? (
                <details className="group border border-carbon-blue/10">
                  <summary className="cursor-pointer list-none px-3 py-2 text-xs font-semibold text-carbon-blue/70 group-open:border-b group-open:border-carbon-blue/10">
                    What we learned — decisions, commitments, risks
                  </summary>
                  <div className="grid gap-3 p-3">
                    <label className="block">
                      <span className={LABEL}>One-line summary</span>
                      <input
                        type="text"
                        value={summary}
                        onChange={(e) => setSummary(e.target.value)}
                        placeholder="The one thing to remember — shown on the timeline"
                        className={INPUT}
                      />
                    </label>
                    <label className="block">
                      <span className={LABEL}>Decisions</span>
                      <textarea
                        value={keyDecisionsText}
                        onChange={(e) => setKeyDecisionsText(e.target.value)}
                        rows={2}
                        placeholder="One per line"
                        className={TEXTAREA}
                      />
                    </label>
                    <label className="block">
                      <span className={LABEL}>Commitments</span>
                      <textarea
                        value={agreedActionsText}
                        onChange={(e) => setAgreedActionsText(e.target.value)}
                        rows={2}
                        placeholder="One per line — add a date with “ | YYYY-MM-DD”"
                        className={TEXTAREA}
                      />
                    </label>
                    <label className="block">
                      <span className={LABEL}>Risks</span>
                      <textarea
                        value={risksText}
                        onChange={(e) => setRisksText(e.target.value)}
                        rows={2}
                        placeholder="One per line"
                        className={TEXTAREA}
                      />
                    </label>
                  </div>
                </details>
              ) : null}

              {showSmartAssistContext ? (
                resolution ? (
                  <SmartAssistResolutionCard resolution={resolution} onDismiss={() => setResolution(null)} />
                ) : (
                  <button type="button" disabled={resolving} onClick={askSmartAssist} className={SECONDARY_BUTTON}>
                    {resolving ? "Looking through mail, files and Teams…" : "Ask SmartAssist what we already know about this"}
                  </button>
                )
              ) : null}
            </>
          )}

          {isTask ? null : (
            <div className="grid gap-3 border-t border-carbon-blue/8 pt-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-carbon-blue">
                <input
                  type="checkbox"
                  checked={followUp}
                  onChange={(e) => setFollowUp(e.target.checked)}
                  className="size-4 accent-upcycle-orange"
                />
                Needs a follow-up
              </label>
              {followUp ? (
                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                  <label className="block">
                    <span className={LABEL}>Next step</span>
                    <input
                      type="text"
                      value={nextAction}
                      onChange={(e) => setNextAction(e.target.value)}
                      placeholder="What happens next"
                      className={INPUT}
                    />
                  </label>
                  <label className="block">
                    <span className={LABEL}>By</span>
                    <RegionalDateInput value={dueDate} onValueChange={setDueDate} className={INPUT} />
                  </label>
                </div>
              ) : null}
            </div>
          )}

          {error ? <p className="text-[12px] text-orange-800">{error}</p> : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-carbon-blue/10 px-5 py-3">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="border border-carbon-blue/15 px-3 py-1.5 text-xs font-semibold text-carbon-blue/60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !canSave}
            onClick={() => void handleSubmit()}
            className="border border-upcycle-orange/30 bg-upcycle-orange px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            {saving ? "Saving…" : timing === "done" ? "Save" : isEvent ? "Add to calendar" : "Plan"}
          </button>
        </footer>
      </div>
    </div>
  );
}
