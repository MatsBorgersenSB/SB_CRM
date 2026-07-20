import {
  SMARTASSIST_UNDERSTANDING_QUESTIONS,
  type OpportunityUnderstanding,
} from "@/lib/opportunity-workspace-intelligence";

export const SMARTASSIST_SECTION_IDS = {
  clientObjective: "smartassist-client-objective",
  criticalGaps: "smartassist-critical-gaps",
  confirmedUnderstanding: "smartassist-confirmed-understanding",
  suggestedQuestions: "smartassist-suggested-questions",
  validations: "smartassist-validations",
  recommendedConversations: "smartassist-recommended-conversations",
  nextBestAction: "smartassist-next-best-action",
  assistantAssessment: "smartassist-assistant-assessment",
} as const;

export type SmartAssistUnderstandingQuestion =
  (typeof SMARTASSIST_UNDERSTANDING_QUESTIONS)[number];

export type SmartAssistQuestionNavigation = {
  targetId: string;
  secondaryTargetId?: string;
};

const QUESTION_NAVIGATION: Record<
  SmartAssistUnderstandingQuestion,
  SmartAssistQuestionNavigation
> = {
  "What is the client trying to achieve?": {
    targetId: SMARTASSIST_SECTION_IDS.clientObjective,
  },
  "What do we know?": {
    targetId: SMARTASSIST_SECTION_IDS.confirmedUnderstanding,
  },
  "What don't we know?": {
    targetId: SMARTASSIST_SECTION_IDS.criticalGaps,
  },
  "What should we ask next?": {
    targetId: SMARTASSIST_SECTION_IDS.suggestedQuestions,
  },
  "What should we validate next?": {
    targetId: SMARTASSIST_SECTION_IDS.validations,
  },
  "What should happen next?": {
    targetId: SMARTASSIST_SECTION_IDS.nextBestAction,
    secondaryTargetId: SMARTASSIST_SECTION_IDS.recommendedConversations,
  },
};

export function getSmartAssistQuestionNavigation(
  question: SmartAssistUnderstandingQuestion,
): SmartAssistQuestionNavigation {
  return QUESTION_NAVIGATION[question];
}

/** @deprecated Chatbot-style reasoning removed in Phase 1.2 — use answerOpportunityQuestion instead. */
export function buildSmartAssistQuestionReasoning(
  _question: SmartAssistUnderstandingQuestion,
  _understanding: OpportunityUnderstanding,
): string[] {
  return [];
}

export function scrollToSmartAssistSection(
  elementId: string,
  options?: { highlight?: boolean },
): void {
  const element = document.getElementById(elementId);
  if (!element) return;

  element.scrollIntoView({ behavior: "smooth", block: "start" });

  if (options?.highlight) {
    element.classList.add("ring-1", "ring-upcycle-orange/25");
    window.setTimeout(() => {
      element.classList.remove("ring-1", "ring-upcycle-orange/25");
    }, 1400);
  }
}
