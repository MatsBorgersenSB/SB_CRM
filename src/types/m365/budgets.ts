/** Information budgets — hard limits for M365 surfaces (North Star). */

export const M365_BUDGETS = {
  relationshipCard: {
    blocks: 5,
    scroll: false,
  },
  meetingBriefing: {
    maxOpportunities: 3,
    maxRisks: 3,
    maxDiscussionTopics: 5,
    maxWhatChanged: 3,
  },
  dailyFocus: {
    maxActions: 3,
    sections: 4,
    scroll: false,
  },
  accountWorkspace: {
    maxOpportunities: 3,
    maxRecentActivity: 3,
    maxKnowledgeAtRisk: 2,
    sections: 7,
  },
} as const;

export function capItems<T>(items: T[], max: number): T[] {
  return items.slice(0, max);
}
