import type { CommercialViabilityDimensionId } from "@/types/commercial-viability";

export const CVM_VERSION = "3.0";
export const CVM_MODULE_NAME = "Commercial Viability Module";
export const CVM_SHORT_NAME = "CVM";
export const CVM_ENGINE_LABEL = "Core SmartAssist Intelligence Engine";
export const CVM_STATUS = "CORE SMARTASSIST INTELLIGENCE ENGINE";

export const CVM_MISSION =
  "Help Standard Bio maximize signed contracts, identify the best revenue path, protect scarce resources, and eliminate weak projects early.";

export const CVM_LEADERSHIP_PERSONA =
  "Sales Director + Business Developer + Project Developer + Engineering Manager + CEO";

export const CVM_NORTH_STAR = [
  "Commercial Viability",
  "Revenue Path",
  "Contract Readiness",
  "Signed Contract",
] as const;

export const CVM_OPERATIONAL_INTELLIGENCE = {
  id: "operational" as const,
  label: "Activity Intelligence",
  description: "Follow-ups, commitments, activities, meetings, contacts, stakeholders, relationship health",
  focusAreas: [
    "Follow-Ups",
    "Commitments",
    "Activities",
    "Meetings",
    "Contacts",
    "Stakeholders",
    "Relationship Health",
  ],
};

export const CVM_COMMERCIAL_INTELLIGENCE = {
  id: "commercial" as const,
  label: "Commercial Intelligence (CVM)",
  description: "CVM consumes operational signals and explains their commercial impact",
  focusAreas: [
    "Commercial Viability",
    "Revenue Path",
    "Project Maturity",
    "Business Case",
    "Contract Readiness",
    "Resource Allocation",
  ],
};

export const CVM_DOES_NOT_REPLACE = [
  "Follow-Ups",
  "Activities",
  "Open Commitments",
  "Meetings",
  "Stakeholder Management",
] as const;

export type CvmDimensionMeta = {
  purpose: string;
  scoreLabel: string;
  criteria: string[];
  questions: string[];
};

