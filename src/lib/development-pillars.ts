/**
 * Development checklist (FS-005B) — what belongs under each "Secure …" step.
 *
 * Rule: a step only lists things about OUR plant for THAT step. Facts about the host's own
 * biogas plant (its site, gas, outputs, permit) and work that belongs to another step never
 * appear under it. Nothing is deleted; it is simply not shown as evidence for the wrong step.
 */

import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { Project, ProjectDecision, ProjectMilestone } from "@/types/project";
import {
  INTERNAL_ORGANIZATION_ID,
  type ProjectOrganizationType,
  type ProjectRelatedOrganization,
  type ProjectStakeholderRecord,
} from "@/types/project-relationships";
import type { UnderstandingFieldId } from "@/types/opportunity-understanding";
import {
  getProjectRelatedOrganizations,
  getProjectStakeholders,
} from "@/lib/project-relationship-utils";

export type DevelopmentPillar = {
  fieldId: UnderstandingFieldId;
  /** Plain name shown on the checklist. */
  title: string;
  /** Words that tie a milestone or decision to this step. */
  keywords: RegExp;
};

/** The seven things to secure, in FEL 1 → Realisation order. */
export const DEVELOPMENT_PILLARS: readonly DevelopmentPillar[] = [
  {
    fieldId: "site_readiness",
    title: "Land plot",
    keywords: /\b(plot|land ?owner|landowner|land|lease|rent|purchase|footprint|site visit|tomt)\b/i,
  },
  {
    fieldId: "feedstock_agreement",
    title: "Feedstock",
    keywords: /\b(wood ?chips?|feedstock|g30|moisture|tipping|allskog|treflis|flis)\b/i,
  },
  {
    fieldId: "utilities",
    title: "Required utilities",
    keywords: /\b(utilit(y|ies)|tie-?ins?|ducts?|piping|power|water|capacity data|heat exchange)\b/i,
  },
  {
    fieldId: "offtake_strategy",
    title: "Energy offtake",
    keywords: /\b(thermal|heat price|tariff|energy offtake|gwh|steam)\b/i,
  },
  {
    fieldId: "end_product",
    title: "Product offtake (biochar)",
    keywords: /\b(biochar|terra ?marine|carbon (credit|removal)|activated)\b/i,
  },
  {
    fieldId: "public_funding",
    title: "Subsidies",
    keywords: /\b(subsid(y|ies)|grants?|enova|innovation norway)\b/i,
  },
  {
    fieldId: "permitting",
    title: "Permitting",
    keywords: /\b(permits?|permitting|licen[sc]e|tillatelse|authorit(y|ies)|environmental approval)\b/i,
  },
];

/** Needed for the plant too, but not one of the seven. Shown right after them. */
export const DEVELOPMENT_ALSO_NEEDED: readonly UnderstandingFieldId[] = [
  "funding_source",
  "decision_maker",
];

const PILLAR_FIELD_IDS = new Set<UnderstandingFieldId>(DEVELOPMENT_PILLARS.map((p) => p.fieldId));
const ALSO_NEEDED_IDS = new Set<UnderstandingFieldId>(DEVELOPMENT_ALSO_NEEDED);

export function isDevelopmentPillarField(fieldId: UnderstandingFieldId): boolean {
  return PILLAR_FIELD_IDS.has(fieldId);
}

export function isDevelopmentAlsoNeededField(fieldId: UnderstandingFieldId): boolean {
  return ALSO_NEEDED_IDS.has(fieldId);
}

/**
 * Findings that describe the HOST's own plant (Vest Biogass), not our plant. They are read from
 * web pages and permits with sale-style wording and used to land on our steps by mistake
 * (e.g. "The site is named in the source" under Land plot).
 */
