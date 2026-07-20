import type { WorkspaceFilterId, WorkspaceFilterIntent, WorkspaceFilterValues } from "@/types/workspace-filters";

const STORAGE_KEY = "smartcrm-workspace-filters";

export function stashWorkspaceFilters(intent: WorkspaceFilterIntent): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
}

export function consumeWorkspaceFilters(workspace: WorkspaceFilterId): WorkspaceFilterIntent | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WorkspaceFilterIntent;
    if (parsed.workspace !== workspace) return null;
    sessionStorage.removeItem(STORAGE_KEY);
    return parsed;
  } catch {
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function buildFilterUrl(
  basePath: string,
  intent: WorkspaceFilterIntent,
): string {
  const params = new URLSearchParams();
  if (intent.search) params.set("q", intent.search);
  if (intent.owner && intent.owner !== "all") params.set("owner", intent.owner);
  for (const [key, value] of Object.entries(intent.filters)) {
    if (Array.isArray(value)) {
      if (value.length > 0) params.set(key, value.join(","));
    } else if (value && value !== "all" && value !== "") {
      params.set(key, value);
    }
  }
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export function parseFilterParams(
  searchParams: URLSearchParams,
  filterKeys: string[],
): { filters: WorkspaceFilterValues; search: string; owner: string } {
  const filters: WorkspaceFilterValues = {};
  for (const key of filterKeys) {
    const raw = searchParams.get(key);
    if (!raw) continue;
    if (raw.includes(",")) {
      filters[key] = raw.split(",").filter(Boolean);
    } else {
      filters[key] = raw;
    }
  }
  return {
    filters,
    search: searchParams.get("q") ?? "",
    owner: searchParams.get("owner") ?? "all",
  };
}

type NlFilterRule = {
  patterns: (string | RegExp)[];
  workspace: WorkspaceFilterId;
  path: string;
  filters: WorkspaceFilterValues;
  search?: string;
  summary: string;
};

const NL_FILTER_RULES: NlFilterRule[] = [
  {
    patterns: ["companies needing attention", "accounts needing attention", "show needs attention companies"],
    workspace: "companies",
    path: "/companies",
    filters: { view: "needs_attention" },
    summary: "Filtering companies that need attention.",
  },
  {
    patterns: ["my companies", "show my companies", "my accounts"],
    workspace: "companies",
    path: "/companies",
    filters: { view: "my_companies" },
    summary: "Showing your companies.",
  },
  {
    patterns: ["no recent activity", "inactive companies", "cold accounts"],
    workspace: "companies",
    path: "/companies",
    filters: { view: "no_recent_activity" },
    summary: "Filtering companies with no recent activity.",
  },
  {
    patterns: ["my opportunities", "my deals", "my pipeline"],
    workspace: "opportunities",
    path: "/opportunities",
    filters: { view: "my_opportunities" },
    summary: "Showing your opportunities.",
  },
  {
    patterns: ["closing soon", "closing this month", "deals closing"],
    workspace: "opportunities",
    path: "/opportunities",
    filters: { view: "closing_soon" },
    summary: "Filtering opportunities closing soon.",
  },
  {
    patterns: ["high value opportunit", "high value deals", "large deals"],
    workspace: "opportunities",
    path: "/opportunities",
    filters: { view: "high_value" },
    summary: "Filtering high-value opportunities.",
  },
  {
    patterns: ["needs attention opportunit", "at risk deals", "deals at risk"],
    workspace: "opportunities",
    path: "/opportunities",
    filters: { view: "needs_attention" },
    summary: "Filtering opportunities that need attention.",
  },
  {
    patterns: ["pursue opportunit", "cvm pursue", "best opportunit to pursue"],
    workspace: "cvm",
    path: "/opportunities",
    filters: { cvm: "pursue" },
    summary: "Filtering CVM pursue recommendations.",
  },
  {
    patterns: ["overdue activit", "overdue follow", "past due"],
    workspace: "activities",
    path: "/activities",
    filters: { view: "overdue" },
    summary: "Showing overdue activities.",
  },
  {
    patterns: ["my activit", "activities assigned to me"],
    workspace: "activities",
    path: "/activities",
    filters: { view: "mine" },
    summary: "Showing your activities.",
  },
  {
    patterns: ["planned activit", "upcoming activit"],
    workspace: "activities",
    path: "/activities",
    filters: { view: "planned" },
    summary: "Showing planned activities.",
  },
  {
    patterns: ["this week", "activities this week"],
    workspace: "activities",
    path: "/activities",
    filters: { view: "this_week" },
    summary: "Showing activities this week.",
  },
  {
    patterns: ["document gaps", "missing documents", "knowledge gaps", "smartdocs risk"],
    workspace: "smartdocs",
    path: "/knowledge",
    filters: { risk: "at_risk" },
    summary: "Filtering SmartDocs knowledge gaps.",
  },
];

function matchesPattern(text: string, pattern: string | RegExp): boolean {
  if (typeof pattern === "string") return text.includes(pattern);
  return pattern.test(text);
}

export function parseFilterIntentFromNaturalLanguage(
  query: string,
): (WorkspaceFilterIntent & { path: string; summary: string }) | null {
  const q = query.toLowerCase().trim().replace(/\?+$/, "");
  if (!q) return null;

  for (const rule of NL_FILTER_RULES) {
    if (rule.patterns.some((pattern) => matchesPattern(q, pattern))) {
      return {
        workspace: rule.workspace,
        path: rule.path,
        filters: rule.filters,
        search: rule.search,
        summary: rule.summary,
      };
    }
  }
  return null;
}

export function mergeWorkspaceFilterValues(
  current: WorkspaceFilterValues,
  patch: WorkspaceFilterValues,
): WorkspaceFilterValues {
  return { ...current, ...patch };
}
