/**
 * Contact 360 Mission Control — one view at a time (Michelin).
 * Aligns with Project / Opportunity workspace navigation.
 */

export const CONTACT_MISSION_CONTROL_VIEWS = [
  { id: "overview", label: "Overview" },
  { id: "work", label: "Work" },
  { id: "actions", label: "Actions" },
] as const;

export type ContactMissionControlView =
  (typeof CONTACT_MISSION_CONTROL_VIEWS)[number]["id"];

export const DEFAULT_CONTACT_MISSION_CONTROL_VIEW: ContactMissionControlView =
  "overview";

export function isContactMissionControlView(
  value: string | null | undefined,
): value is ContactMissionControlView {
  return CONTACT_MISSION_CONTROL_VIEWS.some((view) => view.id === value);
}

/** Legacy hash / section → Mission Control view. */
const LEGACY_SECTION_TO_VIEW: Record<string, ContactMissionControlView> = {
  reach: "overview",
  attention: "overview",
  intelligence: "overview",
  master: "overview",
  opportunities: "work",
  projects: "work",
  timeline: "actions",
  activities: "actions",
  documents: "actions",
  history: "actions",
};

export function resolveContactMissionControlView(
  viewParam: string | null | undefined,
  hash?: string | null,
): ContactMissionControlView {
  if (isContactMissionControlView(viewParam)) return viewParam;
  const section = hash?.replace(/^#/, "").trim().toLowerCase();
  if (section && LEGACY_SECTION_TO_VIEW[section]) {
    return LEGACY_SECTION_TO_VIEW[section]!;
  }
  return DEFAULT_CONTACT_MISSION_CONTROL_VIEW;
}

export function contactMissionControlHref(
  contactId: string,
  options?: { companyId?: string; view?: ContactMissionControlView },
): string {
  const params = new URLSearchParams();
  if (options?.companyId) params.set("company", options.companyId);
  if (
    options?.view &&
    options.view !== DEFAULT_CONTACT_MISSION_CONTROL_VIEW
  ) {
    params.set("view", options.view);
  }
  const query = params.toString();
  return `/contacts/${encodeURIComponent(contactId)}${query ? `?${query}` : ""}`;
}
