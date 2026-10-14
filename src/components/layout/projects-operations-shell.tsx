"use client";

import { useMemo, useState } from "react";
import { ProjectsDirectory } from "@/components/project/projects-directory";
import { ProjectCreateButton } from "@/components/project/project-create-button";
import { WorkspaceChrome } from "@/components/layout/workspace-chrome";
import { FilterToolbar } from "@/components/ui/filter-toolbar";
import { WorkspaceMain, WorkspaceStack } from "@/components/ui/workspace-main";
import { WorkspacePageTitle } from "@/components/ui/workspace-page-title";
import { WorkspaceTopBar } from "@/components/ui/workspace-top-bar";
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
      <WorkspaceTopBar icon="project" title="Projects" />

      <WorkspaceMain>
        <WorkspaceStack>
          <section className="dashboard-card p-4 sm:p-6">
            <WorkspacePageTitle
              icon="project"
              title="Projects"
              subtitle="Work we are delivering or preparing — which account it serves, what stage it is in, and who owns it."
              actions={<ProjectCreateButton />}
            />
          </section>

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
