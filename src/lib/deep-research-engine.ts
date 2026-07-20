import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { Contact } from "@/types/contact";
import type { PipelineRow } from "@/types/pipeline";
import { formatCompanyLocation } from "@/types/company";
import { getContactDisplayName } from "@/types/contact";
import { formatDealValue } from "@/types/pipeline";
import { company360Href } from "@/types/company-360";
import { deal360Href } from "@/types/relationship-navigation";
import { getActivitiesForCompany } from "@/lib/activity-utils";
import { buildCompany360Snapshot } from "@/lib/company-360-data";
import { buildGrowthIntelligence } from "@/lib/growth-intelligence-data";
import { defaultInventory } from "@/lib/inventory-data";
import { getLinkedPipelines } from "@/lib/company-utils";
import { companyHasType } from "@/lib/company-classification";
import { formatRelativeTime } from "@/lib/relative-time";
import type {
  DeepResearchBriefing,
  DeepResearchBullet,
  DeepResearchKind,
  DeepResearchPriority,
} from "@/types/deep-research";
import externalSeed from "@/data/deep-research-external.json";

type ExternalEntity = {
  aliases: string[];
  kind: DeepResearchKind;
  executiveSummary: {
    industry?: string;
    location?: string;
    size?: string;
    businessFocus: string;
  };
  whyItMatters: string[];
  recentNews: Array<{ label: string; detail?: string; source?: string }>;
  projectSignals: Array<{ label: string; detail?: string }>;
  risks: {
    commercial?: Array<{ label: string; detail?: string }>;
    relationship?: Array<{ label: string; detail?: string }>;
    competitive?: Array<{ label: string; detail?: string }>;
  };
  opportunities: Array<{ label: string; detail?: string }>;
  recommendedActions: string[];
  overallAssessment: {
    priority: DeepResearchPriority;
    strategicPriority: string;
    summary: string;
  };
};

type ExternalSeed = {
  entities: Record<string, ExternalEntity>;
};

const seed = externalSeed as ExternalSeed;

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\?+$/, "");
}

function bullet(
  id: string,
  label: string,
  source: DeepResearchBullet["source"],
  detail?: string,
  href?: string,
): DeepResearchBullet {
  return { id, label, detail, href, source };
}

function findCompany(companies: Company[], query: string): Company | undefined {
  const q = normalize(query);
  return companies.find((company) => {
    const title = company.Title.toLowerCase();
    return q.includes(title) || title.includes(q);
  });
}

function findContact(
  companies: Company[],
  query: string,
): { contact: Contact; company: Company } | undefined {
  const q = normalize(query);
  for (const company of companies) {
    for (const contact of company.contacts) {
      const name = getContactDisplayName(contact).toLowerCase();
      if (q.includes(name) || name.includes(q)) {
        return { contact, company };
      }
    }
  }
  return undefined;
}

function findPipeline(
  pipelines: PipelineRow[],
  query: string,
): PipelineRow | undefined {
  const q = normalize(query);
  const dealId = q.match(/pl-\d+/i)?.[0]?.toUpperCase();
  if (dealId) {
    return pipelines.find((p) => p.id === dealId);
  }
  return pipelines.find((p) => {
    const name = p.assetName.toLowerCase();
    return q.includes(name) || name.includes(q);
  });
}

function findExternalEntity(query: string): { key: string; entity: ExternalEntity } | undefined {
  const q = normalize(query);
  for (const [key, entity] of Object.entries(seed.entities)) {
    if (entity.aliases.some((alias) => q.includes(alias) || alias.includes(q))) {
      return { key, entity };
    }
  }
  return undefined;
}

function extractSubject(query: string): string {
  return query
    .replace(
      /^(deep dive|research|analyze|analyse|investigate|tell me everything about)\s+/i,
      "",
    )
    .replace(/\s+(market|competitor|customer|company|project|technology)$/i, "")
    .trim();
}

export function classifyDeepResearchQuery(query: string): boolean {
  const q = normalize(query);
  const triggers = [
    "deep dive",
    "research ",
    "investigate ",
    "tell me everything about",
    "research this competitor",
    "analyze this technology",
    "analyse this technology",
    "investigate this project",
    "everything about this customer",
  ];
  if (triggers.some((t) => q.includes(t))) return true;

  if (/^(research|analyze|analyse|investigate)\s+.+/i.test(query.trim())) {
    const subject = extractSubject(query);
    if (subject.length >= 3) return true;
  }

  return false;
}

