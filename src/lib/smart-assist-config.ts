export const SMARTASSIST_IDENTITY = {
  name: "SmartAssist",
  role: "Business Development Intelligence Assistant",
  tagline: "Let me ask SmartAssist — not update CRM",
  persona:
    "Business Development Intelligence Director + Commercial Advisor + Knowledge Curator + Co-Pilot",
  combines: [
    "Sales Intelligence",
    "Marketing Intelligence",
    "Relationship Intelligence",
    "Deep Research Intelligence",
    "Regulatory Intelligence",
    "Project Qualification",
    "Opportunity Qualification",
    "Commercial Intelligence",
    "Revenue Intelligence",
    "Growth Intelligence",
    "Knowledge Capture",
    "CRM Co-Pilot",
  ],
} as const;

export const SMARTASSIST_TRANSFORMS_FROM = [
  "Relationships",
  "Activities",
  "Opportunities",
  "Documents",
  "SmartDocs",
  "Research",
  "SharePoint Knowledge",
  "Organizational Knowledge",
] as const;

export const SMARTASSIST_TRANSFORMS_INTO = [
  "Attention",
  "Context",
  "Recommendations",
  "Actions",
  "Decisions",
] as const;

export const SMARTASSIST_CORE_PRINCIPLES = [
  "Observe before asking",
  "Discover before requesting",
  "Reuse knowledge before creating work",
  "Recommend before reporting",
  "Guide before reacting",
  "Explain before analyzing",
] as const;

/** Aligns with SmartCRM North Star 3-second test */
export const SMARTASSIST_ESSENTIAL_QUESTIONS = [
  "What am I looking at?",
  "What matters?",
  "What should I do next?",
] as const;

export const SMARTASSIST_CONTINUOUS_QUESTIONS = [
  ...SMARTASSIST_ESSENTIAL_QUESTIONS,
  "What changed?",
  "What is at risk?",
  "What opportunity exists?",
] as const;

export const SMARTASSIST_AUTOMATION_SEARCH = [
  "Companies",
  "Contacts",
  "Activities",
  "Opportunities",
  "Documents",
  "SmartDocs",
  "Deep Research",
  "SharePoint",
  "Previous interactions",
  "Existing organizational knowledge",
] as const;

export const SMARTASSIST_AUTOMATION = {
  rule: "Never ask the user for information the system can determine itself.",
  highConfidence: "Update automatically.",
  moderateConfidence: "Suggest an update.",
  lowConfidence: "Only ask the user when necessary.",
  search: SMARTASSIST_AUTOMATION_SEARCH,
  mantra: "The system does the thinking. The user makes the decision.",
} as const;

/**
 * Intelligent Workspace Platform constitution.
 * Users define business needs; SmartAssist designs and maintains workspace architecture.
 */
export const SMARTCRM_PLATFORM_CONSTITUTION = {
  platform: "SmartCRM is an Intelligent Workspace Platform.",
  userRole: "Users define business needs.",
  smartAssistRole: "SmartAssist designs the workspace.",
  platformRole:
    "The platform generates and maintains all required entities, relationships, metadata, permissions, integrations, and storage structures.",
  evolution: "Workspaces evolve automatically as business capabilities evolve.",
  division: {
    customer: "The customer manages the business.",
    smartAssist: "SmartAssist manages the architecture.",
  },
  maintains: [
    "Entities",
    "Relationships",
    "Metadata",
    "Permissions",
    "Integrations",
    "Storage structures",
  ] as const,
  mantra: SMARTASSIST_AUTOMATION.mantra,
  assistedEverything:
    "Every significant configuration, administration, governance, integration, migration, ownership, security, and workspace decision is assisted by SmartAssist.",
} as const;

export const SMARTASSIST_NORTH_STAR = {
  goal: "Build the assistant people want to use.",
  want: "Let me ask SmartAssist.",
  not: "I need to update CRM.",
} as const;

export const SMARTASSIST_PURPOSE = [
  "Reduce workload",
  "Increase company knowledge",
  "Improve executive visibility",
  "Discover opportunities",
  "Progress opportunities",
  "Win contracts",
  "Protect resources",
  "Support strategic growth",
] as const;

/** Constitution: business development mandate */
export const SMARTASSIST_BUSINESS_DEVELOPMENT_MANDATE = {
  statement:
    "SmartAssist exists to assist users throughout the business development process by helping them understand customer objectives, evaluate opportunities, reduce uncertainty, validate assumptions, prioritize effort, and determine the best next action.",
  assists: [
    "Understand customer objectives",
    "Evaluate opportunities",
    "Reduce uncertainty",
    "Validate assumptions",
    "Prioritize effort",
    "Determine the best next action",
  ],
  mantra: "The system does the thinking. The user makes the decision.",
} as const;

