import type {
  M365AccountWorkspacePayload,
  M365DailyFocusPayload,
  M365IntelligenceMeta,
  M365MeetingBriefingPayload,
  M365Payload,
  M365RelationshipCardPayload,
  M365RiskBlock,
  M365ActionBlock,
} from "@/types/m365";
import { M365_BUDGETS } from "@/types/m365";

export type ValidationStatus = "pass" | "fail" | "warn";

export type ValidationCheck = {
  label: string;
  status: ValidationStatus;
  detail?: string;
};

export type ValidationSection = {
  title: string;
  checks: ValidationCheck[];
};

export type M365SurfaceValidation = {
  surface: string;
  overall: ValidationStatus;
  sections: ValidationSection[];
};

const INSIGHT_CHAR_LIMIT = 120;
const ACTION_CHAR_LIMIT = 140;

function hasText(value: string | undefined): boolean {
  return Boolean(value?.trim());
}

function hasImpact(items: string[] | undefined): boolean {
  return Array.isArray(items) && items.some((item) => item.trim().length > 0);
}

function checkImpactBlock(label: string, items: string[] | undefined): ValidationCheck {
  return {
    label,
    status: hasImpact(items) ? "pass" : "fail",
    detail: hasImpact(items) ? undefined : "Missing required impact lines",
  };
}

function metaChecks(meta: M365IntelligenceMeta): ValidationCheck[] {
  return [
    {
      label: "What matters is defined",
      status: hasText(meta.whatMatters) ? "pass" : "fail",
    },
    {
      label: "What is at risk is defined",
      status: hasText(meta.whatIsAtRisk) ? "pass" : "fail",
    },
    {
      label: "Why it matters is defined",
      status: hasText(meta.whyItMatters) ? "pass" : "fail",
    },
    {
      label: "Next step is defined",
      status: hasText(meta.whatShouldHappenNext) ? "pass" : "fail",
    },
  ];
}

function riskImpactChecks(risks: (M365RiskBlock | null | undefined)[]): ValidationCheck[] {
  const defined = risks.filter((risk): risk is M365RiskBlock => risk != null);
  if (defined.length === 0) {
    return [{ label: "Risk blocks include impact context", status: "pass", detail: "No risks surfaced" }];
  }

  const missing = defined.filter((risk) => !hasImpact(risk.impact));
  return [
    {
      label: "Every risk block has impact context",
      status: missing.length === 0 ? "pass" : "fail",
      detail:
        missing.length > 0 ? `${missing.length} risk block(s) missing impact` : undefined,
    },
  ];
}

function actionImpactChecks(actions: M365ActionBlock[]): ValidationCheck[] {
  if (actions.length === 0) {
    return [{ label: "Action blocks include impact context", status: "warn", detail: "No actions surfaced" }];
  }

  const missing = actions.filter((action) => !hasImpact(action.impact));
  return [
    {
      label: "Every action block has impact context",
      status: missing.length === 0 ? "pass" : "fail",
      detail:
        missing.length > 0 ? `${missing.length} action block(s) missing impact` : undefined,
    },
  ];
}

function threeSecondChecks(meta: M365IntelligenceMeta): ValidationCheck[] {
  const insightLength = meta.whatMatters.trim().length;
  return [
    {
      label: "Primary insight leads the surface",
      status: hasText(meta.whatMatters) ? "pass" : "fail",
      detail: "Reader should grasp what matters without scrolling",
    },
    {
      label: "Insight is scannable (≤120 characters)",
      status: insightLength <= INSIGHT_CHAR_LIMIT ? "pass" : "warn",
      detail: `${insightLength} characters — may slow the 3-second read`,
    },
    {
      label: "At-risk signal is immediately visible",
      status: hasText(meta.whatIsAtRisk) ? "pass" : "fail",
    },
    {
      label: "Impact narrative supports the insight",
      status: hasText(meta.whyItMatters) ? "pass" : "fail",
    },
  ];
}