const HOST_PLANT_CLAIM =
  /^(?:Reported plant volume|Reported feedstock mix|Reported outputs|Reported start of sales)|^The site is named in the source|^The source describes plant buildings|^The source indicates gas offtake|^The source reports an environmental approval|^Permit \/ certificate filed on record|^The permit requires a closed process|^The source describes Antec ownership|^Permit 20\d{2}\.\d{4}\.T\b/i;

export function isHostPlantClaim(
  statement: string,
  plantScope?: "our_plant" | "host_plant",
): boolean {
  if (plantScope === "host_plant") return true;
  if (plantScope === "our_plant") return false;
  return HOST_PLANT_CLAIM.test(statement.trim());
}

export type LinkedWorkItem = {
  id: string;
  kind: "planned" | "decided";
  text: string;
  /** Person responsible, when known. */
  owner: string;
  /** ISO date, when known. */
  date: string;
  /** Milestone status, for planned work. */
  status?: string;
};

/** The one step a piece of text belongs to, or null when it fits none (never guessed). */
export function pillarForText(text: string): UnderstandingFieldId | null {
  const matches = DEVELOPMENT_PILLARS.filter((pillar) => pillar.keywords.test(text));
  // A text that touches several steps is not evidence for any one of them.
  return matches.length === 1 ? matches[0].fieldId : null;
}

/** Project milestones and decisions grouped under the step they are about. */
export function linkedWorkByPillar(
  milestones: readonly ProjectMilestone[],
  decisions: readonly ProjectDecision[],
): Partial<Record<UnderstandingFieldId, LinkedWorkItem[]>> {
  const out: Partial<Record<UnderstandingFieldId, LinkedWorkItem[]>> = {};
  const push = (fieldId: UnderstandingFieldId | null, item: LinkedWorkItem) => {
    if (!fieldId) return;
    (out[fieldId] ??= []).push(item);
  };
  for (const milestone of milestones) {
    push(pillarForText(milestone.title), {
      id: milestone.id,
      kind: "planned",
      text: milestone.title,
      owner: milestone.owner,
      date: milestone.targetDate,
      status: milestone.status,
    });
  }
  for (const decision of decisions) {
    push(pillarForText(decision.decision), {
      id: decision.id,
      kind: "decided",
      text: decision.decision,
      owner: decision.owner,
      date: decision.date,
    });
  }
  return out;
}

export type PillarCounterpartyBinding = {
  fieldId: UnderstandingFieldId;
  pillarTitle: string;
  organizationId?: string;
  companyId?: string;
  companyName?: string;
  organizationType?: ProjectOrganizationType;
  organizationRoleLabel?: string;
  stakeholderName?: string;
  stakeholderContactId?: string;
  stakeholderRole?: string;
  internalLeadName?: string;
  internalLeadRole?: string;
  lastTouchDate?: string;
  lastTouchSummary?: string;
  missingCounterpartyReason?: string;
};

export type PillarExecutionDraft = {
  fieldId: UnderstandingFieldId;
  pillarTitle: string;
  emailSubject: string;
  emailBody: string;
  mailtoHref: string;
  outlookWebHref: string;
  taskTitle: string;
  taskOwner: string;
  whyItMatters: string;
};

const PILLAR_EVIDENCE_REQUIREMENTS: Partial<
  Record<
    UnderstandingFieldId,
    {
      askSummary: string;
      checklist: string[];
      whyItMatters: string;
      missingOrgHint: string;
    }
  >