/**
 * Assisted Everything — platform-wide governance principle.
 * SmartAssist translates business intent into technical implementation.
 * Users decide; the system handles complexity.
 */
export const ASSISTED_EVERYTHING = {
  title: "Assisted Everything",
  mandate:
    "Every significant configuration, administration, governance, integration, migration, ownership, security, and workspace decision shall be assisted by SmartAssist.",
  userRequirement: "Users should not need technical expertise.",
  smartAssistRole:
    "SmartAssist shall translate business intent into technical implementation.",
  usability:
    "The platform should be usable by a reasonably intelligent 12-year-old.",
  division: {
    system: "Complexity belongs to the system.",
    user: "Clarity belongs to the user.",
  },
  mantra: SMARTASSIST_BUSINESS_DEVELOPMENT_MANDATE.mantra,
  assistedDomains: [
    "Configuration",
    "Administration",
    "Governance",
    "Integrations",
    "Migration",
    "Ownership",
    "Security",
    "Workspace decisions",
  ] as const,
  loop: ["Ask business intent", "Recommend approach", "Preview impact", "User decides", "System applies"] as const,
} as const;

/** Every SmartAssist recommendation must be actionable — no dead ends. */
export const ASSISTANT_ACTIONABILITY = {
  title: "Assistant Actionability",
  mandate:
    "If SmartAssist identifies a problem, SmartAssist must help the user resolve it.",
  rule: "Users should never encounter a dead-end recommendation.",
  requiredFields: ["Why", "Impact", "Recommended Action", "Direct Resolution Path"] as const,
  mantra: "Identify the problem. Show the path. The user decides. SmartAssist helps resolve it.",
} as const;

/** SmartAssist action routing — recommendations open action-specific assistants. */
export const SMARTASSIST_ACTION_PRINCIPLE = {
  title: "SmartAssist Action Principle",
  mantra: "The system does the thinking. The user makes the decision.",
  rule:
    "When SmartAssist recommends an action, clicking the recommendation opens an action-specific assistant — never a generic activity creation flow.",
  examples: {
    draft_email: "Draft Email → SmartAssist Email Assistant",
    create_activity: "Create Activity → Activity Wizard",
  },
  emailAssistantFields: [
    "Reason",
    "Objective",
    "Expected Outcome",
    "Confidence",
    "Subject",
    "Email Draft",
    "Suggested Follow-Up",
    "Suggested Meeting Option",
  ] as const,
  emailAssistantActions: [
    "Create Outlook Draft",
    "Open Outlook",
    "Schedule Teams Meeting",
    "Schedule Call",
    "Create Follow-Up Activity",
  ] as const,
  successCriteria: [
    "Users who click Draft Email prepare an email — not an activity",
    "The system does the thinking. The user makes the decision.",
  ],
} as const;

export const SMARTASSIST_LIFECYCLE = [
  "Find opportunities",
  "Qualify opportunities",
  "Progress opportunities",
  "Win opportunities",
  "Deliver opportunities",
  "Learn from opportunities",
] as const;

export const SMARTASSIST_USER_FOCUS = [
  "Customers",
  "Opportunities",
  "Projects",
  "Decisions",
  "Revenue",
] as const;

export const SMARTASSIST_ASSISTANT_FOCUS = [
  "CRM maintenance",
  "Knowledge capture",
  "Intelligence gathering",
  "Documentation",
  "Opportunity discovery",
  "Follow-up management",
  "Administrative work",
] as const;

export const SMARTASSIST_MICHELIN_PRINCIPLE = [
  "Does it reduce workload?",
  "Does it improve company knowledge?",
  "Does it improve management visibility?",
] as const;

export const SMARTASSIST_LOOP = {
  steps: ["Observe", "Understand", "Suggest", "Prepare", "Approve"] as const,
  label: "Observe → Understand → Suggest → Prepare → Approve",
  observe: [
    "Meetings",
    "Emails",
    "Calls",
    "Activities",
    "Documents",
    "Projects",
    "Opportunities",
    "Planner Tasks",
  ],
  understand: [
    "What happened?",
    "What changed?",
    "What matters?",
    "What is missing?",
    "What is at risk?",
    "What opportunity exists?",
  ],
  suggest: [
    "CRM updates",
    "Follow-ups",
    "Stakeholders",
    "Opportunity actions",
    "Documents",
    "Business actions",
  ],
  prepare: [
    "Draft emails",
    "Draft activities",
    "Draft follow-ups",
    "Draft proposals",
    "Draft CRM updates",
  ],
  approve: "Users remain in control.",
} as const;