function resolveResearchTarget(
  query: string,
  companies: Company[],
  pipelines: PipelineRow[],
): { kind: DeepResearchKind; subject: string; company?: Company; contact?: Contact; pipeline?: PipelineRow; external?: ExternalEntity } {
  const q = normalize(query);
  const subject = extractSubject(query);

  if (q.includes("biochar market") || q.includes("market") && !findCompany(companies, subject)) {
    const external = findExternalEntity(subject) ?? findExternalEntity(q);
    if (external) {
      return { kind: "market", subject, external: external.entity };
    }
    return { kind: "market", subject: subject || query };
  }

  if (q.includes("competitor") || q.includes("this competitor")) {
    const external = findExternalEntity(subject);
    if (external) return { kind: "competitor", subject, external: external.entity };
    const company = companies.find((c) => companyHasType(c, "Competitor") && findCompany([c], subject));
    if (company) return { kind: "competitor", subject: company.Title, company };
  }

  if (q.includes("technology") || q.includes("pyrolysis") || q.includes("feedstock")) {
    return { kind: "technology", subject: subject || "Pyrolysis technology" };
  }

  if (q.includes("project") || q.includes("investigate this project")) {
    const pipeline = findPipeline(pipelines, subject) ?? findPipeline(pipelines, query);
    if (pipeline) return { kind: "project", subject: pipeline.assetName, pipeline };
  }

  const contactMatch = findContact(companies, subject) ?? findContact(companies, query);
  if (contactMatch && (q.includes("analyze") || q.includes("analyse") || q.startsWith("research"))) {
    return {
      kind: "contact",
      subject: getContactDisplayName(contactMatch.contact),
      company: contactMatch.company,
      contact: contactMatch.contact,
    };
  }

  const company = findCompany(companies, subject) ?? findCompany(companies, query);
  if (company) {
    const kind: DeepResearchKind = companyHasType(company, "Competitor") ? "competitor" : "company";
    return { kind, subject: company.Title, company };
  }

  const external = findExternalEntity(subject) ?? findExternalEntity(query);
  if (external) {
    return { kind: external.entity.kind, subject, external: external.entity };
  }

  const pipeline = findPipeline(pipelines, subject);
  if (pipeline) return { kind: "project", subject: pipeline.assetName, pipeline };

  return { kind: "company", subject: subject || query };
}

function mapExternalBullets(
  items: Array<{ label: string; detail?: string; source?: string }>,
  prefix: string,
): DeepResearchBullet[] {
  return items.map((item, index) =>
    bullet(
      `${prefix}-${index}`,
      item.label,
      "external",
      item.detail ? `${item.detail}${item.source ? ` · ${item.source}` : ""}` : item.source,
    ),
  );
}

function buildWhyItMattersForCompany(company: Company, snapshot: ReturnType<typeof buildCompany360Snapshot>): string[] {
  const lines: string[] = [];
  const pipelineValue = snapshot.pipelines.reduce((sum, p) => sum + (p.salesValue ?? 0), 0);

  if (snapshot.pipelines.length > 0) {
    lines.push(
      `${snapshot.pipelines.length} linked opportunit${snapshot.pipelines.length === 1 ? "y" : "ies"} worth ${formatDealValue(snapshot.pipelines[0]?.currency ?? "EUR", pipelineValue)} in CRM.`,
    );
  } else {
    lines.push("No active CRM opportunities — relationship building or discovery phase.");
  }

  if (company.Industry) {
    lines.push(`${company.Industry} sector alignment with Standard Bio machinery and engineering services.`);
  }

  const types = company.CompanyTypes ?? [];
  if (types.includes("Competitor")) {
    lines.push("Competitive intelligence required to protect win rate and positioning.");
  }

  if (snapshot.intelligence.riskSignals.length > 0) {
    lines.push(snapshot.intelligence.riskSignals[0]!.impact[0] ?? snapshot.intelligence.riskSignals[0]!.detail);
  }

  return lines.slice(0, 4);
}

function priorityFromHealth(status: string): DeepResearchPriority {
  if (status === "At Risk" || status === "Weak") return "high";
  if (status === "Healthy") return "medium";
  return "low";
}

