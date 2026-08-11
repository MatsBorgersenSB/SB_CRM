"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { TaskAssigneeSelect } from "@/components/activities/task-assignee-select";
import { TaskShareWithPicker } from "@/components/activities/task-share-control";
import { useAuth } from "@/context/auth-context";
import { inferM365Targets } from "@/lib/activity-workspace";
import { mergeStandardBioUserOptions } from "@/lib/standard-bio-users";
import { syncActivityCreate } from "@/lib/sync-activity";
import type { AuthUser } from "@/types/auth";
import type { Company, SharePointPerson } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { StandardBioUserRecord } from "@/types/user-access";
import {
  ACTION_STATUSES,
  ACTIVITY_PRIORITIES,
  type ActionStatus,
  type ActivityPriority,
  type CreateActivityInput,
} from "@/types/activity";
import { getContactDisplayName } from "@/types/contact";

type TaskCreateModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  companies: Company[];
  pipelines: PipelineRow[];
  assignableUsers: StandardBioUserRecord[];
  preset?: Partial<CreateActivityInput>;
  defaultOwner?: AuthUser;
};

function extractPresetCompanyId(preset?: Partial<CreateActivityInput>): string {
  const company = preset?.Company;
  if (!company) return "";
  if ("CompanyID" in company) return company.CompanyID;
  return "";
}

function extractPresetContactId(preset?: Partial<CreateActivityInput>): string {
  const contact = preset?.Contact;
  if (!contact) return "";
  if ("ContactID" in contact) return contact.ContactID;
  return "";
}

function extractPresetDealId(preset?: Partial<CreateActivityInput>): string {
  const deal = preset?.Deal;
  if (!deal) return "";
  if ("DealID" in deal) return deal.DealID;
  return deal.Title ?? "";
}

function userToPerson(user: AuthUser): SharePointPerson {
  return { Id: user.id, Title: user.displayName };
}

/**
 * One-screen New Task — title, assignee, due, priority, status, related context.
 */