export const SMARTASSIST_KNOWLEDGE_SOURCES = [
  "CRM",
  "SharePoint",
  "Activities",
  "Opportunities",
  "Contacts",
  "Companies",
  "Projects",
  "Documents",
  "Quotations",
  "Budget Proposals",
  "Business Cases",
  "Contracts",
  "Lessons Learned",
  "Meetings",
  "Emails",
  "Planner",
  "Teams",
] as const;

export const SMARTASSIST_RESEARCH_INTERNAL_SOURCES = [
  "CRM",
  "Companies",
  "Contacts",
  "Activities",
  "Opportunities",
  "Projects",
  "SharePoint",
  "Quotations",
  "Budget Proposals",
  "Contracts",
  "Business Cases",
  "Lessons Learned",
  "Reference Projects",
  "Meeting Notes",
  "Emails",
] as const;

export const SMARTASSIST_RESEARCH_EXTERNAL_SOURCES = [
  "Company Websites",
  "LinkedIn",
  "Press Releases",
  "Industry Media",
  "Tender Platforms",
  "Funding Programs",
  "Public Filings",
  "Environmental Permits",
  "Project Announcements",
  "Investment News",
  "Social Media",
  "Recruitment Announcements",
] as const;

export const SMARTASSIST_MISSION_QUESTIONS = [
  "Is this opportunity worth our resources?",
  "What should we do next?",
  "What should we sell next?",
  "What is the fastest path to revenue?",
  "What is preventing a signed contract?",
  "Which opportunities deserve our attention?",
] as const;

export const SMARTASSIST_COMMERCIAL_QUESTIONS = [
  "Should we pursue?",
  "Why will they buy?",
  "Can they buy?",
  "Can they implement?",
  "Can we deliver?",
  "What is blocking the contract?",
  "What should we sell next?",
  "What is the fastest path to revenue?",
] as const;

export const SMARTASSIST_KNOWLEDGE_QUESTIONS = [
  "Have we done this before?",
  "Do we have a similar project?",
  "Do we have a quotation?",
  "What proposal should we use?",
  "What template should we use?",
  "What relevant knowledge exists?",
] as const;

export const SMARTASSIST_OPTIMIZE_FOR = [
  "Revenue",
  "Contract Readiness",
  "Commercial Viability",
  "Resource Efficiency",
  "Executive Visibility",
  "Strategic Growth",
] as const;

export const SMARTASSIST_INPUT_PLACEHOLDER =
  "What should I focus on today?";

export const SMARTASSIST_CONVERSATION = {
  title: "Business Development Assistant",
  subtitle: "Ask natural business questions — I know where your knowledge lives.",
  neverFail: "A partial useful answer is always better than failure.",
  exampleQuestions: [
    "What should I focus on today?",
    "Research PYREG",
    "What is blocking this contract?",
    "Deep dive Swedish biochar market",
    "Have we done this before?",
  ],
} as const;

export const SMARTASSIST_BUSINESS_IMPACT = {
  title: "Business Impact Mode",
  advisorNote: "Business advisor first — task manager second. You decide; I prepare.",
  philosophy:
    "Explain why it matters before what to do. Prioritize revenue, relationships, and commercial impact over CRM administration.",
  sections: [
    "Situation",
    "Impact",
    "Recommended Action",
    "Estimated Effort",
    "Expected Outcome",
  ],
  intros: {
    focus_today: "Ranked by commercial and relationship impact, I recommend focusing on:",
    forgetfulness: "These items may be costing you momentum or revenue:",
    importance_now: "Highest business impact right now:",
    next_action: "The highest-value action from your portfolio:",
    at_risk_customer: "Accounts where relationship risk threatens commercial outcomes:",
    at_risk_opportunity: "Opportunities ranked by revenue and contract impact:",
    default: "Here is my business assessment from your CRM context:",
  },
} as const;

export const SMARTASSIST_COPILOT = {
  title: "Active Assist",
  subtitle:
    "I prepare the next work — create, remind, update. You approve. SmartCRM stays active, not passive.",
  loop: SMARTASSIST_LOOP.label,
  objective: "Reduce manual CRM work. Users approve rather than create.",
  successMetric: "Reducing the amount of manual CRM work required from users.",
  actions: ["Approve", "Dismiss", "Review"] as const,
  identifies: [
    "Activity updates",
    "Opportunity updates",
    "Stakeholder updates",
    "Commitment updates",
    "Follow-ups",
    "Relationship changes",
  ],
} as const;

export const SMARTASSIST_COMMERCIAL = {
  title: "Commercial Assistant",
  subtitle: "Help win contracts — machinery, engineering, and paid professional services.",
  questions: SMARTASSIST_COMMERCIAL_QUESTIONS,
} as const;