function buildCompanyBriefing(
  query: string,
  company: Company,
  activities: Activity[],
  pipelines: PipelineRow[],
  kind: DeepResearchKind,
): DeepResearchBriefing {
  const snapshot = buildCompany360Snapshot(company, pipelines, activities, defaultInventory);
  const companyActivities = getActivitiesForCompany(activities, company);
  const linked = getLinkedPipelines(company, pipelines);
  const growth = buildGrowthIntelligence([company], pipelines);
  const competitorProfile = growth.competitors.find((c) => c.companyId === company.CompanyID);

  const recentNews: DeepResearchBullet[] = competitorProfile
    ? [
        bullet("news-0", competitorProfile.recentActivity, "external"),
        ...competitorProfile.eventPresence.map((event, i) =>
          bullet(`news-ev-${i}`, `Event presence: ${event}`, "external"),
        ),
      ]
    : companyActivities.slice(0, 2).map((a, i) =>
        bullet(`news-int-${i}`, a.Subject, "internal", a.Summary?.slice(0, 120), `/activities/${a.ActivityID}`),
      );

  const external = findExternalEntity(company.Title)?.entity;
  if (external) {
    recentNews.push(...mapExternalBullets(external.recentNews, "news-ext"));
  }

  const projectSignals = linked.map((deal, i) =>
    bullet(
      `proj-${i}`,
      deal.assetName,
      "internal",
      `${deal.status} · ${deal.targetFeedstock} · ${formatDealValue(deal.currency, deal.salesValue ?? 0)}`,
      deal360Href(deal.id),
    ),
  );

  if (external) {
    projectSignals.push(...mapExternalBullets(external.projectSignals, "proj-ext"));
  }

  const commercialRisks = snapshot.intelligence.riskSignals.map((r, i) =>
    bullet(`risk-c-${i}`, r.label, "internal", r.detail),
  );
  const relationshipRisks =
    snapshot.header.healthStatus === "At Risk" || snapshot.header.healthStatus === "Weak"
      ? [
          bullet(
            "risk-rel-0",
            `${snapshot.header.healthStatus} relationship`,
            "internal",
            snapshot.summary.healthReport.summary,
          ),
        ]
      : [];

  const competitiveRisks = competitorProfile
    ? competitorProfile.weaknesses.map((w, i) => bullet(`risk-comp-${i}`, w, "external"))
    : external
      ? mapExternalBullets(external.risks.competitive ?? [], "risk-comp-ext")
      : [];

  if (external?.risks.commercial) {
    commercialRisks.push(...mapExternalBullets(external.risks.commercial, "risk-c-ext"));
  }

  const priority = competitorProfile
    ? competitorProfile.threatLevel === "critical" || competitorProfile.threatLevel === "high"
      ? "high"
      : "medium"
    : priorityFromHealth(snapshot.header.healthStatus);

  const recommendedActions: DeepResearchBullet[] = [
    bullet(
      "act-0",
      snapshot.intelligence.recommendedAction.action,
      "internal",
      snapshot.intelligence.recommendedAction.reason,
      company360Href(company.CompanyID, "attention"),
    ),
    ...snapshot.intelligence.suggestedActions.slice(0, 2).map((action, i) =>
      bullet(`act-s-${i}`, action, "internal"),
    ),
  ];

  if (external) {
    recommendedActions.push(
      ...external.recommendedActions.map((action, i) =>
        bullet(`act-ext-${i}`, action, "external"),
      ),
    );
  }

  const sizeHint = company.contacts.length > 0 ? `${company.contacts.length} known contacts in CRM` : undefined;

  return {
    id: `research-${company.CompanyID}-${Date.now()}`,
    kind,
    query,
    generatedAt: new Date().toISOString(),
    subjectLabel: company.Title,
    href: company360Href(company.CompanyID),
    executiveSummary: {
      subject: company.Title,
      industry: company.Industry,
      location: formatCompanyLocation(company),
      size: external?.executiveSummary.size ?? sizeHint,
      businessFocus:
        external?.executiveSummary.businessFocus ??
        competitorProfile?.positioning ??
        `${company.Industry} · ${company.Status} account`,
      narrative: external?.overallAssessment.summary ?? snapshot.summary.healthReport.summary,
    },
    whyItMatters: external?.whyItMatters ?? buildWhyItMattersForCompany(company, snapshot),
    knownRelationship: {
      activities: companyActivities.slice(0, 5).map((a, i) =>
        bullet(`act-${i}`, a.Subject, "internal", formatRelativeTime(a.ActivityDate), `/activities/${a.ActivityID}`),
      ),
      opportunities: linked.slice(0, 5).map((deal, i) =>
        bullet(`opp-${i}`, deal.assetName, "internal", deal.status, deal360Href(deal.id)),
      ),
      projects: projectSignals.filter((p) => p.source === "internal").slice(0, 4),
      contacts: company.contacts.slice(0, 5).map((c, i) =>
        bullet(`con-${i}`, getContactDisplayName(c), "internal", c.JobTitle ?? c.Role),
      ),
      lastContact: snapshot.header.lastContactLabel,
      relationshipHealth: `${snapshot.header.healthStatus} (${snapshot.header.healthScore})`,
    },
    recentNews: recentNews.slice(0, 6),
    projectSignals: projectSignals.slice(0, 6),
    risks: {
      commercial: commercialRisks.slice(0, 4),
      relationship: [
        ...relationshipRisks,
        ...mapExternalBullets(external?.risks.relationship ?? [], "risk-rel-ext"),
      ].slice(0, 4),
      competitive: competitiveRisks.slice(0, 4),
    },
    opportunities: {
      applications: linked
        .filter((d) => d.status !== "Won")
        .slice(0, 3)
        .map((deal, i) =>
          bullet(`app-${i}`, deal.targetFeedstock, "internal", deal.assetName, deal360Href(deal.id)),
        ),
      revenuePaths: linked.slice(0, 3).map((deal, i) =>
        bullet(
          `rev-${i}`,
          formatDealValue(deal.currency, deal.salesValue ?? 0),
          "internal",
          `${deal.status} · ${deal.companyRole ?? "Client"}`,
          deal360Href(deal.id),
        ),
      ),
      salesOpportunities: [
        ...(external?.opportunities.map((o, i) => bullet(`sale-ext-${i}`, o.label, "external", o.detail)) ?? []),
        ...linked.slice(0, 2).map((deal, i) =>
          bullet(`sale-${i}`, `Advance ${deal.assetName}`, "internal", deal.status, deal360Href(deal.id)),
        ),
      ].slice(0, 5),
    },
    recommendedActions: recommendedActions.slice(0, 5),
    overallAssessment: external?.overallAssessment ?? {
      priority,
      strategicPriority:
        priority === "high"
          ? "High priority — act this week"
          : priority === "medium"
            ? "Monitor and nurture"
            : "Stable — maintain momentum",
      summary: snapshot.summary.healthReport.summary,
    },
    sourcesUsed: [
      "CRM",
      "Activities",
      "Opportunities",
      "Contacts",
      ...(competitorProfile || external ? ["Competitor Sources", "Industry Sources"] : []),
      ...(external ? ["Public Sources"] : []),
    ],
  };
}