export function TaskCreateModal({
  open,
  onClose,
  onCreated,
  companies,
  pipelines,
  assignableUsers,
  preset,
  defaultOwner,
}: TaskCreateModalProps) {
  const { user } = useAuth();
  const me = defaultOwner ?? user;

  const assigneeOptions = useMemo(
    () => mergeStandardBioUserOptions(assignableUsers, [userToPerson(me)]),
    [assignableUsers, me],
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState<SharePointPerson | null>(null);
  const [sharedWith, setSharedWith] = useState<SharePointPerson[]>([]);
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<ActivityPriority>("Normal");
  const [status, setStatus] = useState<ActionStatus>("Open");
  const [companyId, setCompanyId] = useState("");
  const [contactId, setContactId] = useState("");
  const [dealId, setDealId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const today = new Date().toISOString().slice(0, 10);
    setTitle(preset?.Subject ?? "");
    setDescription(preset?.ActivityDescription ?? "");
    setAssignee(userToPerson(me));
    setSharedWith(preset?.SharedWith ?? []);
    setDueDate(preset?.ActivityDate?.slice(0, 10) || today);
    setPriority(preset?.Priority ?? "Normal");
    setStatus(preset?.ActionStatus ?? "Open");
    setCompanyId(extractPresetCompanyId(preset));
    setContactId(extractPresetContactId(preset));
    setDealId(extractPresetDealId(preset));
    setProjectId(preset?.ProjectId?.trim() ?? "");
    setProjectName(preset?.ProjectName?.trim() ?? "");
    setError(null);
  }, [open, preset, me]);

  const selectedCompany = companies.find((c) => c.CompanyID === companyId);
  const contacts = selectedCompany?.contacts ?? [];

  const canSave = Boolean(title.trim() && assignee && dueDate);

  const handleDealChange = (id: string) => {
    setDealId(id);
    const company = companies.find((c) => c.pipelineIds.includes(id));
    if (company) setCompanyId(company.CompanyID);
  };

  const handleSubmit = async () => {
    if (!canSave || !assignee) return;
    setBusy(true);
    setError(null);
    try {
      const dueIso = `${dueDate}T09:00:00`;
      await syncActivityCreate({
        ActivityType: "Task",
        ActivityDate: dueIso,
        Subject: title.trim(),
        Summary: title.trim(),
        ActivityDescription:
          description.trim() || `Task assigned to ${assignee.Title}.`,
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
                  contacts.find((c) => c.ContactID === contactId)
                    ? getContactDisplayName(
                        contacts.find((c) => c.ContactID === contactId)!,
                      )
                    : contactId,
              },
            ]
          : [],
        ActivityOwner: assignee,
        SharedWith: sharedWith,
        Priority: priority,
        M365Targets: inferM365Targets("Task"),
        ActionRequired: true,
        NextAction: title.trim(),
        NextActionDate: dueDate,
        ActionStatus: status,
        ActionOutcome: "",
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create task.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-carbon-blue/40 p-4 backdrop-blur-[2px]">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col border border-carbon-blue/15 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-carbon-blue/10 px-4 py-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              New Task
            </p>
            <h2 className="text-sm font-semibold text-carbon-blue">
              What needs to be done, by whom, by when
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border border-carbon-blue/10 p-1.5 text-carbon-blue/50 hover:text-carbon-blue"
          >
            <X className="size-4" />
          </button>
        </header>

        <div className="flex-1 space-y-3 overflow-y-auto p-4">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/40">
              Title <span className="text-thermal-red">*</span>
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              autoFocus
              placeholder="e.g. Send revised quote to Halvor"
              className="mt-1 w-full border border-carbon-blue/15 px-3 py-2 text-sm text-carbon-blue outline-none focus:border-upcycle-orange"
            />
          </label>

          <TaskAssigneeSelect
            value={assignee}
            onChange={setAssignee}
            options={assigneeOptions}
            required
            disabled={busy}
          />

          <TaskShareWithPicker
            value={sharedWith}
            onChange={setSharedWith}
            options={assigneeOptions}
            excludeIds={assignee ? [assignee.Id] : []}
            disabled={busy}
          />

          <div className="grid grid-cols-3 gap-2">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/40">
                Due <span className="text-thermal-red">*</span>
              </span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                className="mt-1 w-full border border-carbon-blue/15 px-2 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/40">
                Priority
              </span>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as ActivityPriority)}
                className="mt-1 w-full border border-carbon-blue/15 px-2 py-2 text-sm"
              >
                {ACTIVITY_PRIORITIES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/40">
                Status
              </span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as ActionStatus)}
                className="mt-1 w-full border border-carbon-blue/15 px-2 py-2 text-sm"
              >
                {ACTION_STATUSES.filter((s) => s !== "Cancelled").map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/40">
              Description
            </span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              placeholder="Context the assignee needs to execute"
              className="mt-1 w-full resize-none border border-carbon-blue/15 px-3 py-2 text-sm"
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/40">
                Company
              </span>
              <select
                value={companyId}
                onChange={(event) => {
                  setCompanyId(event.target.value);
                  setContactId("");
                }}
                className="mt-1 w-full border border-carbon-blue/15 px-2 py-2 text-sm"
              >
                <option value="">—</option>
                {companies.map((company) => (
                  <option key={company.CompanyID} value={company.CompanyID}>
                    {company.Title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/40">
                Contact
              </span>
              <select
                value={contactId}
                onChange={(event) => setContactId(event.target.value)}
                disabled={!companyId}
                className="mt-1 w-full border border-carbon-blue/15 px-2 py-2 text-sm disabled:opacity-50"
              >
                <option value="">—</option>
                {contacts.map((contact) => (
                  <option key={contact.ContactID} value={contact.ContactID}>
                    {getContactDisplayName(contact)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/40">
                Opportunity
              </span>
              <select
                value={dealId}
                onChange={(event) => handleDealChange(event.target.value)}
                className="mt-1 w-full border border-carbon-blue/15 px-2 py-2 text-sm"
              >
                <option value="">—</option>
                {pipelines.map((deal) => (
                  <option key={deal.id} value={deal.id}>
                    {deal.id} — {deal.assetName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {error ? <p className="text-[11px] text-thermal-red">{error}</p> : null}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-carbon-blue/10 px-4 py-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="border border-carbon-blue/15 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/60"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !canSave}
            onClick={() => void handleSubmit()}
            className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? "Creating…" : "Create task"}
          </button>
        </footer>
      </div>
    </div>
  );
}
