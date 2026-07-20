const STORAGE_KEY = "smartcrm-workspace-architect-session";

import type { WorkspaceArchitectSession } from "@/types/workspace-architect";

export function readWorkspaceArchitectSession(): WorkspaceArchitectSession | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as WorkspaceArchitectSession;
  } catch {
    return null;
  }
}

export function writeWorkspaceArchitectSession(session: WorkspaceArchitectSession): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearWorkspaceArchitectSession(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