function buildContactBriefing(
  query: string,
  contact: Contact,
  company: Company,
  activities: Activity[],
  pipelines: PipelineRow[],
): DeepResearchBriefing {
  const companyBriefing = buildCompanyBriefing(query, company, activities, pipelines, "contact");
  const contactActivities = activities.filter(
    (a) => a.Contact?.Title === contact.Title || a.Contact?.Id === contact.id,
  );

  return {
    ...companyBriefing,
    id: `research-contact-${contact.ContactID}-${Date.now()}`,
    kind: "contact",
    subjectLabel: getContactDisplayName(contact),
    executiveSummary: {
      ...companyBriefing.executiveSummary,
      subject: getContactDisplayName(contact),
      businessFocus: `${contact.JobTitle ?? contact.Role} at ${company.Title} · ${contact.RelationshipLevel ?? "Contact"} relationship`,
      narrative: `Stakeholder analysis for ${getContactDisplayName(contact)} — ${companyBriefing.executiveSummary.narrative}`,
    },
    whyItMatters: [
      `${contact.RelationshipLevel ?? "Active"} stakeholder at ${company.Title}.`,
      contact.Role ? `Role: ${contact.Role} — ${contact.JobTitle ?? "key contact"}.` : "Key relationship contact.",
      ...companyBriefing.whyItMatters.slice(0, 2),
    ],
    knownRelationship: {
      ...companyBriefing.knownRelationship,
      activities: contactActivities.slice(0, 5).map((a, i) =>
        bullet(`c-act-${i}`, a.Subject, "internal", formatRelativeTime(a.ActivityDate), `/activities/${a.ActivityID}`),
      ),
      contacts: [
        bullet("c-self", getContactDisplayName(contact), "internal", `${contact.Email} · ${contact.Phone ?? ""}`),
      ],
    },
    recommendedActions: [
      bullet(
        "c-act-0",
        `Schedule follow-up with ${getContactDisplayName(contact)}`,
        "internal",
        companyBriefing.knownRelationship.lastContact
          ? `Last contact ${companyBriefing.knownRelationship.lastContact}`
          : undefined,
        `/activities?intent=email&contact=${encodeURIComponent(contact.ContactID)}`,
      ),
      ...companyBriefing.recommendedActions.slice(0, 3),
    ],
    sourcesUsed: [...companyBriefing.sourcesUsed, "Emails", "Meeting Notes"],
  };
}

