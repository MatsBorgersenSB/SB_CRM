const STORAGE_PREFIX = "smartcrm-workspace-section:";

export function readSectionCollapsed(
  storageKey: string,
  defaultCollapsed: boolean,
): boolean {
  if (typeof window === "undefined") return defaultCollapsed;
  const raw = localStorage.getItem(STORAGE_PREFIX + storageKey);
  if (raw === null) return defaultCollapsed;
  return raw === "1";
}

export function writeSectionCollapsed(storageKey: string, collapsed: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_PREFIX + storageKey, collapsed ? "1" : "0");
}

export function workspaceSectionStorageKey(
  workspace: "company" | "contact" | "opportunity" | "project",
  entityId: string,
  section: string,
): string {
  return `${workspace}:${entityId}:${section}`;
}
