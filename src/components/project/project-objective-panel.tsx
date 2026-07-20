"use client";

import type { Project } from "@/types/project";
import type { ProjectUnderstanding } from "@/lib/project-discovery-intelligence";
import { projectFieldCategory } from "@/lib/project-discovery-intelligence";
import {
  SmartAssistCategoryBadge,
  SmartAssistConfidenceLabel,
} from "@/components/smartassist/smartassist-intelligence-display";
import type { InsightCategory } from "@/types/smartassist-intelligence";

export function ProjectObjectivePanel({
  project,
  discovery,
}: {
  project: Project;
  discovery?: ProjectUnderstanding;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <ObjectiveBlock
        title="Why does this project exist?"
        body={project.objective}
        category={
          discovery
            ? toInsightCategory(projectFieldCategory("objective", project, discovery))
            : project.objective.trim()
              ? "assumed"
              : "unknown"
        }
        emptyLabel="Not recorded — ask the sponsor and capture the objective here."
      />
      <ObjectiveBlock
        title="What problem are we solving?"
        body={project.problem}
        category={
          discovery
            ? toInsightCategory(projectFieldCategory("problem", project, discovery))
            : project.problem.trim()
              ? "assumed"
              : "unknown"
        }
        emptyLabel="Not recorded — gather from discovery conversation."
      />
      <ObjectiveBlock
        title="What does success look like?"
        body={project.successCriteria}
        category={
          discovery
            ? toInsightCategory(projectFieldCategory("successCriteria", project, discovery))
            : project.successCriteria.trim()
              ? "assumed"
              : "unknown"
        }
        emptyLabel="Not recorded — ask what done looks like."
      />
    </div>
  );
}

function toInsightCategory(
  value: "known" | "assumed" | "unknown",
): InsightCategory {
  if (value === "known") return "known";
  if (value === "assumed") return "assumed";
  return "unknown";
}

function ObjectiveBlock({
  title,
  body,
  category,
  emptyLabel,
}: {
  title: string;
  body: string;
  category: InsightCategory;
  emptyLabel: string;
}) {
  return (
    <div className="border border-carbon-blue/10 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-carbon-blue/40">
          {title}
        </p>
        <SmartAssistCategoryBadge category={category} />
        <SmartAssistConfidenceLabel
          confidence={category === "known" ? "high" : category === "assumed" ? "medium" : "low"}
        />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-carbon-blue/75">
        {body.trim() || emptyLabel}
      </p>
    </div>
  );
}