export const SMARTASSIST_KNOWLEDGE = {
  title: "Knowledge Assistant",
  subtitle: "Reuse company knowledge — activities, documents, quotations, lessons learned.",
  philosophy:
    "SmartCRM is the company knowledge platform. Users never need to know where information is stored.",
  questions: SMARTASSIST_KNOWLEDGE_QUESTIONS,
  sections: [
    "What Happened",
    "What Was Agreed",
    "What Happens Next",
    "Risks",
    "Decisions",
    "Commitments",
    "Stakeholders",
    "Linked Context",
    "SmartAssist Assessment",
  ],
} as const;

export const SMARTASSIST_PLATFORM = {
  title: "Knowledge Platform",
  subtitle: "SmartCRM is not simply a CRM — it is Standard Bio's company knowledge platform.",
  sources: SMARTASSIST_KNOWLEDGE_SOURCES,
} as const;

export const SMARTASSIST_DEEP_RESEARCH = {
  title: "Deep Research Mode",
  subtitle:
    "Intelligence analyst, business researcher, commercial advisor and knowledge navigator — structured executive briefings in minutes.",
  purpose: "Save users hours of research and provide structured executive-level briefings.",
  roles: [
    "Intelligence analyst",
    "Business researcher",
    "Commercial advisor",
    "Knowledge navigator",
  ],
  exampleQueries: [
    "Research PYREG",
    "What is blocking this contract?",
    "Analyze Norske Skog",
    "Tell me everything about this customer",
    "Research this competitor",
    "Analyze this technology",
    "Investigate this project",
    "Deep dive Swedish biochar market",
  ],
  combines: [
    "CRM Knowledge",
    "SharePoint Knowledge",
    "Activities",
    "Opportunities",
    "Documents",
    "Meetings",
    "Emails",
    "Projects",
    "Public Sources",
    "Industry Sources",
    "Investment Sources",
    "Competitor Sources",
  ],
  internalSources: SMARTASSIST_RESEARCH_INTERNAL_SOURCES,
  externalSources: SMARTASSIST_RESEARCH_EXTERNAL_SOURCES,
  companySections: [
    "Executive Summary",
    "Why It Matters",
    "Known Internal Relationship",
    "Recent News",
    "Project Signals",
    "Risks",
    "Opportunities",
    "Recommended Actions",
    "Overall Assessment",
  ],
} as const;

export const SMARTASSIST_RESEARCH_REPORT_TYPES = [
  "Executive Briefing",
  "Opportunity Assessment",
  "Customer Deep Dive",
  "Competitor Deep Dive",
  "Market Intelligence Report",
  "Investment Intelligence Report",
] as const;

export const SMARTASSIST_RESEARCH_REPORT_SECTIONS = [
  "Executive Summary",
  "Why This Matters",
  "Findings",
  "Opportunities",
  "Risks",
  "Recommended Actions",
  "Strategic Assessment",
  "Sources",
] as const;

export const SMARTASSIST_RESEARCH_REPORT_EXPORTS = ["DOCX", "PDF", "SharePoint Page"] as const;

export const SMARTASSIST_RESEARCH_REPORTS = {
  title: "Research Report Generation",
  subtitle:
    "Every Deep Research result generates structured reports stored in SharePoint and searchable in the knowledge base.",
  reportTypes: SMARTASSIST_RESEARCH_REPORT_TYPES,
  sections: SMARTASSIST_RESEARCH_REPORT_SECTIONS,
  exportFormats: SMARTASSIST_RESEARCH_REPORT_EXPORTS,
  storage:
    "SharePoint with Standard Bio metadata, categories, document types and project/customer links.",
  knowledgeBase:
    "Every report becomes part of the company knowledge base — searchable and reusable by SmartAssist in future research.",
} as const;

export const SMARTASSIST_SALES_INTELLIGENCE = {
  title: "Sales Intelligence",
  evaluates: [
    "Relationship Health",
    "Opportunity Health",
    "Stakeholder Coverage",
    "Commercial Momentum",
    "Engagement Trends",
    "Commitment Tracking",
  ],
  identifies: [
    "At-risk opportunities",
    "Missing stakeholders",
    "Relationship gaps",
    "Inactive accounts",
    "Expansion opportunities",
    "Cross-selling opportunities",
  ],
  alwaysRecommend: "What commercial action creates the highest value?",
} as const;

export const SMARTASSIST_MARKETING_INTELLIGENCE = {
  title: "Marketing Intelligence",
  evaluates: [
    "Markets",
    "Industries",
    "Competitors",
    "Technology trends",
    "Customer interests",
    "Research findings",
  ],
  identifies: [
    "Emerging market opportunities",
    "Strategic themes",
    "Competitive threats",
    "Content opportunities",
    "Market momentum shifts",
  ],
  alwaysRecommend: "What marketing action creates the highest value?",
} as const;

