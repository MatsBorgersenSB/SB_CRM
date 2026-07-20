import type {
  OfferingCategory,
  OpportunityOfferingSelection,
  StandardBioOffering,
} from "@/types/offering";
import { OFFERING_CATEGORIES } from "@/types/offering";

/**
 * Canonical Standard Bio offering catalog (Phase 2.6A).
 * SmartAssist reasons from these — never invents what we sell.
 */
export const STANDARD_BIO_OFFERINGS: StandardBioOffering[] = [
  // ── Systems ──────────────────────────────────────────────────────────────
  {
    id: "sys-complete-turnkey-pyrolysis",
    name: "Complete Turnkey Pyrolysis System",
    category: "system",
    summary: "End-to-end turnkey pyrolysis plant from reception through packaging and heat recovery.",
    requiredInformation: [
      "Target feedstock type and annual volume",
      "Desired plant capacity",
      "Site utilities, footprint, and installation constraints",
      "End-product and offtake intent",
      "CAPEX decision process and timeline",
    ],
    suggestedStakeholderRoles: [
      "Decision Maker",
      "Executive Sponsor",
      "Technical Lead",
      "Procurement",
      "Project Manager",
    ],
    discoveryQuestions: [
      "What annual feedstock volume must the turnkey system process?",
      "Is the priority biochar, energy recovery, or material products?",
      "What site constraints affect full plant layout?",
      "Who owns CAPEX approval for a complete turnkey system?",
    ],
    qualificationSignals: [
      "Feedstock availability confirmed",
      "Site readiness for turnkey installation",
      "Budget authority engaged",
      "Clear end-product business case",
    ],
    nextBestActionHints: [
      "Qualify feedstock and capacity before proposing a turnkey package",
      "Map Decision Maker and Technical Lead before system proposal",
      "Confirm site utilities early — they gate turnkey feasibility",
    ],
  },

  // ── Products ─────────────────────────────────────────────────────────────
  {
    id: "prod-material-reception",
    name: "Material Reception System",
    category: "product",
    summary: "Inbound material reception and intake handling for process feed.",
    requiredInformation: [
      "Inbound material form and delivery method",
      "Reception throughput vs plant capacity",
      "Contamination and handling constraints",
    ],
    suggestedStakeholderRoles: ["Technical Lead", "Operations Lead", "Procurement"],
    discoveryQuestions: [
      "How will feedstock arrive on site, and at what frequency?",
      "What reception capacity is required to protect downstream process?",
    ],
    qualificationSignals: [
      "Inbound logistics defined",
      "Reception throughput matched to plant",
    ],
    nextBestActionHints: [
      "Confirm inbound logistics before sizing material reception",
    ],
  },
  {
    id: "prod-material-qualification",
    name: "Material Qualification System",
    category: "product",
    summary: "Qualification and quality control of inbound materials before processing.",
    requiredInformation: [
      "Material quality specifications",
      "Rejection and quarantine criteria",
      "Sampling and measurement requirements",
    ],
    suggestedStakeholderRoles: ["Technical Lead", "Operations Lead", "Quality Lead"],
    discoveryQuestions: [
      "What quality gates must material pass before entering the process?",
      "Who owns material acceptance decisions on site?",
    ],
    qualificationSignals: [
      "Quality specification defined",
      "Acceptance owner identified",
    ],
    nextBestActionHints: [
      "Define acceptance criteria with Technical Lead before quoting qualification scope",
    ],
  },
  {
    id: "prod-dryer",
    name: "Dryer",
    category: "product",
    summary: "Drying equipment to bring feedstock to process moisture specification.",
    requiredInformation: [
      "Inbound moisture range",
      "Target moisture for reactor feed",
      "Energy source and heat integration options",
    ],
    suggestedStakeholderRoles: ["Technical Lead", "Operations Lead"],
    discoveryQuestions: [
      "What moisture range must the dryer handle?",
      "Is dryer heat integrated with plant heat recovery?",
    ],
    qualificationSignals: [
      "Moisture targets stated",
      "Energy integration considered",
    ],
    nextBestActionHints: [
      "Confirm moisture targets before sizing dryer capacity",
    ],
  },
  {
    id: "prod-buffer-systems",
    name: "Buffer Systems",
    category: "product",
    summary: "Buffer and intermediate storage to stabilize process flow.",
    requiredInformation: [
      "Required buffer residence time",
      "Material characteristics for storage",
      "Integration points upstream and downstream",
    ],
    suggestedStakeholderRoles: ["Technical Lead", "Operations Lead", "Project Manager"],
    discoveryQuestions: [
      "Where does process variability require buffering?",
      "What buffer capacity protects continuous reactor operation?",
    ],
    qualificationSignals: [
      "Buffer points identified",
      "Residence time requirements stated",
    ],
    nextBestActionHints: [
      "Map process variability with Operations before proposing buffer systems",
    ],
  },
  {
    id: "prod-pyrolysis-reactor",
    name: "Pyrolysis Reactor",
    category: "product",
    summary: "Core pyrolysis reactor as a discrete product within the plant scope.",
    requiredInformation: [
      "Required reactor capacity",
      "Feedstock specification for reactor design",
      "Delivery and installation window",
      "Interface with balance-of-plant",
    ],
    suggestedStakeholderRoles: [
      "Technical Lead",
      "Decision Maker",
      "Procurement",
      "Project Manager",
    ],
    discoveryQuestions: [
      "What capacity must the pyrolysis reactor deliver?",
      "Who owns equipment specification and purchase approval?",
      "What balance-of-plant will the customer provide?",
    ],
    qualificationSignals: [
      "Capacity requirement stated",
      "Procurement engaged",
      "Installation window realistic",
    ],
    nextBestActionHints: [
      "Lock capacity and feedstock spec before quoting the pyrolysis reactor",
      "Confirm Procurement is on the stakeholder map for reactor purchase",
    ],
  },
  {
    id: "prod-post-treatment",
    name: "Post Treatment",
    category: "product",
    summary: "Downstream treatment of pyrolysis outputs to meet product specifications.",
    requiredInformation: [
      "Output product specifications",
      "Required treatment steps",
      "Quality and contamination limits",
    ],
    suggestedStakeholderRoles: ["Technical Lead", "Commercial Lead", "Operations Lead"],
    discoveryQuestions: [
      "What post-treatment is required to meet offtake specifications?",
      "Which output streams need treatment vs direct use?",
    ],
    qualificationSignals: [
      "Output specs defined",
      "Treatment scope boundaries clear",
    ],
    nextBestActionHints: [
      "Confirm offtake product specs before scoping post treatment",
    ],
  },
  {
    id: "prod-packaging",
    name: "Packaging",
    category: "product",
    summary: "Packaging systems for finished products leaving the plant.",
    requiredInformation: [
      "Packaging format and bag/bulk requirements",
      "Throughput matching production rate",
      "Labeling and dispatch interface",
    ],
    suggestedStakeholderRoles: ["Operations Lead", "Commercial Lead", "Procurement"],
    discoveryQuestions: [
      "What packaging format do customers or offtakers require?",
      "How does packaging interface with SB Labeling System?",
    ],
    qualificationSignals: [
      "Packaging format defined",
      "Dispatch requirements known",
    ],
    nextBestActionHints: [
      "Confirm offtaker packaging requirements before quoting packaging scope",
    ],
  },
  {
    id: "prod-heat-recovery",
    name: "Heat Recovery System",
    category: "product",
    summary: "Heat recovery to improve plant energy efficiency and utility balance.",
    requiredInformation: [
      "Available heat sources and temperatures",
      "Heat consumers on site",
      "Energy efficiency and utility targets",
    ],
    suggestedStakeholderRoles: ["Technical Lead", "Operations Lead"],
    discoveryQuestions: [
      "Where can recovered heat displace purchased energy?",
      "What temperature and duty must heat recovery deliver?",
    ],
    qualificationSignals: [
      "Heat sources mapped",
      "Utility savings case defined",
    ],
    nextBestActionHints: [
      "Map heat sources and consumers with Technical Lead before proposing recovery",
    ],
  },
  {
    id: "prod-sb-control",
    name: "SB Control",
    category: "product",
    summary: "Standard Bio plant control system for process operation and safety.",
    requiredInformation: [
      "Control scope and automation level",
      "Integration with existing plant OT",
      "Operator interface requirements",
    ],
    suggestedStakeholderRoles: ["Technical Lead", "Operations Lead", "IT / OT Lead"],
    discoveryQuestions: [
      "What automation level does operations require from SB Control?",
      "Who owns OT integration on the customer side?",
    ],
    qualificationSignals: [
      "OT owner identified",
      "Automation scope agreed",
    ],
    nextBestActionHints: [
      "Identify OT / control owner before proposing SB Control scope",
    ],
  },
  {
    id: "prod-sb-virtual-service",
    name: "SB Virtual Service",
    category: "product",
    summary: "Remote virtual service capability for plant support and diagnostics.",
    requiredInformation: [
      "Connectivity and remote access constraints",
      "Service coverage expectations",
      "Data and cybersecurity requirements",
    ],
    suggestedStakeholderRoles: ["Operations Lead", "IT / OT Lead", "Decision Maker"],
    discoveryQuestions: [
      "Is remote plant access allowed for virtual service?",
      "What response expectations apply to virtual support?",
    ],
    qualificationSignals: [
      "Remote access policy clear",
      "Service expectations stated",
    ],
    nextBestActionHints: [
      "Confirm remote access policy before proposing SB Virtual Service",
    ],
  },
  {
    id: "prod-sb-cloud-service",
    name: "SB Cloud Service",
    category: "product",
    summary: "Cloud-hosted service for plant data, monitoring, and digital operations.",
    requiredInformation: [
      "Cloud data residency and security requirements",
      "Users and access roles",
      "Integration with SB Control and reporting",
    ],
    suggestedStakeholderRoles: ["IT / OT Lead", "Operations Lead", "Decision Maker"],
    discoveryQuestions: [
      "Where must plant data reside, and who may access it?",
      "Which roles need SB Cloud Service dashboards?",
    ],
    qualificationSignals: [
      "Data residency requirements known",
      "Access roles defined",
    ],
    nextBestActionHints: [
      "Clarify data residency and access before proposing SB Cloud Service",
    ],
  },
  {
    id: "prod-sb-reporting-service",
    name: "SB Reporting Service",
    category: "product",
    summary: "Operational and performance reporting service for plant stakeholders.",
    requiredInformation: [
      "Report recipients and cadence",
      "KPIs and compliance metrics required",
      "Export and audit requirements",
    ],
    suggestedStakeholderRoles: ["Operations Lead", "Commercial Lead", "Executive Sponsor"],
    discoveryQuestions: [
      "Which KPIs must leadership see regularly?",
      "Are compliance or offtaker reports required?",
    ],
    qualificationSignals: [
      "KPI set agreed",
      "Report recipients named",
    ],
    nextBestActionHints: [
      "Agree KPI set with Operations and Commercial before quoting reporting",
    ],
  },

  // ── Services ─────────────────────────────────────────────────────────────
  {
    id: "svc-project-development-fel2-fel3",
    name: "Project Development Service FEL2 & FEL3",
    category: "service",
    summary: "Paid project development through FEL2 and FEL3 maturity gates.",
    requiredInformation: [
      "Current FEL maturity and gaps",
      "Decision criteria for FEL2 / FEL3 progression",
      "Study budget and decision timeline",
    ],
    suggestedStakeholderRoles: [
      "Decision Maker",
      "Executive Sponsor",
      "Technical Lead",
      "Commercial Lead",
      "Project Manager",
    ],
    discoveryQuestions: [
      "What must FEL2 / FEL3 prove for the customer to proceed to investment?",
      "Who sponsors paid project development spend?",
      "What is the target decision date for the next FEL gate?",
    ],
    qualificationSignals: [
      "Study budget available",
      "Decision date known",
      "Executive Sponsor engaged",
    ],
    nextBestActionHints: [
      "Confirm study budget and decision date before drafting FEL2 / FEL3 proposal",
      "Ensure Executive Sponsor is on the stakeholder roster",
    ],
  },
  {
    id: "svc-product-validation",
    name: "Product Validation Service",
    category: "service",
    summary: "Validation of product quality, process fit, and commercial readiness.",
    requiredInformation: [
      "Product specification to validate",
      "Sample availability or test material",
      "Success criteria for validation",
    ],
    suggestedStakeholderRoles: ["Technical Lead", "Commercial Lead", "Quality Lead"],
    discoveryQuestions: [
      "What product attributes must be validated before commercial commitment?",
      "Can the customer provide samples or access for validation tests?",
    ],
    qualificationSignals: [
      "Validation success criteria defined",
      "Sample or test access confirmed",
    ],
    nextBestActionHints: [
      "Define validation success criteria before proposing Product Validation Service",
    ],
  },
  {
    id: "svc-aftermarket",
    name: "Aftermarket Services",
    category: "service",
    summary: "Aftermarket support, maintenance, and lifecycle services for installed assets.",
    requiredInformation: [
      "Assets covered by aftermarket scope",
      "SLA and response expectations",
      "Commercial term length and renewal path",
    ],
    suggestedStakeholderRoles: [
      "Operations Lead",
      "Decision Maker",
      "Procurement",
      "Commercial Lead",
    ],
    discoveryQuestions: [
      "Which assets and response times must aftermarket services cover?",
      "Who owns long-term O&M budget?",
    ],
    qualificationSignals: [
      "O&M budget owner identified",
      "SLA expectations stated",
    ],
    nextBestActionHints: [
      "Identify O&M budget owner before proposing Aftermarket Services",
    ],
  },
  {
    id: "svc-sb-labeling-system",
    name: "SB Labeling System",
    category: "service",
    summary: "Labeling system service for product identification and dispatch compliance.",
    requiredInformation: [
      "Label content and regulatory requirements",
      "Integration with packaging and dispatch",
      "Traceability expectations",
    ],
    suggestedStakeholderRoles: ["Operations Lead", "Quality Lead", "Commercial Lead"],
    discoveryQuestions: [
      "What labeling and traceability rules apply to finished product?",
      "How should labeling integrate with packaging and SB Reporting?",
    ],
    qualificationSignals: [
      "Label requirements defined",
      "Traceability owner named",
    ],
    nextBestActionHints: [
      "Confirm labeling and traceability rules before quoting SB Labeling System",
    ],
  },
  {
    id: "svc-sb-production-planner",
    name: "SB Production Planner",
    category: "service",
    summary: "Production planning service to schedule plant throughput and campaigns.",
    requiredInformation: [
      "Planning horizon and campaign structure",
      "Constraints from feedstock and offtake",
      "Users who own the production plan",
    ],
    suggestedStakeholderRoles: ["Operations Lead", "Production Planner", "Commercial Lead"],
    discoveryQuestions: [
      "Who owns the weekly or campaign production plan today?",
      "What feedstock and offtake constraints must planning respect?",
    ],
    qualificationSignals: [
      "Plan owner identified",
      "Planning constraints stated",
    ],
    nextBestActionHints: [
      "Identify production plan owner before proposing SB Production Planner",
    ],
  },
];

