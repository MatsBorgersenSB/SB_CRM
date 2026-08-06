"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { AsyncSubmitButton } from "@/components/ui/async-submit-button";
import { useFormSubmitLock } from "@/hooks/use-form-submit-lock";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import { canCreateProject } from "@/lib/permissions";
import { project360Href } from "@/types/relationship-navigation";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";

export function ProjectCreateButton() {
  const { user } = useAuth();
  const router = useRouter();
  const { isSubmitting, runLocked } = useFormSubmitLock();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [duplicateTitle, setDuplicateTitle] = useState<string | null>(null);

  if (!canCreateProject(user.role)) {
    return null;
  }

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    await runLocked(async () => {
      setError(null);
      setDuplicateTitle(null);
      try {
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [AUTH_ROLE_HEADER]: user.role,
          },
          body: JSON.stringify({ name: trimmed }),
        });
        const payload = (await response.json()) as { id?: string; error?: string };
        if (response.status === 409) {
          setDuplicateTitle(trimmed);
          return;
        }
        if (!response.ok || !payload.id) {
          throw new Error(payload.error ?? "Failed to create project");
        }
        router.push(`${project360Href(payload.id)}?view=command`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create project");
      }
    });
  };

  return (
    <div>
      {open ? (
        <div className="border border-carbon-blue/10 bg-carbon-blue/[0.02] p-4">
          <p className="text-[13px] font-medium text-carbon-blue">Start project discovery</p>
          <p className="mt-1 text-[12px] text-carbon-blue/55">
            SmartAssist will ask questions and identify gaps before generating objectives or
            recommendations.
          </p>
          <label className="mt-3 block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
              Project name
            </span>
            <input
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                if (duplicateTitle) setDuplicateTitle(null);
                if (error) setError(null);
              }}
              placeholder="e.g. Site expansion phase 2"
              className="mt-1 w-full max-w-md border border-carbon-blue/15 bg-white px-3 py-2 text-[13px]"
            />
          </label>
          {duplicateTitle ? (
            <div
              className="mt-2 border border-thermal-red/30 bg-thermal-red/5 px-3 py-2 text-[12px] font-medium text-thermal-red"
              role="alert"
            >
              ⚠️ A project named &apos;{duplicateTitle}&apos; already exists. Please enter a unique
              name.
            </div>
          ) : null}
          {error ? <p className="mt-2 text-[12px] text-thermal-red">{error}</p> : null}
          <div className="mt-3 flex gap-2">
            <AsyncSubmitButton
              isSubmitting={isSubmitting}
              disabled={!name.trim()}
              onClick={() => void handleCreate()}
              idleLabel={
                <>
                  <SmartCRMIcon name="add" size="xs" />
                  Create & discover
                </>
              }
              submittingLabel="Creating…"
              className="border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-xs font-semibold text-white"
            />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setName("");
                setError(null);
                setDuplicateTitle(null);
              }}
              className="px-3 py-1.5 text-xs font-semibold text-carbon-blue/55"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 border border-carbon-blue/12 px-3 py-1.5 text-[11px] font-semibold text-carbon-blue/65 hover:border-upcycle-orange/30 hover:text-upcycle-orange"
        >
          <SmartCRMIcon name="add" size="xs" />
          New project
        </button>
      )}
    </div>
  );
}
