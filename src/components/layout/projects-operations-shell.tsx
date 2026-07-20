"use client";

import { useMemo, useState } from "react";
import { RoleSwitcher } from "@/components/auth/role-switcher";
import { ProjectsDirectory } from "@/components/project/projects-directory";
import { ProjectCreateButton } from "@/components/project/project-create-button";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { WorkspaceMain, WorkspaceStack } from "@/components/ui/workspace-main";
import { SmartCRMIcon } from "@/components/ui/smartcrm-icon";
import { PROJECT_WORKSPACE_LIGHT } from "@/lib/smart-assist-config";
import type { Project, ProjectKind } from "@/types/project";
import { PROJECT_KIND_LABELS } from "@/types/project";
import type { FilterDefinition, WorkspaceFilterValues } from "@/types/workspace-filters";
import { normalizeMultiFilter, normalizeSingleFilter } from "@/types/workspace-filters";

const DEFAULT_FILTERS: WorkspaceFilterValues = {
  kind: [],
  status: [],
  health: "all",
};

const KIND_OPTIONS = (Object.keys(PROJECT_KIND_LABELS) as ProjectKind[]).map((kind) => ({
  value: kind,
  label: PROJECT_KIND_LABELS[kind],
}));

const STATUS_OPTIONS = ["Planning", "Active", "On Hold", "At Risk", "Completed"].map((status) => ({
  value: status,
  label: status,
}));

const HEALTH_OPTIONS = [
  { value: "all", label: "All Health" },
  { value: "Healthy", label: "Healthy" },
  { value: "Needs Attention", label: "Needs Attention" },
  { value: "At Risk", label: "At Risk" },
];

function filterProjects(
  projects: Project[],
  filters: WorkspaceFilterValues,
  search: string,
): Project[] {
  const kinds = normalizeMultiFilter(filters.kind);
  const statuses = normalizeMultiFilter(filters.status);
  const health = normalizeSingleFilter(filters.health);

  const query = search.trim().toLowerCase();

  return projects.filter((project) => {
    if (kinds.length > 0 && !kinds.includes(project.kind)) return false;
    if (statuses.length > 0 && !statuses.includes(project.status)) return false;
    if (health !== "all" && project.health !== health) return false;
    if (!query) return true;

    return (
      project.name.toLowerCase().includes(query) ||
      project.owner.toLowerCase().includes(query) ||
      project.objective.toLowerCase().includes(query)
    );
  });
}

export function ProjectsOperationsShell({ projects }: { projects: Project[] }) {
  const [filters, setFilters] = useState<WorkspaceFilterValues>(DEFAULT_FILTERS);
  const [search, setSearch] = useState("");

  const filterDefinitions: FilterDefinition[] = useMemo(
    () => [
      {
        id: "kind",
        label: "Type",
        mode: "multi",
        options: KIND_OPTIONS,
      },
      {
        id: "status",
        label: "Status",
        mode: "multi",
        options: STATUS_OPTIONS,
      },
      {
        id: "health",
        label: "Health",
        mode: "single",
        emptyValue: "all",
        options: HEALTH_OPTIONS,
      },
    ],
    [],
  );

  const handleFilterChange = (id: string, value: string | string[]) => {
    setFilters((current) => ({ ...current, [id]: value }));
  };

  const handleClearAllFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSearch("");
  };

  const visibleProjects = useMemo(
    () => filterProjects(projects, filters, search),
    [projects, filters, search],
  );

  return (
    <WorkspaceChrome>
      <header className="sticky top-0 z-10 flex h-11 shrink-0 items-center justify-between border-b border-carbon-blue/8 bg-[var(--dashboard-surface)]/95 px-4 backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2 truncate text-[11px] text-carbon-blue/50">
          <SmartCRMIcon name="project" size="xs" />
          <span className="font-medium text-carbon-blue/70">Projects</span>
        </div>
        <RoleSwitcher />
      </header>

      <WorkspaceMain>
        <WorkspaceStack>
          <div className="flex flex-wrap items-start justify-between gap-4 border border-carbon-blue/10 bg-white p-4 lg:p-5">
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight text-carbon-blue">
                <SmartCRMIcon name="project" size="lg" label="Projects" />
                Project Workspace
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-carbon-blue/65">
                {PROJECT_WORKSPACE_LIGHT.description}
              </p>
              <p className="mt-1 text-[11px] text-carbon-blue/40">{PROJECT_WORKSPACE_LIGHT.mantra}</p>
            </div>
            <ProjectCreateButton />
          </div>

          <FilterToolbar
            filters={filterDefinitions}
            values={filters}
            onChange={handleFilterChange}
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search projects…"
            entityLabel="Projects"
            totalCount={projects.length}
            filteredCount={visibleProjects.length}
            defaultValues={DEFAULT_FILTERS}
            onClearAll={handleClearAllFilters}
          />

          <ProjectsDirectory projects={visibleProjects} />
        </WorkspaceStack>
      </WorkspaceMain>
    </WorkspaceChrome>
  );
}
