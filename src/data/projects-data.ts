import type { Project } from "@/types/project";

/** Pilot projects — Phase 2.1 */
export const PROJECTS: Project[] = [
  {
    id: "PRJ-CARBON-EMERGENTE",
    name: "Escalante",
    kind: "customer",
    owner: "Mats Borgersen",
    status: "Active",
    stage: "Operational",
    priority: "High",
    health: "Healthy",
    strategicImportance: "High",
    objective:
      "Maintain customer relationship after installation and commissioning — follow-up, support, and future opportunity development.",
    problem: "",
    successCriteria:
      "Stable operational relationship, timely follow-up, and clear path to expansion opportunities when evidence emerges.",
    // Reality First: no company account until Escalante (or another org) is
    // explicitly linked on the project. Do not use DorsetGM (CO-1009) as a placeholder.
    linkedCompanyId: undefined,
    linkedDealId: "PL-1031",
    relatedOrganizations: [],
    projectStakeholders: [
      {
        id: "ps-ce-cl",
        role: "Commercial Lead",
        name: "Mats Borgersen",
        userId: 1,
        organizationId: "org-internal-standard-bio",
      },
    ],
    team: [],
    milestones: [
      {
        id: "ms-ce-1",
        title: "Reactor vessel delivered to site",
        owner: "Marcus Halvorsen",
        status: "Complete",
        targetDate: "2026-05-15",
      },
      {
        id: "ms-ce-2",
        title: "Electrical and safety integration sign-off",
        owner: "Jonas Berg",
        status: "Complete",
        targetDate: "2026-06-28",
      },
      {
        id: "ms-ce-3",
        title: "Feedstock qualification run",
        owner: "Mats Borgersen",
        status: "Complete",
        targetDate: "2026-07-20",
      },
      {
        id: "ms-ce-4",
        title: "Commercial commissioning",
        owner: "Mats Borgersen",
        status: "Complete",
        targetDate: "2026-08-30",
      },
    ],
    decisions: [
      {
        id: "dec-ce-1",
        decision: "Project commissioned and moved to operational follow-up",
        date: "2026-08-30",
        owner: "Mats Borgersen",
      },
    ],
    risks: [],
  },
  {
    id: "PRJ-SMARTCRM-PLATFORM",
    name: "SmartCRM Platform",
    kind: "strategic",
    owner: "Mats Borgersen",
    status: "Active",
    stage: "Execution",
    priority: "High",
    health: "Healthy",
    strategicImportance: "Critical",
    objective:
      "Evolve SmartCRM from CRM into an Intelligent Workspace Platform where SmartAssist designs, coordinates, and remembers.",
    problem:
      "Teams still configure systems manually. Relationship intelligence is fragmented across deals, contacts, and documents.",
    successCriteria:
      "Workspace Architect live, project coordination model proven, and pilot users describe business needs instead of configuring CRM.",
    linkedCompanyId: undefined,
    linkedDealId: undefined,
    relatedOrganizations: [],
    projectStakeholders: [
      {
        id: "ps-sc-pm",
        role: "Project Manager",
        name: "Walter Aker",
        userId: 100,
        organizationId: "org-internal-standard-bio",
      },
      {
        id: "ps-sc-pe",
        role: "Technical Lead",
        name: "Hugo Jansson",
        userId: 101,
        organizationId: "org-internal-standard-bio",
      },
      {
        id: "ps-sc-ca",
        role: "Commercial Lead",
        name: "Mats Borgersen",
        userId: 1,
        organizationId: "org-internal-standard-bio",
      },
      {
        id: "ps-sc-es",
        role: "Executive Sponsor",
        name: "Bjørn Molskred",
        userId: 103,
        organizationId: "org-internal-standard-bio",
        influence: "High",
      },
    ],
    team: [],
    milestones: [
      {
        id: "ms-sc-1",
        title: "Contact & relationship intelligence parity",
        owner: "Platform Team",
        status: "Complete",
        targetDate: "2026-06-01",
      },
      {
        id: "ms-sc-2",
        title: "Workspace Architect conversational setup",
        owner: "Platform Team",
        status: "Complete",
        targetDate: "2026-07-01",
      },
      {
        id: "ms-sc-3",
        title: "Project Workspace Light pilot",
        owner: "Platform Team",
        status: "In Progress",
        targetDate: "2026-07-15",
      },
      {
        id: "ms-sc-4",
        title: "Portfolio project intelligence rollout",
        owner: "Platform Team",
        status: "Planned",
        targetDate: "2026-09-01",
      },
    ],
    decisions: [
      {
        id: "dec-sc-1",
        decision: "Projects are coordinated efforts — not task lists; separate entity from opportunities",
        date: "2026-07-01",
        owner: "Platform Team",
      },
      {
        id: "dec-sc-2",
        decision: "SmartAssist acts as project assistant, coordinator, analyst, memory, and coach",
        date: "2026-07-05",
        owner: "Commercial Leadership",
      },
    ],
    risks: [
      {
        id: "risk-sc-1",
        risk: "Feature sprawl without workspace hierarchy discipline",
        impact: "Users return to document-first workflows; platform vision diluted",
        recommendedAction: "Apply Apple Test and Michelin Principle to every new surface",
        severity: "warning",
      },
    ],
  },
];
