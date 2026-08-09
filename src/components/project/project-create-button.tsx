"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";
import { AUTH_ROLE_HEADER } from "@/lib/api-auth";
import { canCreateProject } from "@/lib/permissions";
import { project360Href } from "@/types/relationship-navigation";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import type { ProjectKind } from "@/types/project";

const PROJECT_KINDS: Array<{ value: ProjectKind; label: string }> = [
  { value: "internal", label: "Internal development" },
  { value: "customer", label: "Customer project" },
  { value: "strategic", label: "Strategic initiative" },
  { value: "research", label: "Research" },
];

export function ProjectCreateButton() {
  const { user } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<ProjectKind>("internal");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canCreateProject(user.role)) {
    return null;
  }

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          [AUTH_ROLE_HEADER]: user.role,
        },
        body: JSON.stringify({
          name: name.trim(),
          kind,
          owner: user.displayName?.trim() || undefined,
        }),
      });
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Failed to create project");
      }
      const project = (await response.json()) as { id: string };
      router.push(`${project360Href(project.id)}?view=actions&action=questions`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setSaving(false);
    }
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
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Bio4Metal"
              className="mt-1 w-full max-w-md border border-carbon-blue/15 bg-white px-3 py-2 text-[13px]"
            />
          </label>
          <label className="mt-3 block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-carbon-blue/45">
              Type
            </span>
            <select
              value={kind}
              onChange={(event) => setKind(event.target.value as ProjectKind)}
              className="mt-1 w-full max-w-md border border-carbon-blue/15 bg-white px-3 py-2 text-[13px]"
            >
              {PROJECT_KINDS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {error ? <p className="mt-2 text-[12px] text-thermal-red">{error}</p> : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={saving || !name.trim()}
              onClick={() => void handleCreate()}
              className="inline-flex items-center gap-1.5 border border-upcycle-orange bg-upcycle-orange px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              <SmartCRMIcon name="add" size="xs" />
              {saving ? "Creating…" : "Create & discover"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setName("");
                setKind("internal");
                setError(null);
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