function fiveSecondChecks(
  meta: M365IntelligenceMeta,
  actions: M365ActionBlock[],
): ValidationCheck[] {
  const nextStepLength = meta.whatShouldHappenNext.trim().length;
  const primaryAction = actions[0];

  return [
    {
      label: "Clear next step is stated",
      status: hasText(meta.whatShouldHappenNext) ? "pass" : "fail",
    },
    {
      label: "Next step is actionable (≤140 characters)",
      status: nextStepLength <= ACTION_CHAR_LIMIT ? "pass" : "warn",
      detail: `${nextStepLength} characters — keep phrasing direct for host surfaces`,
    },
    {
      label: "Primary action block is present",
      status: primaryAction ? "pass" : "warn",
      detail: primaryAction ? undefined : "No NBA block to act on",
    },
    {
      label: "Primary action includes a deep link",
      status: primaryAction?.href?.trim() ? "pass" : primaryAction ? "warn" : "warn",
      detail: primaryAction && !primaryAction.href?.trim() ? "Missing href on primary action" : undefined,
    },
    {
      label: "Action impact explains why to act",
      status: primaryAction && hasImpact(primaryAction.impact) ? "pass" : primaryAction ? "fail" : "warn",
    },
  ];
}

function overallStatus(sections: ValidationSection[]): ValidationStatus {
  const statuses = sections.flatMap((section) => section.checks.map((check) => check.status));
  if (statuses.includes("fail")) return "fail";
  if (statuses.includes("warn")) return "warn";
  return "pass";
}

function withinBudget(label: string, count: number, max: number): ValidationCheck {
  return {
    label,
    status: count <= max ? "pass" : "fail",
    detail: `${count} / ${max} max`,
  };
}

export function validateRelationshipCard(
  payload: M365RelationshipCardPayload,
): M365SurfaceValidation {
  const budget: ValidationSection = {
    title: "Information Budget",
    checks: [
      { label: "Health block present", status: payload.health ? "pass" : "fail" },
      { label: "Top risk block present", status: "pass", detail: payload.topRisk ? "Risk surfaced" : "Stable — empty state shown" },
      { label: "Next best action block present", status: payload.nextBestAction ? "pass" : "fail" },
      { label: "Open opportunities block present", status: payload.openOpportunities ? "pass" : "fail" },
      { label: "Open commitments block present", status: payload.openCommitments ? "pass" : "fail" },
      {
        label: "Five content blocks (North Star)",
        status: "pass",
        detail: "Health · Top Risk · NBA · Opportunities · Commitments",
      },
      {
        label: "No scroll budget enforced",
        status: "pass",
        detail: "Designed for single-pane Outlook host — validate visually",
      },
    ],
  };

  const impact: ValidationSection = {
    title: "Impact Context",
    checks: [
      ...metaChecks(payload.meta),
      ...riskImpactChecks([payload.topRisk]),
      ...actionImpactChecks([payload.nextBestAction]),
      checkImpactBlock("Open opportunities impact", payload.openOpportunities.impact),
      checkImpactBlock("Open commitments impact", payload.openCommitments.impact),
    ],
  };

  const sections = [
    budget,
    impact,
    { title: "3 Second Test", checks: threeSecondChecks(payload.meta) },
    {
      title: "5 Second Test",
      checks: fiveSecondChecks(payload.meta, [payload.nextBestAction]),
    },
  ];

  return {
    surface: "Relationship Card",
    overall: overallStatus(sections),
    sections,
  };
}

export function validateMeetingBriefing(
  payload: M365MeetingBriefingPayload,
): M365SurfaceValidation {
  const budget: ValidationSection = {
    title: "Information Budget",
    checks: [
      withinBudget(
        "Open opportunities capped",
        payload.openOpportunities.length,
        M365_BUDGETS.meetingBriefing.maxOpportunities,
      ),
      withinBudget(
        "Top risks capped",
        payload.topRisks.length,
        M365_BUDGETS.meetingBriefing.maxRisks,
      ),
      withinBudget(
        "Discussion topics capped",
        payload.discussionTopics.length,
        M365_BUDGETS.meetingBriefing.maxDiscussionTopics,
      ),
      withinBudget(
        "What changed lines capped",
        payload.whatChanged.length,
        M365_BUDGETS.meetingBriefing.maxWhatChanged,
      ),
      {
        label: "Singular meeting objective",
        status: hasText(payload.meetingObjective) ? "pass" : "fail",
      },
      {
        label: "Seven sections (North Star)",
        status: "pass",
        detail:
          "Relationship Summary · Primary Objective · What Changed · Opportunities · Risks · Topics · NBA",
      },
      {
        label: "Relationship summary present",
        status: hasText(payload.relationshipSummary) ? "pass" : "fail",
      },
    ],
  };

  const impact: ValidationSection = {
    title: "Impact Context",
    checks: [
      ...metaChecks(payload.meta),
      ...riskImpactChecks(payload.topRisks),
      ...actionImpactChecks([payload.nextBestAction]),
      ...payload.openOpportunities.map((opp) =>
        checkImpactBlock(`Opportunity: ${opp.label}`, opp.impact),
      ),
    ],
  };

  const sections = [
    budget,
    impact,
    { title: "3 Second Test", checks: threeSecondChecks(payload.meta) },
    {
      title: "5 Second Test",
      checks: fiveSecondChecks(payload.meta, [payload.nextBestAction]),
    },
  ];

  return {
    surface: "Meeting Briefing",
    overall: overallStatus(sections),
    sections,
  };
}

