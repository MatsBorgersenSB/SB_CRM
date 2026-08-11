"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { ACTIVITY_TYPE_OPTIONS } from "@/components/activities/activity-type-icon";
import type { AuthUser } from "@/types/auth";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type {
  ActivityType,
  CreateActivityInput,
  ActionStatus,
  ActivityPriority,
} from "@/types/activity";
import {
  ACTION_STATUSES,
  ACTIVITY_PRIORITIES,
  TRACKING_STATUSES,
} from "@/types/activity";
import { inferM365Targets } from "@/lib/activity-workspace";
import { syncActivityCreate } from "@/lib/sync-activity";
import { getContactDisplayName } from "@/types/contact";
import {
  parseAgreedActions,
  parseMemoryLines,
} from "@/lib/relationship-memory";
import { ActivityKnowledgeCapturePanel } from "@/components/activities/activity-knowledge-capture-panel";
import { TaskAssigneeSelect } from "@/components/activities/task-assignee-select";
import { TaskShareWithPicker } from "@/components/activities/task-share-control";
import { mergeStandardBioUserOptions } from "@/lib/standard-bio-users";
import type { SmartAssistAssessment } from "@/types/activity";
import type { SharePointPerson } from "@/types/company";
import type { StandardBioUserRecord } from "@/types/user-access";

type WizardStep = 1 | 2 | 3 | 4;
type WizardMode = "plan" | "record";

type ActivityCreateWizardProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  companies: Company[];
  pipelines: PipelineRow[];
  preset?: Partial<CreateActivityInput>;
  defaultOwner?: AuthUser;
  /** Assignable Standard Bio users — required for Task assignee. */
  assignableUsers?: StandardBioUserRecord[];
};

const STEPS = {
  plan: ["Activity type", "Related objects", "Plan details", "Follow-up"],
  record: ["Interaction", "Stakeholders & links", "Knowledge capture", "What happens next"],
} as const;

function combineDateTime(date: string, time: string): string {
  if (!date) return new Date().toISOString();
  if (!time) return `${date}T09:00:00`;
  return `${date}T${time}:00`;
}

function extractPresetCompanyId(
  preset: Partial<CreateActivityInput> | undefined,
): string {
  const company = preset?.Company;
  if (!company) return "";
  if ("CompanyID" in company) return company.CompanyID;
  return "";
}

function extractPresetContactId(
  preset: Partial<CreateActivityInput> | undefined,
): string {
  const contact = preset?.Contact;
  if (!contact) return "";
  if ("ContactID" in contact) return contact.ContactID;
  return "";
}

function extractPresetDealId(preset: Partial<CreateActivityInput> | undefined): string {
  const deal = preset?.Deal;
  if (!deal) return "";
  if ("DealID" in deal) return deal.DealID;
  return deal.Title ?? "";
}

function extractPresetProjectId(preset: Partial<CreateActivityInput> | undefined): string {
  return preset?.ProjectId?.trim() ?? "";
}