function buildExternalBriefing(
  query: string,
  subject: string,
  kind: DeepResearchKind,
  entity: ExternalEntity,
): DeepResearchBriefing {
  return {
    id: `research-ext-${Date.now()}`,
    kind,
    query,
    generatedAt: new Date().toISOString(),
    subjectLabel: subject,
    executiveSummary: {
      subject,
      industry: entity.executiveSummary.industry,
      location: entity.executiveSummary.location,
      size: entity.executiveSummary.size,
      businessFocus: entity.executiveSummary.businessFocus,
      narrative: entity.overallAssessment.summary,
    },
    whyItMatters: entity.whyItMatters,
    knownRelationship: {
      activities: [],
      opportunities: [],
      projects: [],
      contacts: [],
      lastContact: "No CRM relationship recorded",
      relationshipHealth: "Not in CRM",
    },
    recentNews: mapExternalBullets(entity.recentNews, "news"),
    projectSignals: mapExternalBullets(entity.projectSignals, "proj"),
    risks: {
      commercial: mapExternalBullets(entity.risks.commercial ?? [], "risk-c"),
      relationship: mapExternalBullets(entity.risks.relationship ?? [], "risk-r"),
      competitive: mapExternalBullets(entity.risks.competitive ?? [], "risk-comp"),
    },
    opportunities: {
      applications: entity.opportunities.slice(0, 2).map((o, i) => bullet(`app-${i}`, o.label, "external", o.detail)),
      revenuePaths: entity.opportunities.slice(0, 2).map((o, i) => bullet(`rev-${i}`, o.label, "external", o.detail)),
      salesOpportunities: entity.opportunities.map((o, i) => bullet(`sale-${i}`, o.label, "external", o.detail)),
    },
    recommendedActions: entity.recommendedActions.map((action, i) => bullet(`act-${i}`, action, "external")),
    overallAssessment: entity.overallAssessment,
    sourcesUsed: [
      "Public Sources",
      "Industry Sources",
      "Investment Sources",
      "Competitor Sources",
      "Company Websites",
      "Press Releases",
    ],
  };
}

function buildProjectBriefing(
  query: string,
  pipeline: PipelineRow,
  companies: Company[],
  activities: Activity[],
  pipelines: PipelineRow[],
): DeepResearchBriefing {
  const company = companies.find((c) => c.Title === pipeline.ClientLookup);
  if (company) {
    const base = buildCompanyBriefing(query, company, activities, pipelines, "project");
    return {
      ...base,
      id: `research-project-${pipeline.id}-${Date.now()}`,
      kind: "project",
      subjectLabel: pipeline.assetName,
      href: deal360Href(pipeline.id),
      executiveSummary: {
        subject: pipeline.assetName,
        industry: company.Industry,
        location: formatCompanyLocation(company),
        businessFocus: `${pipeline.targetFeedstock} · ${pipeline.status} · ${formatDealValue(pipeline.currency, pipeline.salesValue ?? 0)}`,
        narrative: `Project investigation for ${pipeline.assetName} with ${pipeline.ClientLookup ?? "client"}.`,
      },
      whyItMatters: [
        `Active project ${pipeline.id} — ${pipeline.status}.`,
        `Deal value ${formatDealValue(pipeline.currency, pipeline.salesValue ?? 0)}.`,
        ...base.whyItMatters.slice(0, 2),
      ],
      knownRelationship: {
        ...base.knownRelationship,
        opportunities: [
          bullet("opp-0", pipeline.assetName, "internal", pipeline.status, deal360Href(pipeline.id)),
        ],
        projects: [
          bullet(
            "proj-0",
            pipeline.assetName,
            "internal",
            `${pipeline.targetFeedstock} · ${pipeline.reactorDesignCapacity} kg/h`,
            deal360Href(pipeline.id),
          ),
        ],
      },
      projectSignals: [
        bullet("sig-0", pipeline.status, "internal", pipeline.currentMilestone),
        bullet("sig-1", pipeline.targetFeedstock, "internal", "Feedstock focus"),
      ],
      recommendedActions: [
        bullet("act-0", `Open ${pipeline.id} workspace`, "internal", "Review commercial and delivery status", deal360Href(pipeline.id)),
        ...base.recommendedActions.slice(0, 3),
      ],
      sourcesUsed: ["CRM", "Opportunities", "Projects", "Activities", "Documents"],
    };
  }

  return buildExternalBriefing(query, pipeline.assetName, "project", {
    aliases: [],
    kind: "project",
    executiveSummary: {
      businessFocus: `${pipeline.targetFeedstock} · ${pipeline.status}`,
    },
    whyItMatters: [`Opportunity ${pipeline.id} in portfolio.`],
    recentNews: [],
    projectSignals: [{ label: pipeline.assetName, detail: pipeline.status }],
    risks: { commercial: [{ label: "Review deal health in CRM", detail: pipeline.id }] },
    opportunities: [{ label: "Advance opportunity", detail: deal360Href(pipeline.id) }],
    recommendedActions: [`Open ${pipeline.id} in Opportunity Workspace`],
    overallAssessment: {
      priority: "medium",
      strategicPriority: "Review in CRM",
      summary: `Project ${pipeline.assetName} requires CRM review.`,
    },
  });
}