export const CVM_DIMENSION_META: Record<CommercialViabilityDimensionId, CvmDimensionMeta> = {
  buying_drivers: {
    purpose: "Understand WHY the customer wants the project.",
    scoreLabel: "Buying Driver Score",
    criteria: [
      "Cost Reduction",
      "Waste Reduction",
      "Sustainability",
      "Carbon Reduction",
      "Compliance",
      "Revenue Generation",
      "Energy Recovery",
      "Strategic Growth",
    ],
    questions: ["Why will they buy?", "How urgent is the problem?", "How strong is the business driver?"],
  },
  business_case_strength: {
    purpose: "Determine whether the economics are attractive.",
    scoreLabel: "Business Case Score",
    criteria: [
      "CAPEX",
      "OPEX",
      "Biochar Revenue",
      "Carbon Credit Revenue",
      "Thermal Revenue",
      "ROI",
      "Payback",
      "NPV",
      "IRR",
    ],
    questions: ["Does this project make money?", "Does it satisfy customer investment criteria?"],
  },
  financial_readiness: {
    purpose: "Determine whether the customer can finance the project.",
    scoreLabel: "Financial Readiness Score",
    criteria: ["Equity", "Debt", "Grants", "Investors", "Green Financing", "Board Approval", "Investment Committee"],
    questions: ["Can they buy?", "How will the project be funded?"],
  },
  feedstock_readiness: {
    purpose: "Determine whether feedstock is commercially secure.",
    scoreLabel: "Feedstock Readiness Score",
    criteria: ["Feedstock Type", "Feedstock Volume", "Feedstock Quality", "Supply Security", "Supply Agreements"],
    questions: ["Can the project operate long-term?"],
  },
  project_readiness: {
    purpose: "Determine whether the project can physically be built.",
    scoreLabel: "Project Readiness Score",
    criteria: ["Site", "Utilities", "Grid Capacity", "Water", "Compressed Air", "Logistics", "Infrastructure", "Permits"],
    questions: ["Can it actually be built?"],
  },
  offtake_readiness: {
    purpose: "Determine whether outputs have a market.",
    scoreLabel: "Offtake Readiness Score",
    criteria: ["Biochar Market", "Carbon Credit Strategy", "Thermal Offtake", "Revenue Security", "Offtake Agreements"],
    questions: ["Can outputs be sold?"],
  },
  delivery_readiness: {
    purpose: "Determine whether Standard Bio can successfully deliver.",
    scoreLabel: "Delivery Readiness Score",
    criteria: ["Technology Fit", "Engineering Capacity", "Manufacturing Capacity", "Timeline", "Resources", "References"],
    questions: ["Can we deliver?"],
  },
  decision_readiness: {
    purpose: "Determine whether the customer can make a decision.",
    scoreLabel: "Decision Readiness Score",
    criteria: [
      "Economic Buyer",
      "Executive Sponsor",
      "Internal Champion",
      "Procurement Process",
      "Investment Committee",
      "Board Process",
    ],
    questions: ["Can they make a purchasing decision?"],
  },
  competitive_position: {
    purpose: "Determine Standard Bio's likelihood of winning.",
    scoreLabel: "Competitive Position Score",
    criteria: ["Competitors", "Differentiators", "Win Themes", "Commercial Risks", "Relationship Strength"],
    questions: ["Why are we winning?", "Why are we losing?"],
  },
  commercial_momentum: {
    purpose: "Measure whether the opportunity is progressing.",
    scoreLabel: "Commercial Momentum Score",
    criteria: [
      "Meetings",
      "Calls",
      "Emails",
      "Stakeholder Engagement",
      "Customer Responsiveness",
      "Proposal Activity",
    ],
    questions: ["Is the deal moving forward?", "Or quietly dying?"],
  },
  strategic_value: {
    purpose: "Measure strategic importance beyond immediate revenue.",
    scoreLabel: "Strategic Value Score",
    criteria: [
      "Reference Potential",
      "New Geography",
      "Strategic Customer",
      "Market Expansion",
      "Service Revenue Potential",
      "Future Expansion Potential",
    ],
    questions: ["Should Standard Bio want this project?"],
  },
  resource_efficiency: {
    purpose: "Protect scarce company resources.",
    scoreLabel: "Resource Efficiency Score",
    criteria: ["Sales Hours", "Engineering Hours", "Management Time", "Travel Cost", "Proposal Cost"],
    questions: ["Is this opportunity worth our resources?"],
  },
  revenue_path: {
    purpose: "Determine the most logical next sale.",
    scoreLabel: "Revenue Path Recommendation",
    criteria: [
      "FEL-1 Assessment",
      "Feedstock Validation",
      "Utility Assessment",
      "Feasibility Study",
      "Business Case Development",
      "FEED Package",
      "Engineering Services",
      "Equipment Contract",
      "Service Agreement",
      "Expansion Project",
    ],
    questions: [
      "What should we sell next?",
      "What is the best revenue path?",
      "What is the fastest path to revenue?",
    ],
  },
};

export const CVM_PRIMARY_QUESTIONS = [
  "Should Standard Bio invest more resources?",
  "Why is this opportunity attractive?",
  "Why will the customer buy?",
  "Can the customer buy?",
  "Can the customer implement?",
  "Can Standard Bio deliver?",
  "Is this worth our resources?",
  "What is preventing a signed contract?",
  "What should we sell next?",
  "What is the best revenue path?",
  "What is the fastest path to revenue?",
] as const;

export const CVM_CONTRACT_READINESS_SOURCES = [
  "buying_drivers",
  "financial_readiness",
  "project_readiness",
  "decision_readiness",
  "competitive_position",
  "commercial_momentum",
] as const;

export type CvmContractReadinessSource = (typeof CVM_CONTRACT_READINESS_SOURCES)[number];

export const CVM_CONTRACT_READINESS_WEIGHTS: Record<CvmContractReadinessSource, number> = {
  buying_drivers: 0.15,
  financial_readiness: 0.2,
  project_readiness: 0.15,
  decision_readiness: 0.2,
  competitive_position: 0.15,
  commercial_momentum: 0.15,
};
