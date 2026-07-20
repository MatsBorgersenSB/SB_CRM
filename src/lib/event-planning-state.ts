const STORAGE_KEY = "smartcrm-event-planning-state";

export type EventPlanningPersistedContactState = {
  status: "identified" | "meeting_requested" | "meeting_scheduled";
  updatedAt: string;
};

export type EventPlanningPersistedState = {
  contacts: Record<string, EventPlanningPersistedContactState>;
  addedCompanyIds: string[];
};

function emptyState(): EventPlanningPersistedState {
  return { contacts: {}, addedCompanyIds: [] };
}

export function readEventPlanningState(eventId: string): EventPlanningPersistedState {
  if (typeof localStorage === "undefined") return emptyState();
  const raw = localStorage.getItem(`${STORAGE_KEY}:${eventId}`);
  if (!raw) return emptyState();
  try {
    return JSON.parse(raw) as EventPlanningPersistedState;
  } catch {
    return emptyState();
  }
}

export function writeEventPlanningState(
  eventId: string,
  state: EventPlanningPersistedState,
): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(`${STORAGE_KEY}:${eventId}`, JSON.stringify(state));
}

export function updateEventContactStatus(
  eventId: string,
  contactTargetId: string,
  status: EventPlanningPersistedContactState["status"],
): EventPlanningPersistedState {
  const current = readEventPlanningState(eventId);
  const next: EventPlanningPersistedState = {
    ...current,
    contacts: {
      ...current.contacts,
      [contactTargetId]: { status, updatedAt: new Date().toISOString() },
    },
  };
  writeEventPlanningState(eventId, next);
  return next;
}

export function markEventCompanyAdded(
  eventId: string,
  prospectId: string,
): EventPlanningPersistedState {
  const current = readEventPlanningState(eventId);
  if (current.addedCompanyIds.includes(prospectId)) return current;
  const next: EventPlanningPersistedState = {
    ...current,
    addedCompanyIds: [...current.addedCompanyIds, prospectId],
  };
  writeEventPlanningState(eventId, next);
  return next;
}