function buildTechnologyBriefing(query: string, subject: string): DeepResearchBriefing {
  return buildExternalBriefing(query, subject, "technology", {
    aliases: [],
    kind: "technology",
    executiveSummary: {
      industry: "Thermal conversion / pyrolysis",
      businessFocus: "Biochar, bio-oil and syngas from organic waste and residue feedstocks.",
    },
    whyItMatters: [
      "Core technology domain for Standard Bio machinery and engineering services.",
      "Buyer decisions hinge on feedstock suitability, certification and bankability.",
      "Paid feasibility de-risks technology selection before machinery CAPEX.",
    ],
    recentNews: [
      {
        label: "EU certification pathways increasingly required for project finance",
        detail: "Investment News · Jun 2026",
        source: "Investment News",
      },
      {
        label: "Modular pyrolysis gaining share in municipal waste segment",
        detail: "Industry Media",
        source: "Industry Media",
      },
    ],
    projectSignals: [
      { label: "Municipal waste pyrolysis", detail: "High machinery ticket · EU / Nordics" },
      { label: "Agricultural residue decentralized", detail: "Services-heavy attach" },
    ],
    risks: {
      commercial: [{ label: "Offtake uncertainty", detail: "Stalls machinery decisions" }],
      competitive: [{ label: "OEM certification narratives", detail: "PYREG and EU peers set buyer expectations" }],
    },
    opportunities: [
      { label: "Paid feasibility product", detail: "Entry before machinery sale" },
      { label: "Reference project reuse", detail: "Nordic Polymers and Legacy Materials CRM knowledge" },
    ],
    recommendedActions: [
      "Search CRM reference projects for similar feedstock",
      "Review quotation library for comparable scopes",
      "Propose paid feasibility before technical deep-dive at customer expense",
    ],
    overallAssessment: {
      priority: "medium",
      strategicPriority: "Knowledge reuse — check CRM first",
      summary: "Technology analysis should start with internal reference projects and quotations before external research.",
    },
  });
}

export function buildDeepResearchBriefing(
  query: string,
  companies: Company[],
  pipelines: PipelineRow[],
  activities: Activity[],
): DeepResearchBriefing | null {
  const target = resolveResearchTarget(query, companies, pipelines);

  if (target.contact && target.company) {
    return buildContactBriefing(query, target.contact, target.company, activities, pipelines);
  }

  if (target.company) {
    return buildCompanyBriefing(query, target.company, activities, pipelines, target.kind);
  }

  if (target.pipeline) {
    return buildProjectBriefing(query, target.pipeline, companies, activities, pipelines);
  }

  if (target.external) {
    return buildExternalBriefing(query, target.subject, target.kind, target.external);
  }

  if (target.kind === "technology") {
    return buildTechnologyBriefing(query, target.subject);
  }

  if (target.kind === "market") {
    const marketEntity = findExternalEntity(target.subject)?.entity ?? findExternalEntity("swedish biochar market")?.entity;
    if (marketEntity) {
      return buildExternalBriefing(query, target.subject, "market", marketEntity);
    }
  }

  return null;
}

export const DEEP_RESEARCH_EXAMPLE_QUERIES = [
  "Deep dive Nordic Polymers",
  "Research PYREG",
  "Analyze John Smith",
  "Tell me everything about this customer",
  "Deep dive Swedish biochar market",
] as const;
