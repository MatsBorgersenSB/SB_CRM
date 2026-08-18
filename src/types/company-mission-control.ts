/**
 * Company 360 — single living page (not Overview / Work / Actions).
 * `view` query params are ignored; href still accepts them for old bookmarks.
 */

export const COMPANY_MISSION_CONTROL_VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "work", label: "Work" },
  { id: "actions", label: "Actions" },
] as const;

export type CompanyMissionControlView =
  (typeof COMPANY_MISSION_CONTROL_VIEWS)[number]["id"];

export const DEFAULT_COMPANY_MISSION_CONTROL_VIEW: CompanyMissionControlView =
  "overview";

export function isCompanyMissionControlView(
  value: string | null | undefined,
): value is CompanyMissionControlView {
  return COMPANY_MISSION_CONTROL_VIEWS.some((view) => view.id === value);
}

/** Retired People tab and hash sections → living page anchors. */
const LEGACY_SECTION_TO_VIEW: Record<string, CompanyMissionControlView> = {
  attention: "overview",
  contacts: "overview",
  people: "overview",
  opportunities: "work",
  deals: "work",
  projects: "work",
  pipeline: "work",
  activities: "actions",
  documents: "actions",
  materials: "actions",
};

function resolveRetiredPeopleView(
  value: string | null | undefined,
): CompanyMissionControlView | null {
  if (value === "people" || value === "contacts") {
    return DEFAULT_COMPANY_MISSION_CONTROL_VIEW;
  }
  return null;
}

export function resolveCompanyMissionControlView(
  viewParam: string | null | undefined,
  hash?: string | null,
  legacyTab?: string | null,
): CompanyMissionControlView {
  if (isCompanyMissionControlView(viewParam)) return viewParam;
  const retiredView = resolveRetiredPeopleView(viewParam);
  if (retiredView) return retiredView;
  if (isCompanyMissionControlView(legacyTab)) return legacyTab;
  const retiredTab = resolveRetiredPeopleView(legacyTab);
  if (retiredTab) return retiredTab;
  const section = hash?.replace(/^#/, "").trim().toLowerCase();
  if (section && LEGACY_SECTION_TO_VIEW[section]) {
    return LEGACY_SECTION_TO_VIEW[section]!;
  }
  if (legacyTab && LEGACY_SECTION_TO_VIEW[legacyTab]) {
    return LEGACY_SECTION_TO_VIEW[legacyTab]!;
  }
  return DEFAULT_COMPANY_MISSION_CONTROL_VIEW;
}

export function companyMissionControlHref(
  companyId: string,
  _view?: CompanyMissionControlView,
): string {
  return `/companies/${encodeURIComponent(companyId)}`;
}

/** Map legacy ?view= to an in-page section id. */
export function companyLivingPageSection(
  viewParam: string | null | undefined,
  hash?: string | null,
): string | null {
  const fromHash = hash?.replace(/^#/, "").trim().toLowerCase();
  if (fromHash) return fromHash;
  if (viewParam === "work") return "opportunities";
  if (viewParam === "actions") return "activities";
  if (viewParam === "people" || viewParam === "contacts") return "contacts";
  return null;
}