export const SMARTASSIST_RELATIONSHIP_INTELLIGENCE_CONSTITUTION = {
  title: "Relationship Intelligence",
  principle: "Relationships are more important than records.",
  identifies: [
    "Key stakeholders",
    "Relationship strength",
    "Relationship gaps",
    "Decision makers",
    "Influencers",
    "Sponsors",
    "Missing contacts",
  ],
  alwaysRecommend: "Who should we engage next?",
} as const;

export const SMARTASSIST_DEEP_RESEARCH_INTELLIGENCE = {
  title: "Deep Research Intelligence",
  principle: "Deep Research is an organizational asset.",
  leverage: [
    "Previous Deep Research",
    "Research Reports",
    "SmartDocs",
    "Market Intelligence",
    "Competitor Intelligence",
    "Customer Intelligence",
  ],
  rule: "Always avoid duplicating existing knowledge.",
} as const;

export const SMARTASSIST_REGULATORY_LEVELS = {
  purpose:
    "Determine whether a project can realistically be approved, funded, permitted and built.",
  objective: "Predictability — not compliance.",
  national: [
    "National legislation",
    "Environmental regulations",
    "Waste regulations",
    "Emissions regulations",
    "Construction regulations",
    "Biochar regulations",
    "Carbon regulations",
    "Energy regulations",
  ],
  regional: [
    "Regional authorities",
    "Regional policies",
    "Development plans",
    "Environmental requirements",
    "Regional funding opportunities",
  ],
  local: [
    "Municipal regulations",
    "Local planning requirements",
    "Land-use restrictions",
    "Zoning requirements",
    "Infrastructure requirements",
    "Local environmental concerns",
  ],
  project: [
    "Technology",
    "Feedstock",
    "Capacity",
    "Emissions",
    "Site characteristics",
    "Utilities",
    "Logistics",
  ],
  projectQuestions: [
    "What regulations apply?",
    "What local requirements apply?",
    "Which authorities are involved?",
    "Which permits may be required?",
    "What are the major risks?",
    "What is the expected approval timeline?",
    "What funding opportunities may exist?",
    "What should Standard Bio do next?",
  ],
} as const;

export const SMARTASSIST_PROJECT_QUALIFICATION = {
  title: "Project Qualification Intelligence",
  not: "Can we sell this?",
  is: "Can the customer realistically fund, approve, permit, build, and operate it?",
  evaluates: [
    "Commercial viability",
    "Funding viability",
    "Regulatory viability",
    "Permitting viability",
    "Strategic fit",
  ],
  alwaysProvide: ["Overall Assessment", "Recommended Next Step"],
} as const;

export const SMARTASSIST_RESPONSE_STANDARD = {
  sections: ["What is happening?", "Why does it matter?", "What should happen next?"],
  prioritize: ["Decision quality", "Business value", "Actionability"],
  deprioritize: ["Raw data", "Technical detail", "Information density"],
} as const;

export const SMARTASSIST_FINAL_CONSTITUTION = {
  mandate: SMARTASSIST_BUSINESS_DEVELOPMENT_MANDATE.statement,
  purpose: "Help Standard Bio make better business decisions with less effort.",
  transform: "Organizational knowledge into actionable intelligence.",
  minimize: "Manual input",
  maximize: "Insight",
  identifyEarly: ["Risks", "Opportunities"],
  guide: "Continuously toward the next best decision.",
  mantra: SMARTASSIST_BUSINESS_DEVELOPMENT_MANDATE.mantra,
} as const;

/** Assisted Configuration — SmartAssist manages workspace architecture; users decide. */
export const ASSISTED_CONFIGURATION = {
  objective:
    "A correctly configured business development workspace — not configuration for its own sake.",
  workspaceDesign:
    "SmartAssist designs the workspace from your business needs. You approve what to apply.",
  guides: [
    "Roles",
    "Permissions",
    "Ownership structures",
    "Integrations",
    "Knowledge sources",
    "Intelligence sources",
  ],
  principle: ASSISTED_EVERYTHING.userRequirement,
  customerManages: SMARTCRM_PLATFORM_CONSTITUTION.division.customer,
  smartAssistManages: SMARTCRM_PLATFORM_CONSTITUTION.division.smartAssist,
  architectureLayers: SMARTCRM_PLATFORM_CONSTITUTION.maintains,
  mantra: ASSISTED_EVERYTHING.mantra,
  recommendationBudget: 5,
} as const;

