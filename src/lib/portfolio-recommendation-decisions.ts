/**
 * Persist Yes/No decisions on Focus → Portfolio recommendations.
 * No = suppress with required note; Yes = accepted (optional note) then navigate.
 */

import { COPILOT_DISMISS_NOTE_MIN } from "@/lib/smartassist-copilot-dismiss-constants";

const STORAGE_KEY = "smartcrm-portfolio-recommendation-decisions";

export type PortfolioRecommendationDecision = "yes" | "no";

export type PortfolioRecommendationDecisionRecord = {
  key: string;
  decision: PortfolioRecommendationDecision;
  note: string;
  at: string;
  companyId?: string;
  action?: string;
};

function readStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readRecords(): PortfolioRecommendationDecisionRecord[] {
  const storage = readStorage();
  if (!storage) return [];
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is PortfolioRecommendationDecisionRecord =>
        Boolean(
          entry &&
            typeof entry === "object" &&
            typeof (entry as PortfolioRecommendationDecisionRecord).key === "string" &&
            ((entry as PortfolioRecommendationDecisionRecord).decision === "yes" ||
              (entry as PortfolioRecommendationDecisionRecord).decision === "no"),
        ),
    );
  } catch {
    return [];
  }
}

function writeRecords(records: PortfolioRecommendationDecisionRecord[]): void {
  const storage = readStorage();
  if (!storage) return;
  storage.setItem(STORAGE_KEY, JSON.stringify(records));
}

export function portfolioRecommendationKey(companyId: string, ruleId: string): string {
  return `${companyId}::${ruleId}`;
}

export function isPortfolioRecommendationDecided(key: string): boolean {
  return readRecords().some((entry) => entry.key === key);
}

export function savePortfolioRecommendationDecision(input: {
  key: string;
  decision: PortfolioRecommendationDecision;
  note: string;
  companyId?: string;
  action?: string;
}): void {
  if (!input.key) return;
  const note = input.note.trim();
  if (input.decision === "no" && note.length < COPILOT_DISMISS_NOTE_MIN) {
    throw new Error(`Add a short comment (at least ${COPILOT_DISMISS_NOTE_MIN} characters).`);
  }

  const records = readRecords().filter((entry) => entry.key !== input.key);
  records.push({
    key: input.key,
    decision: input.decision,
    note,
    at: new Date().toISOString(),
    companyId: input.companyId,
    action: input.action,
  });
  writeRecords(records);
}

export function filterOpenPortfolioRecommendations<
  T extends { companyId: string; ruleId: string },
>(items: T[]): T[] {
  const decided = new Set(readRecords().map((entry) => entry.key));
  if (decided.size === 0) return items;
  return items.filter(
    (item) => !decided.has(portfolioRecommendationKey(item.companyId, item.ruleId)),
  );
}

export { COPILOT_DISMISS_NOTE_MIN as PORTFOLIO_DECISION_NOTE_MIN };