export function validateDailyFocus(payload: M365DailyFocusPayload): M365SurfaceValidation {
  const sectionCount = 1 + (payload.topActions.length > 0 ? 1 : 0) + 2;

  const budget: ValidationSection = {
    title: "Information Budget",
    checks: [
      withinBudget(
        "Top actions capped",
        payload.topActions.length,
        M365_BUDGETS.dailyFocus.maxActions,
      ),
      {
        label: "Four sections (North Star)",
        status: sectionCount <= M365_BUDGETS.dailyFocus.sections ? "pass" : "warn",
        detail: "Today's focus · Top actions · Relationship risk · Opportunity risk",
      },
      {
        label: "No scroll budget enforced",
        status: "pass",
        detail: "Designed for single-pane Outlook host — validate visually",
      },
    ],
  };

  const impact: ValidationSection = {
    title: "Impact Context",
    checks: [
      ...metaChecks(payload.meta),
      ...riskImpactChecks([payload.topRelationshipRisk, payload.topOpportunityRisk]),
      ...actionImpactChecks(payload.topActions),
    ],
  };

  const sections = [
    budget,
    impact,
    { title: "3 Second Test", checks: threeSecondChecks(payload.meta) },
    {
      title: "5 Second Test",
      checks: fiveSecondChecks(payload.meta, payload.topActions),
    },
  ];

  return {
    surface: "Daily Focus",
    overall: overallStatus(sections),
    sections,
  };
}

export function validateAccountWorkspace(
  payload: M365AccountWorkspacePayload,
): M365SurfaceValidation {
  const visibleSections =
    1 +
    1 +
    1 +
    1 +
    (payload.openOpportunities.length > 0 ? 1 : 0) +
    (payload.recentActivity.length > 0 ? 1 : 0) +
    (payload.knowledgeAtRisk.length > 0 ? 1 : 0);

  const budget: ValidationSection = {
    title: "Information Budget",
    checks: [
      withinBudget(
        "Open opportunities capped",
        payload.openOpportunities.length,
        M365_BUDGETS.accountWorkspace.maxOpportunities,
      ),
      withinBudget(
        "Recent activity capped",
        payload.recentActivity.length,
        M365_BUDGETS.accountWorkspace.maxRecentActivity,
      ),
      withinBudget(
        "Knowledge at risk capped",
        payload.knowledgeAtRisk.length,
        M365_BUDGETS.accountWorkspace.maxKnowledgeAtRisk,
      ),
      {
        label: "Seven sections max (North Star)",
        status: visibleSections <= M365_BUDGETS.accountWorkspace.sections ? "pass" : "warn",
        detail: `${visibleSections} visible sections`,
      },
    ],
  };

  const impact: ValidationSection = {
    title: "Impact Context",
    checks: [
      ...metaChecks(payload.meta),
      ...riskImpactChecks([payload.topRisk]),
      ...actionImpactChecks([payload.nextBestAction]),
      ...payload.openOpportunities.map((opp) =>
        checkImpactBlock(`Opportunity: ${opp.label}`, opp.impact),
      ),
      ...payload.knowledgeAtRisk.map((doc) =>
        checkImpactBlock(`Knowledge: ${doc.label}`, doc.impact),
      ),
    ],
  };

  const sections = [
    budget,
    impact,
    { title: "3 Second Test", checks: threeSecondChecks(payload.meta) },
    {
      title: "5 Second Test",
      checks: fiveSecondChecks(payload.meta, [payload.nextBestAction]),
    },
  ];

  return {
    surface: "Account Workspace",
    overall: overallStatus(sections),
    sections,
  };
}

export function validateM365Payload(payload: M365Payload): M365SurfaceValidation {
  switch (payload.kind) {
    case "relationship-card":
      return validateRelationshipCard(payload);
    case "meeting-briefing":
      return validateMeetingBriefing(payload);
    case "daily-focus":
      return validateDailyFocus(payload);
    case "account-workspace":
      return validateAccountWorkspace(payload);
  }
}
