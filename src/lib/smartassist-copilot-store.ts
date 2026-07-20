const HANDLED_KEY = "smartcrm-copilot-handled";

type HandledRecord = {
  dismissed: string[];
  approved: string[];
};

function readHandled(): HandledRecord {
  if (typeof sessionStorage === "undefined") {
    return { dismissed: [], approved: [] };
  }
  const raw = sessionStorage.getItem(HANDLED_KEY);
  if (!raw) return { dismissed: [], approved: [] };
  try {
    const parsed = JSON.parse(raw) as Partial<HandledRecord>;
    return {
      dismissed: parsed.dismissed ?? [],
      approved: parsed.approved ?? [],
    };
  } catch {
    return { dismissed: [], approved: [] };
  }
}

function writeHandled(record: HandledRecord): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(HANDLED_KEY, JSON.stringify(record));
}

export function isCoPilotProposalHandled(id: string): boolean {
  const record = readHandled();
  return record.dismissed.includes(id) || record.approved.includes(id);
}

export function dismissCoPilotProposal(id: string): void {
  const record = readHandled();
  if (!record.dismissed.includes(id)) {
    record.dismissed.push(id);
    writeHandled(record);
  }
}

export function markCoPilotProposalApproved(id: string): void {
  const record = readHandled();
  if (!record.approved.includes(id)) {
    record.approved.push(id);
    writeHandled(record);
  }
}

export function filterHandledCoPilotProposals<T extends { id: string }>(
  proposals: T[],
): T[] {
  return proposals.filter((proposal) => !isCoPilotProposalHandled(proposal.id));
}