> = {
  site_readiness: {
    askSummary: "plot lease/purchase structure, exact boundary (~m²), and site access",
    checklist: [
      "Plot footprint (m²) and exact boundary coordinates next to the host plant",
      "Lease vs. purchase commercial terms and duration",
      "Heavy truck access and site preparation responsibilities",
    ],
    whyItMatters:
      "We carry the capital on a development plant — without signed site control, engineering and permitting are at risk.",
    missingOrgHint: "No host or landowner organization linked on this project yet.",
  },
  feedstock_agreement: {
    askSummary: "annual committed volume (t/yr), dry matter / moisture %, delivery tipping access, and contract term",
    checklist: [
      "Committed annual volume (t/yr) and seasonal delivery cadence",
      "Dry matter / moisture % specification and chip size (e.g. G30 wood chips)",
      "On-site unloading format (side/rear tip), storage buffer, pricing, and term",
    ],
    whyItMatters:
      "A pyrolysis plant cannot be financed or sized without bankable feedstock supply and moisture specs.",
    missingOrgHint: "No feedstock supplier organization linked on this project yet.",
  },
  utilities: {
    askSummary: "thermal heat tie-in points, electrical power capacity (kW), and water/discharge interface",
    checklist: [
      "Thermal heat exchange tie-in points, medium (steam / hot water), and temperatures",
      "Available electrical power capacity (kW / MW) at the boundary",
      "Water supply and closed-loop condensate / discharge limits",
    ],
    whyItMatters:
      "Utility tie-ins define the physical interface and boundary of supply between our plant and the host facility.",
    missingOrgHint: "No host utility partner organization linked on this project yet.",
  },
  offtake_strategy: {
    askSummary: "surplus thermal energy volume (GWh/yr), tariff structure, delivery temperature, and term",
    checklist: [
      "Annual thermal energy volume (GWh/yr or MWh/yr) and baseload profile",
      "Energy price / tariff indexing and minimum take-or-pay commitment",
      "Contract duration aligned with project finance horizon",
    ],
    whyItMatters:
      "Surplus thermal heat revenue anchors local project cashflow and host plant integration.",
    missingOrgHint: "No energy offtaker organization linked on this project yet.",
  },
  end_product: {
    askSummary: "biochar quality/activation specification, annual tonnage, pricing, and carbon credit (CORC) path",
    checklist: [
      "Biochar physical and chemical quality specification (e.g. activated biochar / EBC grade)",
      "Annual offtake volume (t/yr), delivery packaging, and pricing formula",
      "Carbon removal credit (CORC) registration and revenue split",
    ],
    whyItMatters:
      "Biochar product and carbon revenue are required to reach financial close on a Build-Own-Operate plant.",
    missingOrgHint: "No biochar product offtaker organization linked on this project yet.",
  },
  public_funding: {
    askSummary: "public subsidy scheme eligibility (e.g. Enova / Innovation Norway), application milestone, and grant share",
    checklist: [
      "Applicable public funding program and qualification criteria",
      "Application submission deadline and required FEL engineering documentation",
      "Target grant amount and state-aid / co-financing conditions",
    ],
    whyItMatters:
      "Public subsidies materially reduce Standard Bio's equity exposure and improve project IRR before FID.",
    missingOrgHint: "No public funding body or subsidy authority linked in Organizations yet.",
  },
  permitting: {
    askSummary: "separate pyrolysis & dryer permit pathway, responsible authority, and approval timeline",
    checklist: [
      "Confirmation whether the pyrolysis line and dryer require a separate permit or modification",
      "Lead regulatory authority (Statsforvalteren / Miljødirektoratet / municipality zoning)",
      "Expected processing timeline, emission/odour caps, and fast-track eligibility",
    ],
    whyItMatters:
      "No permit means no plant. Regulatory gates must be cleared on our own pyrolysis installation, separate from the host plant's permit.",
    missingOrgHint: "No regulatory or permitting authority linked in Organizations yet.",
  },
  funding_source: {
    askSummary: "ownership structure (full BOO vs. JV) and project finance / equity allocation",
    checklist: [
      "Ownership split (Standard Bio BOO vs. co-ownership / JV with host or investor)",
      "Debt vs. equity structure and capital conditions for financial close",
    ],
    whyItMatters:
      "Ownership and capital structure govern who signs off FID and how risks and returns are shared.",
    missingOrgHint: "No co-investor or financing partner linked in Organizations yet.",
  },
  decision_maker: {
    askSummary: "authorized signatories across land, feedstock, utility, and offtake agreements",
    checklist: [
      "Named signatory with board/investment authority on each counterparty side",
      "Target signing sequence from term sheet to binding agreements",
    ],
    whyItMatters:
      "Agreements stall at legal review when signatories and approval thresholds are not named early.",
    missingOrgHint: "No external decision maker on the project roster yet.",
  },
};