export function ActivityCreateWizard({
  open,
  onClose,
  onCreated,
  companies,
  pipelines,
  preset,
  defaultOwner,
  assignableUsers = [],
}: ActivityCreateWizardProps) {
  const [step, setStep] = useState<WizardStep>(1);
  const [mode, setMode] = useState<WizardMode>("plan");
  const [saving, setSaving] = useState(false);
  const [activityType, setActivityType] = useState<ActivityType | "">("");
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [dealId, setDealId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [subject, setSubject] = useState("");
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [keyDecisionsText, setKeyDecisionsText] = useState("");
  const [agreedActionsText, setAgreedActionsText] = useState("");
  const [risksText, setRisksText] = useState("");
  const [planDate, setPlanDate] = useState("");
  const [planTime, setPlanTime] = useState("09:00");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [priority, setPriority] = useState<ActivityPriority>("Normal");
  const [trackingStatus, setTrackingStatus] = useState<ActionStatus>("Planned");
  const [followUp, setFollowUp] = useState(false);
  const [nextAction, setNextAction] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [followUpStatus, setFollowUpStatus] = useState<ActionStatus>("Open");
  const [smartAssistAssessment, setSmartAssistAssessment] =
    useState<SmartAssistAssessment | null>(null);
  const [assignee, setAssignee] = useState<SharePointPerson | null>(null);
  const [sharedWith, setSharedWith] = useState<SharePointPerson[]>([]);

  const assigneeOptions = useMemo(() => {
    const me = defaultOwner
      ? [{ Id: defaultOwner.id, Title: defaultOwner.displayName }]
      : [];
    return mergeStandardBioUserOptions(assignableUsers, me);
  }, [assignableUsers, defaultOwner]);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setMode(preset?.ActionStatus === "Completed" ? "record" : "plan");
    setActivityType(preset?.ActivityType ?? "");
    setCompanyId(extractPresetCompanyId(preset));
    setContactId(extractPresetContactId(preset));
    setDealId(extractPresetDealId(preset));
    setProjectId(extractPresetProjectId(preset));
    setProjectName(preset?.ProjectName?.trim() ?? "");
    setSubject(preset?.Subject ?? "");
    setSummary(preset?.Summary ?? "");
    setNotes(preset?.ActivityDescription ?? "");
    setKeyDecisionsText(
      preset?.KeyDecisions?.join("\n") ?? "",
    );
    setAgreedActionsText(
      preset?.AgreedActions?.map((a) => (a.dueDate ? `${a.text} | ${a.dueDate}` : a.text)).join("\n") ?? "",
    );
    setRisksText(preset?.Risks?.join("\n") ?? "");
    setSmartAssistAssessment(preset?.SmartAssistAssessment ?? null);
    setFollowUp(preset?.ActionRequired ?? false);
    setNextAction(preset?.NextAction ?? "");
    setDueDate(preset?.NextActionDate ?? "");
    setTrackingStatus(preset?.ActionStatus ?? "Planned");
    setFollowUpStatus(preset?.ActionStatus ?? "Open");
    setPriority(preset?.Priority ?? "Normal");
    setDurationMinutes(String(preset?.DurationMinutes ?? 60));
    const today = new Date().toISOString().slice(0, 10);
    setPlanDate(preset?.ActivityDate?.slice(0, 10) ?? today);
    setPlanTime(preset?.ActivityDate?.slice(11, 16) || "09:00");
    setAssignee(
      defaultOwner
        ? { Id: defaultOwner.id, Title: defaultOwner.displayName }
        : preset?.ActivityOwner ?? null,
    );
    setSharedWith(preset?.SharedWith ?? []);
  }, [open, preset, defaultOwner]);

  const selectedCompany = companies.find((c) => c.CompanyID === companyId);
  const contacts = selectedCompany?.contacts ?? [];
  const selectedDeal = pipelines.find((p) => p.id === dealId);
  const selectedContact = contacts.find((c) => c.ContactID === contactId);

  const stepLabels = STEPS[mode];

  const contextLocked = Boolean(extractPresetDealId(preset) || extractPresetProjectId(preset));

  const canNext =
    step === 1
      ? Boolean(activityType)
      : step === 2
        ? Boolean(companyId || contactId || dealId || projectId)
        : step === 3
          ? mode === "plan"
            ? Boolean(subject.trim()) &&
              (activityType !== "Task" || Boolean(assignee))
            : Boolean(subject.trim() && notes.trim())
          : !followUp || Boolean(nextAction.trim());

  const handleDealChange = (id: string) => {
    setDealId(id);
    const company = companies.find((c) => c.pipelineIds.includes(id));
    if (company) setCompanyId(company.CompanyID);
  };

  const handleContactChange = (id: string) => {
    setContactId(id);
    for (const company of companies) {
      const contact = company.contacts.find((c) => c.ContactID === id);
      if (contact) {
        setCompanyId(company.CompanyID);
        break;
      }
    }
  };

  const resetForm = () => {
    setStep(1);
    setActivityType("");
    setCompanyId("");
    setContactId("");
    setDealId("");
    setProjectId("");
    setProjectName("");
    setSubject("");
    setSummary("");
    setNotes("");
    setKeyDecisionsText("");
    setAgreedActionsText("");
    setRisksText("");
    setSmartAssistAssessment(null);
    setFollowUp(false);
    setNextAction("");
    setDueDate("");
    setPlanDate("");
    setPlanTime("09:00");
    setDurationMinutes("60");
    setPriority("Normal");
    setTrackingStatus("Planned");
    setAssignee(
      defaultOwner
        ? { Id: defaultOwner.id, Title: defaultOwner.displayName }
        : null,
    );
    setSharedWith([]);
  };

  const handleSubmit = async () => {
    if (!activityType) return;

    setSaving(true);
    try {
      const activityDate =
        mode === "plan"
          ? combineDateTime(planDate, planTime)
          : new Date().toISOString();

      const owner =
        activityType === "Task"
          ? assignee
          : defaultOwner
            ? { Id: defaultOwner.id, Title: defaultOwner.displayName }
            : null;

      if (activityType === "Task" && !owner) {
        setSaving(false);
        return;
      }

      await syncActivityCreate({
        ActivityType: activityType,
        ActivityDate: activityDate,
        Subject: subject.trim(),
        Summary: summary.trim() || subject.trim(),
        ActivityDescription:
          notes.trim() ||
          (mode === "plan" ? `Planned ${activityType.toLowerCase()}.` : ""),
        KeyDecisions: parseMemoryLines(keyDecisionsText),
        AgreedActions: parseAgreedActions(agreedActionsText),
        Risks: parseMemoryLines(risksText),
        Company: companyId ? { CompanyID: companyId } : null,
        Contact: contactId ? { ContactID: contactId } : null,
        Deal: dealId ? { DealID: dealId } : null,
        ProjectId: projectId || null,
        ProjectName: projectId ? projectName || null : null,
        LinkedDeals: dealId ? [{ Id: 0, Title: dealId }] : [],
        LinkedContacts: contactId
          ? [
              {
                Id: 0,
                Title:
                  contacts.find((c) => c.ContactID === contactId)?.Title ?? contactId,
              },
            ]
          : [],
        ActivityOwner: owner,
        SharedWith: activityType === "Task" ? sharedWith : undefined,
        DurationMinutes: mode === "plan" ? Number(durationMinutes) || undefined : undefined,
        Priority: mode === "plan" ? priority : undefined,
        M365Targets: inferM365Targets(activityType),
        ActionRequired: activityType === "Task" ? true : followUp,
        NextAction:
          activityType === "Task"
            ? subject.trim()
            : followUp
              ? nextAction.trim()
              : "",
        NextActionDate:
          activityType === "Task"
            ? planDate || activityDate.slice(0, 10)
            : followUp
              ? dueDate
              : "",
        ActionStatus: followUp
          ? followUpStatus
          : mode === "plan"
            ? activityType === "Task"
              ? "Open"
              : trackingStatus
            : "Completed",
        ActionOutcome: "",
        SmartAssistAssessment: smartAssistAssessment ?? undefined,
      });
      onCreated();
      onClose();
      resetForm();
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-blue/40 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col border border-carbon-blue/15 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-carbon-blue/10 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              {mode === "plan" ? "Plan activity" : "Record interaction"} · Step {step} of 4
            </p>
            <h2 className="text-sm font-semibold text-carbon-blue">{stepLabels[step - 1]}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-carbon-blue/10 p-1.5 text-carbon-blue/50 transition-colors hover:text-carbon-blue"
          >
            <X className="size-4" />
          </button>
        </header>

        {step === 1 ? (
          <div className="flex gap-2 border-b border-carbon-blue/8 px-4 py-2">
            {(["plan", "record"] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`flex-1 border px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider ${
                  mode === value
                    ? "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange"
                    : "border-carbon-blue/10 text-carbon-blue/45"
                }`}
              >
                {value === "plan" ? "Plan" : "Log"}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto p-4">
          {step === 1 ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {ACTIVITY_TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setActivityType(opt.type)}
                  className={`flex flex-col items-center gap-2 border p-3 text-center transition-all duration-150 ${
                    activityType === opt.type
                      ? "border-upcycle-orange/40 bg-upcycle-orange/[0.06] ring-1 ring-upcycle-orange/20"
                      : "border-carbon-blue/10 hover:border-carbon-blue/20 hover:bg-carbon-blue/[0.02]"
                  }`}
                >
                  <span className="text-xl">{opt.emoji}</span>
                  <span className="text-[10px] font-medium leading-tight text-carbon-blue">
                    {opt.label}
                  </span>
                </button>
              ))}
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-3">
              {contextLocked ? (
                <div className="border border-upcycle-orange/25 bg-upcycle-orange/[0.04] px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-upcycle-orange">
                    Auto-tagged from workspace
                  </p>
                  <p className="mt-1 text-[13px] text-carbon-blue">
                    {projectId
                      ? `Project · ${projectName || projectId}`
                      : dealId
                        ? `Opportunity · ${selectedDeal?.assetName || dealId}`
                        : "Workspace context"}
                  </p>
                </div>
              ) : null}
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  Company
                </span>
                <select
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className="mt-1 w-full border border-carbon-blue/12 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange/40"
                >
                  <option value="">Select company…</option>
                  {companies.map((c) => (
                    <option key={c.CompanyID} value={c.CompanyID}>
                      {c.Title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  Contact
                </span>
                <select
                  value={contactId}
                  onChange={(e) => handleContactChange(e.target.value)}
                  className="mt-1 w-full border border-carbon-blue/12 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange/40"
                >
                  <option value="">Select contact…</option>
                  {(contacts.length ? contacts : companies.flatMap((c) => c.contacts)).map(
                    (c) => (
                      <option key={c.ContactID} value={c.ContactID}>
                        {getContactDisplayName(c)}
                      </option>
                    ),
                  )}
                </select>
              </label>
              {!projectId ? (
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                    Opportunity
                  </span>
                  <select
                    value={dealId}
                    onChange={(e) => handleDealChange(e.target.value)}
                    disabled={Boolean(extractPresetDealId(preset))}
                    className="mt-1 w-full border border-carbon-blue/12 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange/40 disabled:bg-carbon-blue/[0.03] disabled:text-carbon-blue/70"
                  >
                    <option value="">Select opportunity…</option>
                    {pipelines.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id} — {p.assetName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </div>
          ) : null}

          {step === 3 && mode === "plan" ? (
            <div className="grid gap-3">
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  Subject
                </span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="What are you planning?"
                  className="mt-1 w-full border border-carbon-blue/12 px-3 py-2 text-sm font-medium text-carbon-blue outline-none focus:border-upcycle-orange/40"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                    Date
                  </span>
                  <input
                    type="date"
                    value={planDate}
                    onChange={(e) => setPlanDate(e.target.value)}
                    className="mt-1 w-full border border-carbon-blue/12 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange/40"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                    Time
                  </span>
                  <input
                    type="time"
                    value={planTime}
                    onChange={(e) => setPlanTime(e.target.value)}
                    className="mt-1 w-full border border-carbon-blue/12 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange/40"
                  />
                </label>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                    Duration (min)
                  </span>
                  <input
                    type="number"
                    min={15}
                    step={15}
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    className="mt-1 w-full border border-carbon-blue/12 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange/40"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                    Priority
                  </span>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as ActivityPriority)}
                    className="mt-1 w-full border border-carbon-blue/12 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange/40"
                  >
                    {ACTIVITY_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                    Status
                  </span>
                  <select
                    value={trackingStatus}
                    onChange={(e) => setTrackingStatus(e.target.value as ActionStatus)}
                    className="mt-1 w-full border border-carbon-blue/12 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange/40"
                  >
                    {TRACKING_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {activityType === "Task" ? (
                <>
                  <TaskAssigneeSelect
                    value={assignee}
                    onChange={setAssignee}
                    options={assigneeOptions}
                    required
                    disabled={saving}
                  />
                  <TaskShareWithPicker
                    value={sharedWith}
                    onChange={setSharedWith}
                    options={assigneeOptions}
                    excludeIds={assignee ? [assignee.Id] : []}
                    disabled={saving}
                  />
                </>
              ) : null}
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  Notes
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Planning context, agenda, or preparation notes"
                  className="mt-1 w-full resize-none border border-carbon-blue/12 bg-carbon-blue/[0.015] px-3 py-2.5 text-sm text-carbon-blue outline-none focus:border-upcycle-orange/40"
                />
              </label>
              {activityType ? (
                <p className="text-[10px] text-carbon-blue/45">
                  M365 ready:{" "}
                  {Object.entries(inferM365Targets(activityType))
                    .filter(([, enabled]) => enabled)
                    .map(([key]) => key)
                    .join(", ") || "local only"}
                </p>
              ) : null}
            </div>
          ) : null}

          {step === 3 && mode === "record" ? (
            <div className="grid gap-3">
              <ActivityKnowledgeCapturePanel
                activityType={activityType}
                subject={subject}
                company={selectedCompany}
                deal={selectedDeal}
                contactName={selectedContact ? getContactDisplayName(selectedContact) : undefined}
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
                  setSmartAssistAssessment(state.assessment);
                }}
              />
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  Subject
                </span>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief title for this interaction"
                  className="mt-1 w-full border border-carbon-blue/12 px-3 py-2 text-sm font-medium text-carbon-blue outline-none focus:border-upcycle-orange/40"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  Summary
                </span>
                <input
                  type="text"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="One-line memory — visible on the timeline"
                  className="mt-1 w-full border border-carbon-blue/12 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange/40"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  What happened
                </span>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                  placeholder="Full context — what was discussed and observed"
                  className="mt-1 w-full resize-none border border-carbon-blue/12 bg-carbon-blue/[0.015] px-3 py-2.5 text-sm leading-relaxed text-carbon-blue outline-none focus:border-upcycle-orange/40"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  Decisions
                </span>
                <textarea
                  value={keyDecisionsText}
                  onChange={(e) => setKeyDecisionsText(e.target.value)}
                  rows={2}
                  placeholder="Explicit customer decisions — one per line"
                  className="mt-1 w-full resize-none border border-carbon-blue/12 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange/40"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  Commitments
                </span>
                <textarea
                  value={agreedActionsText}
                  onChange={(e) => setAgreedActionsText(e.target.value)}
                  rows={2}
                  placeholder="One commitment per line (optional: text | YYYY-MM-DD)"
                  className="mt-1 w-full resize-none border border-carbon-blue/12 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange/40"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                  Risks
                </span>
                <textarea
                  value={risksText}
                  onChange={(e) => setRisksText(e.target.value)}
                  rows={2}
                  placeholder="Risks or blockers — one per line"
                  className="mt-1 w-full resize-none border border-carbon-blue/12 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange/40"
                />
              </label>
            </div>
          ) : null}

          {step === 4 ? (
            <div className="grid gap-3">
              <label className="flex cursor-pointer items-center gap-3 border border-carbon-blue/10 p-3">
                <input
                  type="checkbox"
                  checked={followUp}
                  onChange={(e) => setFollowUp(e.target.checked)}
                  className="size-4 accent-upcycle-orange"
                />
                <span className="text-sm font-medium text-carbon-blue">
                  Follow-up required
                </span>
              </label>
              {followUp ? (
                <>
                  <label className="block">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                      Next Action
                    </span>
                    <input
                      type="text"
                      value={nextAction}
                      onChange={(e) => setNextAction(e.target.value)}
                      className="mt-1 w-full border border-carbon-blue/12 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange/40"
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                        Due Date
                      </span>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="mt-1 w-full border border-carbon-blue/12 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange/40"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
                        Status
                      </span>
                      <select
                        value={followUpStatus}
                        onChange={(e) => setFollowUpStatus(e.target.value as ActionStatus)}
                        className="mt-1 w-full border border-carbon-blue/12 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange/40"
                      >
                        {ACTION_STATUSES.filter((s) => s !== "Completed").map((s) => (
                          <option key={s} value={s}>
                            {s === "Open" ? "Planned" : s}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                </>
              ) : (
                <p className="text-xs text-carbon-blue/50">
                  {mode === "plan"
                    ? "Activity will be saved with the selected planning status."
                    : "No follow-up needed — this interaction will be logged as complete."}
                </p>
              )}
            </div>
          ) : null}
        </div>

        <footer className="flex items-center justify-between border-t border-carbon-blue/10 px-4 py-3">
          <button
            type="button"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1) as WizardStep)}
            className="inline-flex items-center gap-1 text-xs font-medium text-carbon-blue/60 disabled:opacity-40"
          >
            <ArrowLeft className="size-3.5" />
            Back
          </button>
          {step < 4 ? (
            <button
              type="button"
              disabled={!canNext}
              onClick={() => setStep((s) => Math.min(4, s + 1) as WizardStep)}
              className="inline-flex items-center gap-1 border border-upcycle-orange/30 bg-upcycle-orange/10 px-3 py-1.5 text-xs font-semibold text-upcycle-orange disabled:opacity-40"
            >
              Continue
              <ArrowRight className="size-3.5" />
            </button>
          ) : (
            <button
              type="button"
              disabled={saving || !canNext}
              onClick={() => void handleSubmit()}
              className="border border-upcycle-orange/30 bg-upcycle-orange px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
            >
              {saving ? "Saving…" : mode === "plan" ? "Create Activity" : "Record Interaction"}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