/** Phase 2.0 — SmartAssist Workspace Architect */
export const WORKSPACE_ARCHITECT = {
  title: "Workspace Architect",
  description:
    "Describe your business in plain language. SmartAssist designs, generates, and evolves your workspace — you approve what to apply.",
  principle: "Users describe business needs. SmartAssist handles technical implementation.",
  mantra: ASSISTED_EVERYTHING.mantra,
  vision:
    "SmartCRM is an Intelligent Workspace Platform — users should not configure CRM, they should describe their business.",
  hiddenImplementationDetails: [
    "SharePoint",
    "Google Workspace",
    "Azure",
    "Entra ID",
    "OAuth",
    "APIs",
    "Content Types",
    "Lists",
    "Libraries",
    "Relationships",
    "Schemas",
    "Metadata Models",
  ] as const,
  openingMessage:
    "Tell me about your business. I will design a workspace that fits how you sell, deliver, and grow — without asking you to configure technical systems.",
  completionMessage:
    "Thank you. I have enough to draft your workspace design. Review the proposal below and approve what SmartAssist should apply.",
  discoveryIntro:
    "Answer in your own words. SmartAssist translates business intent into workspace architecture.",
  designDomains: ASSISTED_CONFIGURATION.guides,
  architectureLayers: ASSISTED_CONFIGURATION.architectureLayers,
  loop: ASSISTED_EVERYTHING.loop,
  recommendationBudget: ASSISTED_CONFIGURATION.recommendationBudget,
  successCriteria: [
    "Users never need to understand SharePoint, OAuth, or schema design",
    "Business discovery drives workspace configuration",
    "The system does the thinking. The user makes the decision.",
  ],
} as const;

/** Phase 1.22 — Users & Access Management */
export const USERS_ACCESS_MANAGEMENT = {
  title: "Users & Access",
  description:
    "Manage Standard Bio users, roles, permissions, teams, ownership scope, and licenses. SmartAssist recommends access profiles from business responsibilities.",
  principle: ASSISTED_EVERYTHING.mantra,
  domains: [
    "Standard Bio Users",
    "Roles",
    "Permissions",
    "Teams",
    "Ownership",
    "Licenses",
  ],
  wizardQuestion: "What will this user do?",
  businessFunctions: [
    "Sales",
    "Marketing",
    "Management",
    "Engineering",
    "Service",
    "Administration",
  ] as const,
  continuousAudit: [
    "Users without roles",
    "Companies without owners",
    "Opportunities without owners",
    "Activities without owners",
    "Excessive permissions",
    "Inactive users",
  ],
} as const;

/** Phase 1.23 — Intelligent User Lifecycle Management */
export const USER_LIFECYCLE_MANAGEMENT = {
  title: "Intelligent User Lifecycle",
  mantra:
    "Users are not accounts. Users are business owners. SmartAssist answers who owns this, what happens if someone leaves, and what will break.",
  principle: ASSISTED_EVERYTHING.mantra,
  lifecycleActions: [
    "Add User",
    "Edit User",
    "Disable User",
    "Archive User",
    "Delete User",
    "Transfer Ownership",
    "Replace User",
  ],
  ownershipDimensions: [
    "Owned Companies",
    "Owned Contacts",
    "Owned Opportunities",
    "Owned Activities",
    "Owned Documents",
    "Open Commitments",
  ],
  healthChecks: [
    "Users without roles",
    "Inactive users",
    "Excessive permissions",
    "Orphaned records",
  ],
  successCriteria: [
    "Who owns this?",
    "What happens if someone leaves?",
    "What will break?",
  ],
} as const;

/** Phase 1.25 — Contact Lifecycle Management */
export const CONTACT_LIFECYCLE_MANAGEMENT = {
  title: "Contact Lifecycle",
  mantra: ASSISTED_EVERYTHING.mantra,
  principle:
    "Contacts are long-term relationships, not static records. Relationship history must never be lost when a contact changes role or company.",
  lifecycleActions: [
    "Edit Contact",
    "Delete Contact",
    "Archive Contact",
    "Merge Contact",
    "Transfer Contact",
    "Change Company",
    "Change Role",
    "Change Employment Status",
  ],
  employmentStatuses: [
    "Active",
    "Former Employee",
    "Left Company",
    "Retired",
    "Do Not Contact",
    "Suspicious",
  ] as const,
  smartAssistSignals: [
    "Contact moved company",
    "Contact changed role",
    "Potential duplicate contacts",
    "New relationship opportunities",
  ],
  preservedOnTransfer: [
    "Activity History",
    "Relationship History",
    "Emails",
    "Documents",
    "Opportunity References",
  ],
  trackedOnTransfer: ["Previous Company", "New Company", "Transfer Date"],
  successCriteria: [
    "Contacts are managed as long-term relationships, not static records.",
    "Relationship history must never be lost when a contact changes role or company.",
    "The system does the thinking. The user makes the decision.",
  ],
} as const;