function selectOrgForPillar(
  fieldId: UnderstandingFieldId,
  orgs: ProjectRelatedOrganization[],
  companyById: Map<string, Company>,
): ProjectRelatedOrganization | undefined {
  const textOf = (org: ProjectRelatedOrganization) => {
    const comp = companyById.get(org.companyId);
    return `${org.label ?? ""} ${comp?.Title ?? ""} ${org.organizationType}`.toLowerCase();
  };

  switch (fieldId) {
    case "site_readiness":
      return (
        orgs.find((o) => /\b(host|land|plot|site|neighbour|tomt)\b/i.test(textOf(o))) ??
        orgs.find((o) => o.isPrimary) ??
        orgs.find((o) => o.organizationType === "partner" || o.organizationType === "customer")
      );
    case "feedstock_agreement":
      return (
        orgs.find(
          (o) =>
            o.organizationType === "supplier" ||
            /\b(feedstock|wood|flis|allskog|timber|biomass)\b/i.test(textOf(o)),
        )
      );
    case "utilities":
      return (
        orgs.find((o) => /\b(utilit|heat|thermal|biogas|biogass|host)\b/i.test(textOf(o))) ??
        orgs.find((o) => o.isPrimary) ??
        orgs.find((o) => o.organizationType === "partner" || o.organizationType === "customer")
      );
    case "offtake_strategy":
      return (
        orgs.find(
          (o) =>
            o.organizationType === "customer" &&
            /\b(thermal|heat\s+offtake|energy\s+offtake|gwh|biogass)\b/i.test(textOf(o)),
        ) ??
        orgs.find((o) => /\b(thermal|heat\s+offtake|energy\s+offtake|gwh|biogass)\b/i.test(textOf(o))) ??
        orgs.find((o) => o.organizationType === "customer") ??
        orgs.find((o) => o.isPrimary)
      );
    case "end_product":
      return orgs.find(
        (o) =>
          /\b(biochar|biokull|terramarine|terra\s*marine|carbon|corc|product\s+offtake)\b/i.test(
            textOf(o),
          ) && o.organizationType !== "supplier",
      );
    case "public_funding":
      return orgs.find(
        (o) =>
          /\b(enova|innovasjon\s+norge|innovation\s+norway|subsid|grant|skattefunn|public)\b/i.test(
            textOf(o),
          ) || o.organizationType === "investor",
      );
    case "permitting":
      return orgs.find(
        (o) =>
          o.organizationType === "regulator" ||
          /\b(statsforvalteren|miljødirektoratet|kommune|regulator|permit|authority)\b/i.test(
            textOf(o),
          ),
      );
    case "funding_source":
      return (
        orgs.find((o) => o.organizationType === "investor") ??
        orgs.find((o) => o.isPrimary)
      );
    case "decision_maker":
      return orgs.find((o) => o.isPrimary) ?? orgs[0];
    default:
      return undefined;
  }
}