const OFFERING_BY_ID = new Map(
  STANDARD_BIO_OFFERINGS.map((offering) => [offering.id, offering]),
);

export function getOfferingById(id: string): StandardBioOffering | undefined {
  return OFFERING_BY_ID.get(id);
}

export function resolveOfferings(offeringIds: string[] | undefined): StandardBioOffering[] {
  if (!offeringIds?.length) return [];
  const seen = new Set<string>();
  const resolved: StandardBioOffering[] = [];
  for (const id of offeringIds) {
    if (seen.has(id)) continue;
    const offering = OFFERING_BY_ID.get(id);
    if (!offering) continue;
    seen.add(id);
    resolved.push(offering);
  }
  return resolved;
}

export function offeringsByCategory(
  offerings: StandardBioOffering[],
): Record<OfferingCategory, StandardBioOffering[]> {
  return {
    system: offerings.filter((entry) => entry.category === "system"),
    product: offerings.filter((entry) => entry.category === "product"),
    service: offerings.filter((entry) => entry.category === "service"),
  };
}

export function buildOpportunityOfferingSelection(
  offeringIds: string[] | undefined,
): OpportunityOfferingSelection {
  const offerings = resolveOfferings(offeringIds);
  const byCategory = offeringsByCategory(offerings);
  const present = new Set(offerings.map((entry) => entry.category));
  return {
    offeringIds: offerings.map((entry) => entry.id),
    offerings,
    byCategory,
    labels: offerings.map((entry) => entry.name),
    hasSystems: present.has("system"),
    hasProducts: present.has("product"),
    hasServices: present.has("service"),
    missingCategories: OFFERING_CATEGORIES.filter((category) => !present.has(category)),
  };
}

export function catalogOfferingsByCategory(): Record<
  OfferingCategory,
  StandardBioOffering[]
> {
  return offeringsByCategory(STANDARD_BIO_OFFERINGS);
}

export function formatOfferingLabels(offeringIds: string[] | undefined): string {
  const labels = resolveOfferings(offeringIds).map((entry) => entry.name);
  if (labels.length === 0) return "No offerings selected";
  if (labels.length <= 2) return labels.join(", ");
  return `${labels.slice(0, 2).join(", ")} +${labels.length - 2}`;
}