/** Phase 1.27 — Contact Lifecycle & Relationship Intelligence */
export const CONTACT_RELATIONSHIP_INTELLIGENCE = {
  title: "Contact Lifecycle & Relationship Intelligence",
  mantra: ASSISTED_EVERYTHING.mantra,
  principle:
    "A contact is a person. A company affiliation may change. Relationship history must never be lost.",
  lifecycleActions: [
    "Edit Contact",
    "Delete Contact",
    "Archive Contact",
    "Change Company",
    "Change Position",
    "Merge Duplicate Contacts",
    "Former Employee Status",
    "Contact Timeline",
  ],
  smartAssistSignals: [
    "Contact role changes",
    "Contact company changes",
    "Potential duplicate contacts",
    "Relationship opportunities",
  ],
  preservedAcrossCompanyChange: [
    "Activity History",
    "Relationship History",
    "Career Timeline",
    "Company Transfer Records",
    "Opportunity References",
  ],
  successCriteria: [
    "A contact is a person — company affiliation may change",
    "Relationship history must never be lost",
    "The system does the thinking. The user makes the decision.",
  ],
} as const;

/** Phase 1.28 — Contact Page De-duplication (Michelin Principle) */
export const CONTACT_PAGE_DEDUPLICATION = {
  title: "Contact Page De-duplication",
  mantra: ASSISTED_EVERYTHING.mantra,
  principle: "Information must exist once. If content does not increase understanding, remove it.",
  tests: ["Apple Test", "Michelin Principle", "3-Second Test"] as const,
  hierarchy: [
    "Contact Header",
    "Relationship Intelligence",
    "Context",
    "Timeline",
    "History",
  ] as const,
  headerFields: ["Name", "Position", "Company", "Status", "Last Interaction"] as const,
  contextSections: ["Activities", "Documents", "Opportunities", "Emails"] as const,
  timelineRule:
    "Show career timeline only when multiple companies, roles, transfers, or closed positions exist.",
  historyRule: "Collapsed by default — edit form and secondary fields only; no duplicate identity.",
  removedDuplicates: [
    "Summary panel",
    "Standalone company panel",
    "Contact card repeating name/role/email/phone",
    "Redundant status badges",
  ],
  successCriteria: [
    "Each field appears once on Contact 360",
    "Timeline hidden for single company and single role",
    "History collapsed until the user needs it",
    "The system does the thinking. The user makes the decision.",
  ],
} as const;

/** Phase 1.28B — Contact Page Information Hierarchy */
export const CONTACT_PAGE_INFORMATION_HIERARCHY = {
  title: "Contact Page Information Hierarchy",
  mantra: ASSISTED_EVERYTHING.mantra,
  principle: "The most important information must appear first.",
  tests: ["Apple Test", "Michelin Principle", "3-Second Test"] as const,
  threeSecondQuestions: [
    "Who is this?",
    "How do I contact them?",
    "What is the relationship status?",
    "What should happen next?",
  ] as const,
  headerLeft: ["Name", "Position", "Company", "Email", "Phone"] as const,
  statusPanel: ["Employment Status", "Last Interaction", "Relationship Health"] as const,
  sectionOrder: [
    "Relationship Intelligence",
    "Attention",
    "Opportunities",
    "Activities",
    "Documents",
    "Timeline",
    "History",
  ] as const,
  timelineRule:
    "Hide timeline when no meaningful career or company changes exist.",
  successCriteria: [
    "Identity and reachability on the left; status grouped upper-right",
    "Sections ordered by business importance",
    "No unnecessary eye movement",
    "The system does the thinking. The user makes the decision.",
  ],
} as const;

/** Phase 1.31 — Contact Edit Experience */
export const CONTACT_EDIT_EXPERIENCE = {
  title: "Contact Edit Experience",
  mantra: ASSISTED_EVERYTHING.mantra,
  principle: "Edit Contact opens edit mode — not History.",
  tests: ["Apple Test", "3-Second Test", "Workspace Before Document"] as const,
  editFields: [
    "First Name",
    "Last Name",
    "Position",
    "Role",
    "Email",
    "Phone",
    "LinkedIn",
    "Status",
    "Employment Status",
    "Company",
  ] as const,
  historySections: ["Timeline", "Career Changes", "Activity History", "Employment Changes"] as const,
  actions: ["Save Changes", "Cancel"] as const,
  successCriteria: [
    "Users instantly understand they are editing the contact",
    "Editing and History are separate concepts",
    "Zero explanation required",
    "The system does the thinking. The user makes the decision.",
  ],
} as const;

export const OUTLOOK_RELATIONSHIP_RECONCILIATION = {
  title: "Outlook Relationship Reconciliation",
  mantra: ASSISTED_EVERYTHING.mantra,
  principle:
    "Users should not manually recreate information already available in connected systems. The assistant builds organizational knowledge automatically.",
  detects: [
    "Contacts with Outlook activity",
    "Companies with Outlook activity",
    "Opportunities with Outlook activity",
    "Missing CRM interactions",
  ],
  importActions: [
    "Import Email Summary",
    "Create Activities",
    "Update Last Interaction",
    "Build Relationship Timeline",
  ],
  healthSources: [
    "CRM Activities",
    "Outlook Emails",
    "Teams Meetings",
    "Calendar Events",
  ],
  successCriteria: [
    "No false 'No interaction' when Outlook has history",
    "User approves before CRM writes",
    "Relationship health reflects real engagement when connected",
    "The system does the thinking. The user makes the decision.",
  ],
} as const;