function selectStakeholdersForPillar(
  fieldId: UnderstandingFieldId,
  matchedOrg: ProjectRelatedOrganization | undefined,
  stakeholders: ProjectStakeholderRecord[],
): {
  external?: ProjectStakeholderRecord;
  internal?: ProjectStakeholderRecord;
} {
  const internalList = stakeholders.filter(
    (s) => s.organizationId === INTERNAL_ORGANIZATION_ID || Boolean(s.userId),
  );
  const externalList = stakeholders.filter(
    (s) => s.organizationId !== INTERNAL_ORGANIZATION_ID && !s.userId,
  );

  const internal =
    fieldId === "utilities" || fieldId === "permitting"
      ? internalList.find((s) => /technical|engineering|eic/i.test(s.role)) ??
        internalList.find((s) => /project manager/i.test(s.role)) ??
        internalList[0]
      : fieldId === "site_readiness"
        ? internalList.find((s) => /project manager/i.test(s.role)) ?? internalList[0]
        : internalList.find((s) => /commercial|project manager/i.test(s.role)) ?? internalList[0];

  const scopedExternal = matchedOrg
    ? externalList.filter((s) => s.organizationId === matchedOrg.id)
    : [];

  const preferExternal = (list: ProjectStakeholderRecord[]) => {
    if (fieldId === "utilities") {
      return (
        list.find((s) => /technical|engineering|project sponsor/i.test(s.role)) ??
        list.find((s) => /decision maker/i.test(s.role)) ??
        list[0]
      );
    }
    if (fieldId === "feedstock_agreement") {
      return (
        list.find((s) => /supplier|procurement|commercial|decision maker/i.test(s.role)) ??
        list[0]
      );
    }
    return (
      list.find((s) => /decision maker|project sponsor|executive sponsor/i.test(s.role)) ??
      list.find((s) => /technical buyer|commercial|supplier/i.test(s.role)) ??
      list[0]
    );
  };

  return {
    external: preferExternal(scopedExternal),
    internal,
  };
}

/**
 * Pure, deterministic counterparty & signatory binder for the 7 FEL development pillars
 * (plus funding_source and decision_maker). Never invents companies or contacts.
 */
export function resolvePillarCounterparties(
  project: Project,
  companies: readonly Company[] = [],
  activities: readonly Activity[] = [],
): Partial<Record<UnderstandingFieldId, PillarCounterpartyBinding>> {
  const orgs = getProjectRelatedOrganizations(project);
  const stakeholders = getProjectStakeholders(project);
  const companyById = new Map<string, Company>();
  for (const c of companies) {
    companyById.set(c.CompanyID, c);
  }

  const targetFields: Array<{ fieldId: UnderstandingFieldId; title: string }> = [
    ...DEVELOPMENT_PILLARS.map((p) => ({ fieldId: p.fieldId, title: p.title })),
    { fieldId: "funding_source", title: "Ownership and financing" },
    { fieldId: "decision_maker", title: "Who signs the agreements" },
  ];

  const out: Partial<Record<UnderstandingFieldId, PillarCounterpartyBinding>> = {};

  for (const { fieldId, title } of targetFields) {
    const matchedOrg = selectOrgForPillar(fieldId, orgs, companyById);
    const matchedCompany = matchedOrg ? companyById.get(matchedOrg.companyId) : undefined;
    const { external, internal } = selectStakeholdersForPillar(fieldId, matchedOrg, stakeholders);
    const pillarDef = DEVELOPMENT_PILLARS.find((p) => p.fieldId === fieldId);

    // Find most recent non-cancelled activity touching this pillar or counterparty
    const relevantActivities = activities
      .filter((act) => {
        if (act.ActionStatus === "Cancelled") return false;
        const text = `${act.Subject ?? ""} ${act.Summary ?? ""} ${act.ActivityDescription ?? ""}`;
        if (pillarDef && pillarDef.keywords.test(text)) return true;
        if (matchedOrg && act.Company?.Title === matchedOrg.companyId) return true;
        if (matchedCompany && text.toLowerCase().includes(matchedCompany.Title.toLowerCase())) {
          return true;
        }
        return false;
      })
      .sort((a, b) => (b.ActivityDate ?? "").localeCompare(a.ActivityDate ?? ""));

    const latestAct = relevantActivities[0];
    const req = PILLAR_EVIDENCE_REQUIREMENTS[fieldId];

    out[fieldId] = {
      fieldId,
      pillarTitle: title,
      organizationId: matchedOrg?.id,
      companyId: matchedOrg?.companyId,
      companyName: matchedCompany?.Title ?? matchedOrg?.label,
      organizationType: matchedOrg?.organizationType,
      organizationRoleLabel: matchedOrg?.label,
      stakeholderName: external?.name,
      stakeholderContactId: external?.contactId,
      stakeholderRole: external?.role,
      internalLeadName: internal?.name ?? project.owner,
      internalLeadRole: internal?.role ?? "Project Owner",
      lastTouchDate: latestAct?.ActivityDate ? latestAct.ActivityDate.slice(0, 10) : undefined,
      lastTouchSummary: latestAct?.Subject?.trim() || undefined,
      missingCounterpartyReason: matchedOrg ? undefined : req?.missingOrgHint,
    };
  }

  return out;
}

