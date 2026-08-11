import { buildCoPilotSuppressionKey } from "@/lib/smartassist-copilot-keys";
import type { CoPilotActionProposal } from "@/types/smartassist-copilot";

const HANDLED_KEY = "smartcrm-copilot-handled";
const LEGACY_SESSION_KEY = "smartcrm-copilot-handled";

type HandledRecord = {
  dismissed: string[];
  approved: string[];
};

function emptyRecord(): HandledRecord {
  return { dismissed: [], approved: [] };
}

function readStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function migrateSessionToLocal(storage: Storage): void {
  try {
    if (typeof sessionStorage === "undefined") return;
    const legacy = sessionStorage.getItem(LEGACY_SESSION_KEY);
    if (!legacy) return;
    if (!storage.getItem(HANDLED_KEY)) {
      storage.setItem(HANDLED_KEY, legacy);
    }
    sessionStorage.removeItem(LEGACY_SESSION_KEY);
  } catch {
    // ignore migration failures
  }
}

function readHandled(): HandledRecord {
  const storage = readStorage();
  if (!storage) return emptyRecord();
  migrateSessionToLocal(storage);

  const raw = storage.getItem(HANDLED_KEY);
  if (!raw) return emptyRecord();
  try {
    const parsed = JSON.parse(raw) as Partial<HandledRecord>;
    return {
      dismissed: parsed.dismissed ?? [],
      approved: parsed.approved ?? [],
    };
  } catch {
    return emptyRecord();
  }
}

function writeHandled(record: HandledRecord): void {
  const storage = readStorage();
  if (!storage) return;
  storage.setItem(HANDLED_KEY, JSON.stringify(record));
}

export function proposalSuppressionKey(
  proposal: Pick<
    CoPilotActionProposal,
    "id" | "kind" | "companyId" | "title" | "suppressionKey"
  >,
): string {
  return (
    proposal.suppressionKey ??
    buildCoPilotSuppressionKey({
      id: proposal.id,
      kind: proposal.kind,
      companyId: proposal.companyId,
      title: proposal.title,
    })
  );
}

export function isCoPilotProposalHandled(
  idOrKey: string,
  proposal?: Pick<
    CoPilotActionProposal,
    "id" | "kind" | "companyId" | "title" | "suppressionKey"
  >,
): boolean {
  const record = readHandled();
  const keys = new Set([idOrKey]);
  if (proposal) {
    keys.add(proposal.id);
    keys.add(proposalSuppressionKey(proposal));
    // Learned policy: supplier dismissals suppress opportunity nags for the company.
    if (proposal.kind === "create_opportunity" && proposal.companyId) {
      keys.add(`create_opportunity:${proposal.companyId}`);
      keys.add(`policy:no_opportunity:${proposal.companyId}`);
    }
  }
  for (const key of keys) {
    if (record.dismissed.includes(key) || record.approved.includes(key)) {
      return true;
    }
  }
  return false;
}

/** Merge durable DB dismissal keys into the local handled cache. */
export function mergeDurableCoPilotDismissals(keys: string[]): void {
  if (keys.length === 0) return;
  const record = readHandled();
  let changed = false;
  for (const key of keys) {
    if (!key) continue;
    if (!record.dismissed.includes(key)) {
      record.dismissed.push(key);
      changed = true;
    }
  }
  if (changed) writeHandled(record);
}

/**
 * Persist a dismiss locally (optimistic). Prefer `dismissCoPilotProposalWithReason`
 * which also writes to the durable server store.
 */
export function dismissCoPilotProposal(idOrKey: string): void {
  const record = readHandled();
  if (!record.dismissed.includes(idOrKey)) {
    record.dismissed.push(idOrKey);
    writeHandled(record);
  }
}

export async function dismissCoPilotProposalWithReason(input: {
  proposal: CoPilotActionProposal;
  note: string;
  userEmail?: string;
  userDisplayName?: string;
}): Promise<void> {
  const suggestionKey = proposalSuppressionKey(input.proposal);
  dismissCoPilotProposal(suggestionKey);
  if (suggestionKey !== input.proposal.id) {
    dismissCoPilotProposal(input.proposal.id);
  }

  const response = await fetch("/api/smartassist/copilot/dismiss", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      suggestionKey,
      note: input.note.trim(),
      proposalId: input.proposal.id,
      companyId: input.proposal.companyId,
      actionKind: input.proposal.kind,
      userEmail: input.userEmail,
      userDisplayName: input.userDisplayName,
    }),
  });

  const body = (await response.json().catch(() => null)) as
    | { error?: string; ok?: boolean; learnedKeys?: string[] }
    | null;

  if (!response.ok) {
    // Local suppression already applied — keep the user's decision even when
    // durable DB write fails (e.g. migration not applied yet).
    console.warn(
      "[copilot] durable dismiss save failed; kept local suppression",
      body?.error,
    );
  } else if (body?.learnedKeys?.length) {
    mergeDurableCoPilotDismissals(body.learnedKeys);
  }
}

export async function hydrateCoPilotDismissalsFromServer(
  userEmail?: string,
): Promise<string[]> {
  const params = new URLSearchParams();
  if (userEmail?.trim()) params.set("userEmail", userEmail.trim());
  const response = await fetch(
    `/api/smartassist/copilot/dismiss${params.toString() ? `?${params}` : ""}`,
  );
  if (!response.ok) return [];
  const body = (await response.json().catch(() => null)) as
    | { keys?: string[] }
    | null;
  const keys = body?.keys ?? [];
  mergeDurableCoPilotDismissals(keys);
  return keys;
}

export function markCoPilotProposalApproved(id: string): void {
  const record = readHandled();
  if (!record.approved.includes(id)) {
    record.approved.push(id);
    writeHandled(record);
  }
}

export function filterHandledCoPilotProposals<
  T extends Pick<
    CoPilotActionProposal,
    "id" | "kind" | "companyId" | "title" | "suppressionKey"
  >,
>(proposals: T[]): T[] {
  return proposals.filter((proposal) => !isCoPilotProposalHandled(proposal.id, proposal));
}
