"use client";

import { useCallback, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { ActivityCreateWizard } from "@/components/activities/activity-create-wizard";
import { TaskCreateModal } from "@/components/activities/task-create-modal";
import { useAuth } from "@/context/auth-context";
import type {
  ActivityWorkspaceContext,
  CreateActivityInput,
} from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { StandardBioUserRecord } from "@/types/user-access";
import { workspaceDocumentsHref } from "@/types/relationship-navigation";

function contextPreset(
  context: ActivityWorkspaceContext,
): Partial<CreateActivityInput> {
  return {
    Company: context.companyId ? { CompanyID: context.companyId } : null,
    Contact: context.contactId ? { ContactID: context.contactId } : null,
    Deal: context.dealId ? { DealID: context.dealId } : null,
    ProjectId: context.projectId ?? null,
    ProjectName: context.projectName ?? null,
  };
}

const DEFAULT_BUTTON_CLASS =
  "inline-flex shrink-0 items-center gap-1.5 border border-upcycle-orange/30 bg-upcycle-orange px-3 py-1.5 text-[11px] font-semibold text-white transition-colors hover:bg-upcycle-orange/90";

const SECONDARY_BUTTON_CLASS =
  "inline-flex shrink-0 items-center gap-1.5 border border-carbon-blue/15 bg-white px-3 py-1.5 text-[11px] font-semibold text-carbon-blue transition-colors hover:border-upcycle-orange hover:text-upcycle-orange";

function openSamePageDocumentsHash(href: string, event: MouseEvent<HTMLAnchorElement>) {
  if (typeof window === "undefined") return;
  let next: URL;
  try {
    next = new URL(href, window.location.origin);
  } catch {
    return;
  }
  if (next.pathname !== window.location.pathname) return;
  if (next.search && next.search !== window.location.search) return;
  if (!next.hash) return;

  event.preventDefault();
  const id = next.hash.replace(/^#/, "");
  if (window.location.hash !== next.hash) {
    window.location.hash = next.hash;
  } else {
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }
  window.requestAnimationFrame(() => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

export function EntityNewActivityButton({
  context,
  companies,
  pipelines,
  assignableUsers = [],
  className,
  label = "New activity",
  showNewTask = true,
  documentCount,
}: {
  context: ActivityWorkspaceContext;
  companies: Company[];
  pipelines: PipelineRow[];
  assignableUsers?: StandardBioUserRecord[];
  className?: string;
  label?: string;
  showNewTask?: boolean;
  documentCount?: number;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const documentsHref = workspaceDocumentsHref(context);

  const handleCreated = useCallback(() => {
    setOpen(false);
    setTaskOpen(false);
    router.refresh();
  }, [router]);

  return (
    <>
      <div className="inline-flex shrink-0 flex-wrap items-center gap-2">
        {showNewTask ? (
          <button
            type="button"
            onClick={() => setTaskOpen(true)}
            className={SECONDARY_BUTTON_CLASS}
          >
            <Plus className="size-3.5" strokeWidth={2} aria-hidden />
            New Task
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={className ?? DEFAULT_BUTTON_CLASS}
        >
          <Plus className="size-3.5" strokeWidth={2} aria-hidden />
          {label}
        </button>
        {documentsHref ? (
          <Link
            href={documentsHref}
            className={SECONDARY_BUTTON_CLASS}
            onClick={(event) => openSamePageDocumentsHash(documentsHref, event)}
          >
            <FileText className="size-3.5" strokeWidth={2} aria-hidden />
            Documents
            {typeof documentCount === "number" && documentCount > 0 ? (
              <span className="text-carbon-blue/45">{documentCount}</span>
            ) : null}
          </Link>
        ) : null}
      </div>
      <ActivityCreateWizard
        open={open}
        onClose={() => setOpen(false)}
        onCreated={handleCreated}
        companies={companies}
        pipelines={pipelines}
        preset={contextPreset(context)}
        defaultOwner={user}
        assignableUsers={assignableUsers}
      />
      <TaskCreateModal
        open={taskOpen}
        onClose={() => setTaskOpen(false)}
        onCreated={handleCreated}
        companies={companies}
        pipelines={pipelines}
        assignableUsers={assignableUsers}
        preset={contextPreset(context)}
        defaultOwner={user}
      />
    </>
  );
}
