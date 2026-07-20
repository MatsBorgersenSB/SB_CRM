import type { ConfigRecommendation, ConfigurationSnapshot } from "@/types/assisted-configuration";

/** Phase 2.0 — SmartAssist Workspace Architect discovery session. */

export type WorkspaceDiscoveryQuestionId =
  | "company_purpose"
  | "products"
  | "services"
  | "customers"
  | "industries"
  | "countries"
  | "user_count"
  | "business_goals";

export type WorkspaceDiscoveryQuestion = {
  id: WorkspaceDiscoveryQuestionId;
  prompt: string;
  placeholder: string;
  helper?: string;
};

export type WorkspaceDiscoveryAnswers = Partial<Record<WorkspaceDiscoveryQuestionId, string>>;

export type WorkspaceDiscoveryMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  questionId?: WorkspaceDiscoveryQuestionId;
};

export type WorkspaceArchitectLayerPlan = {
  id: string;
  label: string;
  summary: string;
  configured: boolean;
};

export type WorkspaceArchitectDesign = {
  generatedAt: string;
  businessSummary: string;
  workspaceObjective: string;
  readinessScore: number;
  readinessLabel: string;
  layers: WorkspaceArchitectLayerPlan[];
  recommendations: ConfigRecommendation[];
  vitals: Array<{ label: string; value: string; highlight?: boolean }>;
  nextSteps: string[];
  approved: boolean;
};

export type WorkspaceArchitectSession = {
  id: string;
  startedAt: string;
  messages: WorkspaceDiscoveryMessage[];
  answers: WorkspaceDiscoveryAnswers;
  currentQuestionIndex: number;
  complete: boolean;
  design: WorkspaceArchitectDesign | null;
};

export const WORKSPACE_DISCOVERY_QUESTIONS: WorkspaceDiscoveryQuestion[] = [
  {
    id: "company_purpose",
    prompt: "What does your company do?",
    placeholder: "e.g. We design and deploy modular pyrolysis plants for waste-to-energy operators.",
    helper: "Describe your core business in plain language — SmartAssist handles the technical setup.",
  },
  {
    id: "products",
    prompt: "What products do you sell?",
    placeholder: "e.g. Pyrolysis units, feedstock qualification kits, performance monitoring software.",
  },
  {
    id: "services",
    prompt: "What services do you provide?",
    placeholder: "e.g. Site assessment, commissioning, operator training, long-term O&M support.",
  },
  {
    id: "customers",
    prompt: "Who are your customers?",
    placeholder: "e.g. Waste management companies, industrial operators, municipal authorities, EPC partners.",
  },
  {
    id: "industries",
    prompt: "Which industries matter most to your business?",
    placeholder: "e.g. Waste management, chemicals, energy, municipal infrastructure.",
  },
  {
    id: "countries",
    prompt: "Which countries or regions matter?",
    placeholder: "e.g. Germany, Nordics, Benelux, UK.",
  },
  {
    id: "user_count",
    prompt: "How many users will use SmartCRM?",
    placeholder: "e.g. 12 — 3 commercial, 4 engineering, 2 management, 3 support.",
    helper: "Include roles if you know them — SmartAssist will recommend access profiles.",
  },
  {
    id: "business_goals",
    prompt: "What should SmartCRM help you achieve?",
    placeholder: "e.g. Track opportunities across Europe, maintain stakeholder history, reduce admin overhead.",
  },
];

export type WorkspaceArchitectApiResponse = {
  session: WorkspaceArchitectSession;
  design: WorkspaceArchitectDesign;
  baselineSnapshot: ConfigurationSnapshot;
};
