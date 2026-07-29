"use client";

import { useCallback, useEffect, useState } from "react";
import {
  HEALTH_STATUS_LABELS,
  PROJECT_TYPE_LABELS,
  PROJECT_TYPE_OPTIONS,
  type ExecutionProjectType,
  type StageGateProject,
} from "@/lib/execution/project-generator-types";
import { QualityGateGuardianPanel } from "@/components/execution/QualityGateGuardianPanel";
import { CriticalPathPredictorPanel } from "@/components/execution/CriticalPathPredictorPanel";

type ProjectStageGateViewProps = {
  companyId: string;
  companyName?: string;
  opportunityId?: string;
  className?: string;
};

const HEALTH_STYLES: Record<string, string> = {
  ON_TRACK: "border-emerald-600/30 bg-emerald-50 text-emerald-800",
  AT_RISK: "border-upcycle-orange/30 bg-upcycle-orange/10 text-upcycle-orange",
  DELAYED: "border-thermal-red/30 bg-thermal-red/5 text-thermal-red",
};

export function ProjectStageGateView({
  companyId,
  companyName,
  opportunityId,
  className = "",
}: ProjectStageGateViewProps) {
  const [projects, setProjects] = useState<StageGateProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [advancingId, setAdvancingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [projectType, setProjectType] =
    useState<ExecutionProjectType>("TURNKEY_PLANT");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/generate?companyId=${encodeURIComponent(companyId)}`,
      );
      const body = (await response.json()) as {
        projects?: StageGateProject[];
        error?: string;
      };
      if (!response.ok) {
        setError(body.error ?? "Failed to load stage-gate projects");
        setProjects([]);
        return;
      }
      setProjects(body.projects ?? []);
    } catch {
      setError("Stage-gate workspace unavailable");
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const createProject = async () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Enter a project title");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const response = await fetch("/api/projects/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmed,
          projectType,
          companyId,
          opportunityId: opportunityId ?? null,
        }),
      });
      const body = (await response.json()) as {
        project?: StageGateProject;
        error?: string;
      };
      if (!response.ok || !body.project) {
        setError(body.error ?? "Failed to generate project");
        return;
      }
      setProjects((prev) => [body.project!, ...prev]);
      setTitle("");
      setShowCreate(false);
    } catch {
      setError("Failed to generate project");
    } finally {
      setCreating(false);
    }
  };

  const advance = async (projectId: string) => {
    setAdvancingId(projectId);
    setError(null);
    try {
      const response = await fetch(
        `/api/projects/generate/${encodeURIComponent(projectId)}/advance`,
        { method: "POST" },
      );
      const body = (await response.json()) as {
        project?: StageGateProject;
        error?: string;
      };
      if (!response.ok || !body.project) {
        setError(body.error ?? "Failed to advance stage gate");
        return;
      }
      setProjects((prev) =>
        prev.map((p) => (p.id === projectId ? body.project! : p)),
      );
    } catch {
      setError("Failed to advance stage gate");
    } finally {
      setAdvancingId(null);
    }
  };

  if (loading) {
    return (
      <div className={className}>
        <p className="text-[11px] text-carbon-blue/40">Loading stage-gates…</p>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Execution Intelligence
          </p>
          <p className="text-[13px] font-semibold text-carbon-blue">
            {companyName ?? "Account"} Stage-Gate Workspace
          </p>
          <p className="mt-0.5 text-[11px] text-carbon-blue/50">
            Multi-track templates for turnkey plants, machinery, and internal R&D.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="shrink-0 border border-upcycle-orange/30 bg-upcycle-orange/10 px-2.5 py-1.5 text-[11px] font-semibold text-upcycle-orange hover:bg-upcycle-orange/15"
        >
          {showCreate ? "Cancel" : "New Project"}
        </button>
      </div>

      {showCreate ? (
        <div className="space-y-3 border border-carbon-blue/10 bg-carbon-blue/[0.02] p-3">
          <label className="block">
            <span className="text-[9px] font-semibold uppercase tracking-wider text-carbon-blue/40">
              Title
            </span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Oslo Pyrolysis Plant — EPC"
              className="mt-1 w-full border border-carbon-blue/15 bg-[var(--dashboard-surface)] px-2.5 py-1.5 text-[12px] text-carbon-blue outline-none focus:border-carbon-blue/40"
            />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PROJECT_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setProjectType(opt.id)}
                className={`border px-2.5 py-1.5 text-left text-[11px] ${
                  projectType === opt.id
                    ? "border-upcycle-orange/40 bg-upcycle-orange/10 text-upcycle-orange"
                    : "border-carbon-blue/15 text-carbon-blue/70 hover:border-carbon-blue/25"
                }`}
              >
                <span className="font-semibold">{opt.label}</span>
                <span className="mt-0.5 block text-[10px] opacity-70">
                  {opt.description}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => void createProject()}
            disabled={creating}
            className="border border-carbon-blue bg-carbon-blue px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-carbon-blue/90 disabled:opacity-50"
          >
            {creating ? "Generating…" : "Generate Stage-Gates"}
          </button>
        </div>
      ) : null}

      {error ? <p className="text-[11px] text-thermal-red">{error}</p> : null}

      {projects.length === 0 && !showCreate ? (
        <p className="text-[11px] text-carbon-blue/50">
          No execution projects yet. Generate a stage-gate track to start delivery
          intelligence.
        </p>
      ) : null}

      <div className="space-y-4">
        {projects.map((project) => {
          const allDone = project.milestones.every((m) => m.isCompleted);
          return (
            <div
              key={project.id}
              className="border border-carbon-blue/10 bg-[var(--dashboard-surface)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2 border-b border-carbon-blue/8 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-carbon-blue">
                    {project.title}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <span className="border border-carbon-blue/15 bg-carbon-blue/[0.04] px-1.5 py-0.5 text-[9px] font-semibold text-carbon-blue/65">
                      {PROJECT_TYPE_LABELS[project.projectType]}
                    </span>
                    <span
                      className={`border px-1.5 py-0.5 text-[9px] font-semibold ${HEALTH_STYLES[project.healthStatus] ?? ""}`}
                    >
                      {HEALTH_STATUS_LABELS[project.healthStatus]}
                    </span>
                    {project.trlLevel != null ? (
                      <span className="border border-violet-600/25 bg-violet-50 px-1.5 py-0.5 text-[9px] font-semibold text-violet-800">
                        TRL {project.trlLevel}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1.5 text-[11px] text-carbon-blue/55">
                    Current: {project.currentStage}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void advance(project.id)}
                  disabled={allDone || advancingId === project.id}
                  className="shrink-0 border border-upcycle-orange/30 bg-upcycle-orange/10 px-2.5 py-1.5 text-[10px] font-semibold text-upcycle-orange hover:bg-upcycle-orange/15 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {allDone
                    ? "Complete"
                    : advancingId === project.id
                      ? "Advancing…"
                      : "Advance Stage Gate"}
                </button>
              </div>

              {/* Progress bar */}
              <div className="px-3 pt-3">
                <div className="mb-1 flex items-center justify-between text-[10px] text-carbon-blue/50">
                  <span>Progress</span>
                  <span className="font-semibold">{project.progressPercent}%</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden bg-carbon-blue/10">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{ width: `${project.progressPercent}%` }}
                  />
                </div>
              </div>

              {/* Horizontal milestone track */}
              <div className="overflow-x-auto px-3 py-3">
                <div className="flex min-w-max items-start gap-0">
                  {project.milestones.map((milestone, index) => {
                    const isCurrent = milestone.stage === project.currentStage;
                    return (
                      <div
                        key={milestone.id}
                        className="flex items-start"
                      >
                        <div className="flex w-[7.5rem] flex-col items-center text-center">
                          <div
                            className={`flex h-6 w-6 items-center justify-center border text-[10px] font-bold ${
                              milestone.isCompleted
                                ? "border-emerald-600 bg-emerald-500 text-white"
                                : isCurrent
                                  ? "border-upcycle-orange bg-upcycle-orange/15 text-upcycle-orange"
                                  : "border-carbon-blue/20 bg-carbon-blue/[0.03] text-carbon-blue/40"
                            }`}
                          >
                            {milestone.isCompleted ? "✓" : index + 1}
                          </div>
                          <p
                            className={`mt-1.5 text-[9px] leading-snug ${
                              milestone.isCompleted
                                ? "font-semibold text-emerald-700"
                                : isCurrent
                                  ? "font-semibold text-upcycle-orange"
                                  : "text-carbon-blue/50"
                            }`}
                          >
                            {milestone.title}
                          </p>
                        </div>
                        {index < project.milestones.length - 1 ? (
                          <div
                            className={`mt-3 h-0.5 w-4 shrink-0 ${
                              milestone.isCompleted
                                ? "bg-emerald-500"
                                : "bg-carbon-blue/15"
                            }`}
                          />
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>

              <QualityGateGuardianPanel
                projectId={project.id}
                currentStage={project.currentStage}
                milestones={project.milestones}
                onQualityChanged={() => void load()}
              />
              <CriticalPathPredictorPanel
                projectId={project.id}
                projectTitle={project.title}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
