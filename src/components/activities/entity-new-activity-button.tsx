"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
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

export function EntityNewActivityButton({
  context,
  companies,
  pipelines,
  assignableUsers = [],
  className,
  label = "New activity",
  showNewTask = true,
}: {
  context: ActivityWorkspaceContext;
  companies: Company[];
  pipelines: PipelineRow[];
  assignableUsers?: StandardBioUserRecord[];
  className?: string;
  label?: string;
  showNewTask?: boolean;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

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
