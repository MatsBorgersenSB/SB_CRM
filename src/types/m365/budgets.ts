/** Information budgets — hard limits for M365 surfaces (North Star). */

export const M365_BUDGETS = {
  relationshipCard: {
    blocks: 5,
    scroll: false,
  },
  meetingBriefing: {
    maxOpportunities: 2,
    maxRisks: 3,
    maxDiscussionTopics: 3,
    maxWhatChanged: 2,
  },
  dailyFocus: {
    sections: 4,
    scroll: false,
  },
  accountWorkspace: {
    maxWhatChanged: 3,
    maxCommitments: 3,
    maxLinkedItems: 3,
    maxPeople: 4,
    sections: 7,
  },
} as const;

export function capItems<T>(items: T[], max: number): T[] {
  return items.slice(0, max);
}
