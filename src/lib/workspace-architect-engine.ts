import { buildConfigurationSnapshot } from "@/lib/assisted-configuration-engine";
import { CONFIG_DOMAIN_RESOLUTION, ensureActionableResolution } from "@/lib/assistant-actionability";
import { applySignalBudget } from "@/lib/signal-extraction";
import {
  ASSISTED_CONFIGURATION,
  WORKSPACE_ARCHITECT,
} from "@/lib/smart-assist-config";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { ConfigRecommendation } from "@/types/assisted-configuration";
import { CONFIGURATION_DOMAIN_LABELS } from "@/types/assisted-configuration";
import type {
  WorkspaceArchitectDesign,
  WorkspaceArchitectLayerPlan,
  WorkspaceArchitectSession,
  WorkspaceDiscoveryAnswers,
  WorkspaceDiscoveryMessage,
  WorkspaceDiscoveryQuestionId,
} from "@/types/workspace-architect";
import { WORKSPACE_DISCOVERY_QUESTIONS } from "@/types/workspace-architect";

/** Pure workspace architect analysis — safe for client and server bundles. */

type ArchitectInput = {
  answers: WorkspaceDiscoveryAnswers;
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  commercialPackages: CommercialPackage[];
};

function sessionId(): string {
  return `wa-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function messageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseUserCount(value?: string): number | null {
  if (!value) return null;
  const match = value.match(/\d+/);
  return match ? Number.parseInt(match[0]!, 10) : null;
}

function countListItems(value?: string): number {
  if (!value) return 0;
  return value
    .split(/[,;·\n]/)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function buildRecommendation(
  partial: Omit<ConfigRecommendation, "domainLabel" | "href" | "resolutionLabel"> & {
    href?: string;
    resolutionLabel?: string;
  },
): ConfigRecommendation {
  const domainDefault = CONFIG_DOMAIN_RESOLUTION[partial.domain];
  const withPath = ensureActionableResolution(
    {
      ...partial,
      href: partial.href ?? domainDefault.href,
      resolutionLabel: partial.resolutionLabel ?? domainDefault.label,
    },
    domainDefault,
  );
  return {
    ...withPath,
    domainLabel: CONFIGURATION_DOMAIN_LABELS[partial.domain],
  };
}

function buildBusinessSummary(answers: WorkspaceDiscoveryAnswers): string {
  const purpose = answers.company_purpose?.trim() || "Your organization";
  const products = answers.products?.trim();
  const services = answers.services?.trim();
  const customers = answers.customers?.trim();

  const parts = [purpose];
  if (products) parts.push(`Products: ${products}`);
  if (services) parts.push(`Services: ${services}`);
  if (customers) parts.push(`Customers: ${customers}`);
  return parts.join(" · ");
}

function buildLayerPlans(
  answers: WorkspaceDiscoveryAnswers,
  baselineLayers: WorkspaceArchitectLayerPlan[],
): WorkspaceArchitectLayerPlan[] {
  const userCount = parseUserCount(answers.user_count);
  const industryCount = countListItems(answers.industries);
  const countryCount = countListItems(answers.countries);

  return baselineLayers.map((layer) => {
    if (layer.id === "permissions") {
      return {
        ...layer,
        configured: Boolean(userCount && userCount >= 3),
        summary: userCount
          ? `Designed for ~${userCount} users with role-based access aligned to your business functions.`
          : layer.summary,
      };
    }
    if (layer.id === "integrations") {
      return {
        ...layer,
        configured: countryCount <= 3 && layer.configured,
        summary:
          countryCount > 3
            ? "Multi-region engagement detected — Outlook and Teams integration recommended for relationship continuity."
            : layer.summary,
      };
    }
    if (layer.id === "metadata") {
      return {
        ...layer,
        configured: industryCount >= 2 && layer.configured,
        summary:
          industryCount >= 2
            ? `Metadata model tuned for ${answers.industries?.trim() ?? "your target industries"}.`
            : layer.summary,
      };
    }
    return layer;
  });
}

function buildDiscoveryRecommendations(answers: WorkspaceDiscoveryAnswers): ConfigRecommendation[] {
  const recommendations: ConfigRecommendation[] = [];
  const userCount = parseUserCount(answers.user_count);
  const industryCount = countListItems(answers.industries);
  const countryCount = countListItems(answers.countries);
  const goals = answers.business_goals?.toLowerCase() ?? "";

  if (userCount && userCount >= 5) {
    recommendations.push(
      buildRecommendation({
        id: "architect-roles-from-headcount",
        domain: "roles",
        title: "Define commercial and engineering roles for your team size",
        what: `You indicated ~${userCount} SmartCRM users — role separation will keep ownership clear.`,
        why: "Without mapped roles, follow-ups, deals and documents lack accountable owners.",
        impact: "SmartAssist attention and recommendations route to the wrong people or stall.",
        nextAction: "Create user profiles aligned to sales, engineering, and management responsibilities.",
        expectedOutcome: "Each workspace area has named owners; onboarding scales without admin bottlenecks.",
        severity: userCount >= 10 ? "critical" : "warning",
        confidencePercent: 90,
        href: "/administration/users-access",
        resolutionLabel: "Configure users in Users & Access",
      }),
    );
  }

  if (countryCount >= 3) {
    recommendations.push(
      buildRecommendation({
        id: "architect-integrations-multi-region",
        domain: "integrations",
        title: "Connect Outlook for multi-region relationship history",
        what: `${countryCount} regions matter to your business — email and meeting history should feed CRM automatically.`,
        why: "Cross-border relationships fail when interaction history lives only in individual inboxes.",
        impact: "False 'no interaction' signals and weakened relationship health scores.",
        nextAction: "Enable Microsoft 365 reconciliation so SmartAssist imports missing touchpoints.",
        expectedOutcome: "Relationship health reflects real engagement across regions.",
        severity: "warning",
        confidencePercent: 85,
        href: "/m365-preview",
        resolutionLabel: "Open integration workspace",
      }),
    );
  }

  if (industryCount >= 2) {
    recommendations.push(
      buildRecommendation({
        id: "architect-intelligence-industries",
        domain: "intelligence_sources",
        title: "Configure intelligence for your target industries",
        what: `Your focus spans ${answers.industries?.trim() ?? "multiple industries"}.`,
        why: "Growth and competitive intelligence must match the sectors you sell into.",
        impact: "Generic intelligence wastes attention — relevant signals get buried.",
        nextAction: "Seed competitive landscape and event planning for your priority industries.",
        expectedOutcome: "SmartAssist surfaces industry-relevant opportunities and risks.",
        severity: "warning",
        confidencePercent: 82,
        href: "/intelligence",
        resolutionLabel: "Open Intelligence workspace",
      }),
    );
  }

  if (goals.includes("opportunit") || goals.includes("pipeline") || goals.includes("deal")) {
    recommendations.push(
      buildRecommendation({
        id: "architect-ownership-deals",
        domain: "ownership",
        title: "Assign opportunity ownership across your portfolio",
        what: "Your goals emphasize commercial progression — every deal needs a named owner.",
        why: "Unowned opportunities stall without SmartAssist escalation paths.",
        impact: "Revenue visibility degrades; follow-ups depend on manual memory.",
        nextAction: "Map commercial owners to companies and active opportunities.",
        expectedOutcome: "Pipeline reviews show accountable owners and dated next steps.",
        severity: "warning",
        confidencePercent: 88,
        href: "/administration/users-access",
        resolutionLabel: "Assign opportunity owners",
      }),
    );
  }

  if (goals.includes("knowledge") || goals.includes("document") || goals.includes("history")) {
    recommendations.push(
      buildRecommendation({
        id: "architect-knowledge-capture",
        domain: "knowledge_sources",
        title: "Enable knowledge capture from activities and documents",
        what: "You want SmartCRM to preserve organizational knowledge — structure must support it.",
        why: "Relationship history and technical decisions scatter without linked documents and activities.",
        impact: "Teams re-discover context on every engagement; SmartAssist lacks evidence.",
        nextAction: "Connect SmartDocs and activity capture to company and opportunity records.",
        expectedOutcome: "Decisions, documents and interactions form a searchable relationship memory.",
        severity: "warning",
        confidencePercent: 84,
        href: "/knowledge",
        resolutionLabel: "Open Knowledge workspace",
      }),
    );
  }

  return recommendations;
}

export function createWorkspaceArchitectSession(): WorkspaceArchitectSession {
  const firstQuestion = WORKSPACE_DISCOVERY_QUESTIONS[0]!;
  return {
    id: sessionId(),
    startedAt: new Date().toISOString(),
    messages: [
      {
        id: messageId(),
        role: "assistant",
        content: firstQuestion.prompt,
        questionId: firstQuestion.id,
      },
    ],
    answers: {},
    currentQuestionIndex: 0,
    complete: false,
    design: null,
  };
}

export function appendDiscoveryAnswer(
  session: WorkspaceArchitectSession,
  answer: string,
): WorkspaceArchitectSession {
  const trimmed = answer.trim();
  if (!trimmed) return session;

  const question = WORKSPACE_DISCOVERY_QUESTIONS[session.currentQuestionIndex];
  if (!question) return session;

  const userMessage: WorkspaceDiscoveryMessage = {
    id: messageId(),
    role: "user",
    content: trimmed,
    questionId: question.id,
  };

  const answers: WorkspaceDiscoveryAnswers = {
    ...session.answers,
    [question.id]: trimmed,
  };

  const nextIndex = session.currentQuestionIndex + 1;
  const nextQuestion = WORKSPACE_DISCOVERY_QUESTIONS[nextIndex];

  if (!nextQuestion) {
    return {
      ...session,
      messages: [...session.messages, userMessage],
      answers,
      currentQuestionIndex: nextIndex,
      complete: true,
    };
  }

  const assistantMessage: WorkspaceDiscoveryMessage = {
    id: messageId(),
    role: "assistant",
    content: nextQuestion.prompt,
    questionId: nextQuestion.id,
  };

  return {
    ...session,
    messages: [...session.messages, userMessage, assistantMessage],
    answers,
    currentQuestionIndex: nextIndex,
    complete: false,
  };
}

export function buildWorkspaceArchitectDesign(input: ArchitectInput): WorkspaceArchitectDesign {
  const baseline = buildConfigurationSnapshot({
    companies: input.companies,
    pipelines: input.pipelines,
    activities: input.activities,
    commercialPackages: input.commercialPackages,
  });

  const baselineLayers: WorkspaceArchitectLayerPlan[] = baseline.architectureLayers.map(
    (layer) => ({
      id: layer.id,
      label: layer.label,
      summary: layer.summary,
      configured: layer.healthy,
    }),
  );

  const discoveryRecs = buildDiscoveryRecommendations(input.answers);
  const mergedRecommendations = applySignalBudget(
    [...discoveryRecs, ...baseline.recommendations],
    ASSISTED_CONFIGURATION.recommendationBudget,
  );

  const layers = buildLayerPlans(input.answers, baselineLayers);
  const configuredCount = layers.filter((layer) => layer.configured).length;
  const readinessScore = Math.round(
    (configuredCount / Math.max(layers.length, 1)) * 55 +
      baseline.readinessScore * 0.45,
  );

  const userCount = parseUserCount(input.answers.user_count);
  const industryCount = countListItems(input.answers.industries);
  const countryCount = countListItems(input.answers.countries);

  return {
    generatedAt: new Date().toISOString(),
    businessSummary: buildBusinessSummary(input.answers),
    workspaceObjective:
      input.answers.business_goals?.trim() ||
      ASSISTED_CONFIGURATION.objective,
    readinessScore,
    readinessLabel:
      readinessScore >= 85
        ? "Workspace design ready to apply"
        : readinessScore >= 65
          ? "Workspace design drafted — review recommendations"
          : "Workspace design needs your input",
    layers,
    recommendations: mergedRecommendations,
    vitals: [
      { label: "Users planned", value: userCount ? String(userCount) : "—", highlight: !userCount },
      { label: "Industries", value: industryCount ? String(industryCount) : "—" },
      { label: "Regions", value: countryCount ? String(countryCount) : "—" },
      { label: "Architecture", value: `${readinessScore}%` },
    ],
    nextSteps: [
      "Review SmartAssist recommendations and approve what to apply.",
      "Configure users and roles in Users & Access.",
      "Connect integrations where relationship history matters.",
      "Return to Workspace Architecture to track readiness over time.",
    ],
    approved: false,
  };
}

export function completeWorkspaceArchitectSession(
  session: WorkspaceArchitectSession,
  input: ArchitectInput,
): WorkspaceArchitectSession {
  const design = buildWorkspaceArchitectDesign(input);
  const completionMessage: WorkspaceDiscoveryMessage = {
    id: messageId(),
    role: "assistant",
    content: WORKSPACE_ARCHITECT.completionMessage,
  };

  return {
    ...session,
    complete: true,
    design,
    messages: [...session.messages, completionMessage],
  };
}

export function getCurrentDiscoveryQuestion(
  session: WorkspaceArchitectSession,
): (typeof WORKSPACE_DISCOVERY_QUESTIONS)[number] | null {
  if (session.complete) return null;
  return WORKSPACE_DISCOVERY_QUESTIONS[session.currentQuestionIndex] ?? null;
}

export function questionLabel(id: WorkspaceDiscoveryQuestionId): string {
  return WORKSPACE_DISCOVERY_QUESTIONS.find((question) => question.id === id)?.prompt ?? id;
}
