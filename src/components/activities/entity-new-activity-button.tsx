"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { ActivityCreateWizard } from "@/components/activities/activity-create-wizard";
import { useAuth } from "@/context/auth-context";
import type {
  ActivityWorkspaceContext,
  CreateActivityInput,
} from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";

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

export function EntityNewActivityButton({
  context,
  companies,
  pipelines,
  className,
  label = "New activity",
}: {
  context: ActivityWorkspaceContext;
  companies: Company[];
  pipelines: PipelineRow[];
  className?: string;
  label?: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const handleCreated = useCallback(() => {
    setOpen(false);
    router.refresh();
  }, [router]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={className ?? DEFAULT_BUTTON_CLASS}
      >
        <Plus className="size-3.5" strokeWidth={2} aria-hidden />
        {label}
      </button>
      <ActivityCreateWizard
        open={open}
        onClose={() => setOpen(false)}
        onCreated={handleCreated}
        companies={companies}
        pipelines={pipelines}
        preset={contextPreset(context)}
        defaultOwner={user}
      />
    </>
  );
}