/** Phase 2.1 — Project Workspace Light */
export const PROJECT_DISCOVERY_PRINCIPLE = {
  title: "Project Discovery Principle",
  rule: "SmartAssist shall not generate project understanding from assumptions.",
  method: "Project understanding must be built through conversation and evidence.",
  onCreate: [
    "The assistant shall ask questions.",
    "The assistant shall gather information.",
    "The assistant shall identify gaps.",
  ],
  gatedOutputs: [
    "Objectives",
    "Risks",
    "Blockers",
    "Recommendations",
    "Next Actions",
  ],
  visibility: ["Known", "Assumed", "Unknown", "Missing Critical Information"],
  mantra: "The system does the thinking. The user makes the decision.",
} as const;

export const PROJECT_STAKEHOLDER_PERSISTENCE = {
  title: "Project Stakeholder Persistence",
  rule: "When a stakeholder is removed, the stakeholder shall remain removed.",
  assistant:
    "SmartAssist may suggest stakeholders but shall never automatically recreate removed stakeholders.",
  userOverride: "User decisions always override assistant assumptions.",
  mantra: "The assistant recommends. The user decides.",
} as const;

/** Phase 2.1 — Project Workspace Light */
export const PROJECT_WORKSPACE_LIGHT = {
  title: "Project Workspace Light",
  mantra: ASSISTED_EVERYTHING.mantra,
  description:
    "Lightweight project workspace for customer projects, internal projects, strategic initiatives, and research. Projects are coordinated efforts toward a defined outcome — not task lists.",
  principle: "Workspace before document. The system does the thinking. The user makes the decision.",
  tests: ["Apple Test", "Michelin Principle", "Workspace Before Document"] as const,
  roles: [
    "Project Assistant",
    "Project Coordinator",
    "Project Analyst",
    "Project Memory",
    "Project Coach",
  ] as const,
  sections: [
    "Project Header",
    "Project Objective",
    "SmartAssist Project Intelligence",
    "Stakeholders",
    "Activities",
    "Documents",
    "Milestones",
    "Decisions",
    "Risks",
  ] as const,
  pilotProjects: ["Escalante", "SmartCRM Platform"] as const,
  successCriteria: [
    "Projects feel like coordinated efforts — not task lists",
    "SmartAssist surfaces health, attention, and next action",
    "Pilot projects are navigable from the Projects directory",
    "The system does the thinking. The user makes the decision.",
  ],
} as const;

/** Global UX — Filter Transparency (AD-001) */
export const FILTER_TRANSPARENCY = {
  id: "AD-001",
  title: "Filter Transparency",
  status: "Accepted" as const,
  docPath: "docs/architecture/AD-001-filter-transparency.md",
  mantra: ASSISTED_EVERYTHING.mantra,
  decision:
    "All filtered collections shall display filtered count, total count, active filters, remove-filter actions, and clear-all. Filtering shall never be hidden.",
  rationale: [
    "Supports transparency and trust",
    "Apple Test compliance",
    "Improves decision quality",
  ] as const,
  principle:
    "Users must always understand why records appear and why records do not appear. Never hide active filters behind menus.",
  tests: ["Apple Test", "3-Second Test", "Transparency Principle"] as const,
  displays: [
    "Filtered count",
    "Total count",
    "Active filters",
    "Remove filter",
    "Clear all filters",
  ] as const,
  implementation: {
    bar: "src/components/ui/filter-transparency-bar.tsx",
    toolbar: "src/components/ui/filter-toolbar.tsx",
    summary: "src/lib/workspace-filter-summary.ts",
  } as const,
  workspaces: [
    "Companies",
    "Contacts",
    "Opportunities",
    "Activities",
    "Projects",
    "Documents",
    "SmartDocs",
    "Intelligence",
    "Search Results",
  ] as const,
  successCriteria: [
    "Showing X of Y is visible whenever records are filtered",
    "Active filters are always visible — never buried in menus",
    "Each filter can be removed individually; clear all resets the view",
    "The system does the thinking. The user makes the decision.",
  ],
} as const;

/** Registry of accepted architecture decisions */
export const ARCHITECTURE_DECISIONS = {
  "AD-001": FILTER_TRANSPARENCY,
} as const;

export type ArchitectureDecisionId = keyof typeof ARCHITECTURE_DECISIONS;