/**
 * Builds a 1-click context-grounded Outlook draft and task preset for a development pillar.
 * Follows Knowledge Before Questions: includes any captured open-work note so the user
 * only asks for the remaining gap.
 */
export function buildPillarExecutionDraft(input: {
  projectName: string;
  fieldId: UnderstandingFieldId;
  capturedNote?: string;
  binding?: PillarCounterpartyBinding;
}): PillarExecutionDraft {
  const pillar = DEVELOPMENT_PILLARS.find((p) => p.fieldId === input.fieldId);
  const pillarTitle =
    pillar?.title ??
    input.binding?.pillarTitle ??
    (input.fieldId === "funding_source"
      ? "Ownership and financing"
      : input.fieldId === "decision_maker"
        ? "Agreement signatories"
        : input.fieldId);

  const req = PILLAR_EVIDENCE_REQUIREMENTS[input.fieldId] ?? {
    askSummary: `confirming ${pillarTitle.toLowerCase()}`,
    checklist: [`Confirm requirements and terms for ${pillarTitle.toLowerCase()}`],
    whyItMatters: `Required to progress ${input.projectName} toward financial close.`,
    missingOrgHint: "Counterparty organization not linked yet.",
  };

  const counterpartyLabel =
    input.binding?.companyName ??
    input.binding?.organizationRoleLabel ??
    "counterparty";

  const firstName = input.binding?.stakeholderName
    ?.trim()
    .split(/\s+/)[0]
    ?.replace(/[^a-zA-ZÀ-ÿ-]/g, "");
  const greeting = firstName ? `Hi ${firstName},` : "Hi,";

  const knownLine = input.capturedNote?.trim()
    ? `\nCurrent status on our side: ${input.capturedNote.trim().replace(/\.$/, "")}.\n`
    : "\n";

  const bullets = req.checklist.map((item) => `- ${item}`).join("\n");
  const signOff = input.binding?.internalLeadName
    ? `\nBest regards,\n${input.binding.internalLeadName}\nStandard Bio`
    : `\nBest regards,\nStandard Bio`;

  const emailSubject = `${input.projectName} — ${pillarTitle} (${counterpartyLabel})`;
  const emailBody = `${greeting}
${knownLine}To move ${input.projectName} forward on ${pillarTitle.toLowerCase()}, could we align on the following items:

${bullets}

Why this matters now: ${req.whyItMatters}
${signOff}`;

  const encodedSubject = encodeURIComponent(emailSubject);
  const encodedBody = encodeURIComponent(emailBody);

  return {
    fieldId: input.fieldId,
    pillarTitle,
    emailSubject,
    emailBody,
    mailtoHref: `mailto:?subject=${encodedSubject}&body=${encodedBody}`,
    outlookWebHref: `https://outlook.office.com/mail/deeplink/compose?subject=${encodedSubject}&body=${encodedBody}`,
    taskTitle: `Secure ${pillarTitle.toLowerCase()} with ${counterpartyLabel}: ${req.askSummary}`,
    taskOwner: input.binding?.internalLeadName || "Unassigned",
    whyItMatters: req.whyItMatters,
  };
}
