import type { Company, CompanyIndustry, CompanyStatus } from "@/types/company";
import type { CompanyType } from "@/types/company-type";
import { canonicalizeCompanyType } from "@/types/company-type";
import type {
  BuyingRole,
  Contact,
  ContactListRole,
  ContactSentiment,
  ContactStatus,
  EngagementCadence,
  InfluenceLevel,
  RelationshipLevel,
} from "@/types/contact";
import type {
  CompanyRole,
  PipelineCurrency,
  PipelineRow,
  PipelineStatus,
  PipelineTeamMember,
} from "@/types/pipeline";
import type {
  Company as PrismaCompany,
  Contact as PrismaContact,
  Opportunity as PrismaOpportunity,
  OpportunityStage,
  OpportunityStatus as PrismaOpportunityStatus,
} from "@/generated/prisma";

type PrismaCompanyWithRelations = PrismaCompany & {
  contacts: PrismaContact[];
  opportunities: Array<Pick<PrismaOpportunity, "id">>;
};

type PrismaOpportunityWithCompany = PrismaOpportunity & {
  company?: Pick<PrismaCompany, "id" | "name"> | null;
};

/** Stable positive int from a UUID/string for SharePoint-shaped numeric ids. */
export function stableNumericId(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) || 1;
}

export function toCompanyTrackingId(prismaId: string): string {
  const trimmed = prismaId.trim();
  if (/^CO-[A-Z0-9]+$/i.test(trimmed)) return trimmed.toUpperCase();
  return `CO-${trimmed.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export function toContactTrackingId(prismaId: string): string {
  const trimmed = prismaId.trim();
  if (/^CT-[A-Z0-9]+$/i.test(trimmed)) return trimmed.toUpperCase();
  return `CT-${trimmed.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function primaryEmail(emails: unknown): string {
  if (!Array.isArray(emails) || emails.length === 0) return "";
  const primary = emails.find(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      "isPrimary" in entry &&
      (entry as { isPrimary?: boolean }).isPrimary,
  );
  const pick = (primary ?? emails[0]) as { address?: string };
  return typeof pick.address === "string" ? pick.address : "";
}

function primaryPhone(phones: unknown, preferMobile = false): string {
  if (!Array.isArray(phones) || phones.length === 0) return "";
  const typed = phones.filter(
    (entry): entry is { number?: string; type?: string; isPrimary?: boolean } =>
      Boolean(entry && typeof entry === "object"),
  );
  if (preferMobile) {
    const mobile = typed.find((entry) => /mobile|cell/i.test(entry.type ?? ""));
    if (mobile?.number) return mobile.number;
  }
  const primary = typed.find((entry) => entry.isPrimary);
  return primary?.number ?? typed[0]?.number ?? "";
}

function mapCompanyTypes(types: string[]): CompanyType[] {
  const mapped = types
    .map((type) => canonicalizeCompanyType(type))
    .filter((type): type is CompanyType => Boolean(type));
  return mapped.length > 0 ? mapped : ["Prospect"];
}

function mapIndustry(industry: string | null | undefined): CompanyIndustry {
  const allowed: CompanyIndustry[] = [
    "Polymer Processing",
    "Textile Recovery",
    "Chemical Manufacturing",
    "Waste Management",
    "Energy & Infrastructure",
  ];
  if (industry && (allowed as string[]).includes(industry)) {
    return industry as CompanyIndustry;
  }
  if (industry && /renew|energy|infra/i.test(industry)) return "Energy & Infrastructure";
  if (industry && /waste|circular/i.test(industry)) return "Waste Management";
  if (industry && /chem/i.test(industry)) return "Chemical Manufacturing";
  if (industry && /textile|fiber/i.test(industry)) return "Textile Recovery";
  return "Polymer Processing";
}

function mapCompanyStatus(
  status: PrismaCompany["status"],
  types: string[],
): CompanyStatus {
  if (status === "archived") return "Inactive";
  const canonical = types.map((type) => canonicalizeCompanyType(type));
  if (canonical.includes("Customer")) return "Contracted";
  if (canonical.includes("Prospect")) return "Prospecting";
  return "Active";
}

function mapContactRole(jobTitle: string | null | undefined): ContactListRole {
  const title = (jobTitle ?? "").toLowerCase();
  if (/ceo|cfo|chief|executive|sponsor|director|vp|head/.test(title)) {
    return "Executive Sponsor";
  }
  if (/plant|operations|manager|technical|cto/.test(title)) return "Plant Manager";
  if (/compliance|legal|permit/.test(title)) return "Compliance Officer";
  if (/procure|buyer|purchasing/.test(title)) return "Procurement";
  return "Plant Manager";
}

function mapContactStatus(status: PrismaContact["status"]): ContactStatus {
  return status === "archived" ? "Inactive" : "Active";
}

function mapRelationshipLevel(jobTitle: string | null | undefined): RelationshipLevel {
  const title = (jobTitle ?? "").toLowerCase();
  if (/ceo|cfo|chief|executive|sponsor/.test(title)) return "Strategic";
  if (/manager|director|head|cto/.test(title)) return "Operational";
  return "Tactical";
}

function mapBuyingRole(value: string | null | undefined): BuyingRole | undefined {
  if (!value) return undefined;
  const allowed: BuyingRole[] = [
    "Economic Buyer",
    "Champion",
    "Technical Evaluator",
    "Blocker",
    "End User",
    "Legal/Procurement",
  ];
  return allowed.includes(value as BuyingRole) ? (value as BuyingRole) : undefined;
}

function mapSentiment(value: string | null | undefined): ContactSentiment | undefined {
  if (!value) return undefined;
  const allowed: ContactSentiment[] = [
    "Champion / Promoter",
    "Neutral",
    "Detractor / Skeptic",
  ];
  return allowed.includes(value as ContactSentiment) ? (value as ContactSentiment) : undefined;
}

function mapInfluenceLevel(value: string | null | undefined): InfluenceLevel | undefined {
  if (!value) return undefined;
  const allowed: InfluenceLevel[] = ["High", "Medium", "Low"];
  return allowed.includes(value as InfluenceLevel) ? (value as InfluenceLevel) : undefined;
}

function mapEngagementCadence(value: string | null | undefined): EngagementCadence | undefined {
  if (!value) return undefined;
  const allowed: EngagementCadence[] = ["Weekly", "Bi-weekly", "Monthly", "Quarterly"];
  return allowed.includes(value as EngagementCadence)
    ? (value as EngagementCadence)
    : undefined;
}

/** Map Prisma owner ids onto SharePoint-shaped person fields. */
function mapOwnerPerson(ownerId: string | null | undefined): {
  Id: number;
  Title: string;
} | null {
  if (!ownerId) return null;
  // Seed owner aligns with the default demo auth user so "My Opportunities" shows live rows.
  const title =
    ownerId === "seed-owner-commercial-01" ? "Mats Borgersen" : ownerId;
  return { Id: stableNumericId(ownerId), Title: title };
}

export function mapPrismaContactToApp(
  contact: PrismaContact,
  companyLookup: { Id: number; Title: string },
): Contact {
  const firstName = contact.firstName?.trim() || "";
  const lastName = contact.lastName?.trim() || "";
  const title =
    contact.fullName?.trim() ||
    `${firstName} ${lastName}`.trim() ||
    primaryEmail(contact.emails) ||
    "Unknown contact";

  return {
    id: stableNumericId(contact.id),
    ContactID: toContactTrackingId(contact.id),
    Title: title,
    FirstName: firstName || title.split(" ")[0] || "Unknown",
    LastName: lastName || title.split(" ").slice(1).join(" ") || "",
    Company: companyLookup,
    JobTitle: contact.jobTitle?.trim() || "",
    Role: mapContactRole(contact.jobTitle),
    Email: primaryEmail(contact.emails),
    Phone: primaryPhone(contact.phoneNumbers, false),
    Mobile: primaryPhone(contact.phoneNumbers, true),
    LinkedInURL: contact.linkedInUrl?.trim() || "",
    Status: mapContactStatus(contact.status),
    RelationshipLevel: mapRelationshipLevel(contact.jobTitle),
    buyingRole: mapBuyingRole(contact.buyingRole),
    sentiment: mapSentiment(contact.sentiment),
    influenceLevel: mapInfluenceLevel(contact.influenceLevel),
    reportsToId: contact.reportsToId ?? undefined,
    city: contact.city ?? undefined,
    country: contact.country ?? undefined,
    timezone: contact.timezone ?? undefined,
    isTimezoneOverridden: contact.isTimezoneOverridden ?? false,
    engagementCadence: mapEngagementCadence(contact.engagementCadence),
    backgroundNotes: contact.backgroundNotes ?? undefined,
    preferredLanguage: contact.preferredLanguage ?? undefined,
    EmploymentStatus: "Active",
    IsArchived: contact.status === "archived",
  };
}

export function mapPrismaCompanyToApp(company: PrismaCompanyWithRelations): Company {
  const companyId = toCompanyTrackingId(company.id);
  const lookup = {
    Id: stableNumericId(company.id),
    Title: company.name,
  };

  return {
    id: lookup.Id,
    Title: company.name,
    CompanyID: companyId,
    ParentCompany: company.parentCompanyId
      ? { Id: stableNumericId(company.parentCompanyId), Title: "Parent" }
      : null,
    Domain: company.website?.replace(/^https?:\/\//, "").split("/")[0] ?? "",
    Industry: mapIndustry(company.industry),
    CompanyTypes: mapCompanyTypes(company.types ?? []),
    companyType: company.companyType ?? undefined,
    Status: mapCompanyStatus(company.status, company.types),
    AccountOwner: mapOwnerPerson(company.ownerId),
    Phone: primaryPhone(company.phoneNumbers),
    Email: primaryEmail(company.emails),
    AddressLine1: company.addressLine1 ?? "",
    AddressLine2: company.addressLine2 ?? "",
    PostalCode: company.postalCode ?? "",
    City: company.city ?? "",
    Country: company.country ? { Id: stableNumericId(company.country), Title: company.country } : null,
    pipelineIds: company.opportunities.map((opportunity) => opportunity.id),
    contacts: company.contacts.map((contact) => mapPrismaContactToApp(contact, lookup)),
    Notes: undefined,
    Tags: company.types,
  };
}

const STAGE_TO_PIPELINE_STATUS: Record<OpportunityStage, PipelineStatus> = {
  prospecting: "Prospecting",
  qualification: "Prospecting",
  discovery: "Feedstock Analysis",
  proposal: "Contract Negotiation",
  negotiation: "Contract Negotiation",
  commitment: "Won",
  closed_won: "Won",
  closed_lost: "Prospecting",
};

function mapOpportunityStatus(
  stage: OpportunityStage,
  status: PrismaOpportunityStatus,
): PipelineStatus {
  if (status === "closed_won") return "Won";
  if (status === "closed_lost") return "Prospecting";
  if (status === "archived") return "Prospecting";
  return STAGE_TO_PIPELINE_STATUS[stage] ?? "Prospecting";
}

function mapTeam(team: unknown): PipelineTeamMember[] {
  if (!Array.isArray(team)) return [];
  return team
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const row = entry as { contactId?: string; projectRole?: string };
      if (!row.contactId || !row.projectRole) return null;
      return {
        contactId: toContactTrackingId(row.contactId),
        projectRole: row.projectRole,
      };
    })
    .filter((entry): entry is PipelineTeamMember => Boolean(entry));
}

function inferCompanyRole(name: string): CompanyRole {
  if (/thermal|heat|energy/i.test(name)) return "Infrastructure Partner";
  if (/fiber|feedstock|circular/i.test(name)) return "Technology Buyer";
  return "Technology Buyer";
}

export function mapPrismaOpportunityToPipelineRow(
  opportunity: PrismaOpportunityWithCompany,
): PipelineRow {
  const currency = (opportunity.currency?.toUpperCase() || "EUR") as PipelineCurrency;
  return {
    id: opportunity.id,
    assetName: opportunity.name,
    companyRole: inferCompanyRole(opportunity.name),
    targetFeedstock: "",
    reactorDesignCapacity: 0,
    currentMilestone: opportunity.nextStep?.trim() || opportunity.stage,
    status: mapOpportunityStatus(opportunity.stage, opportunity.status),
    salesValue: opportunity.value ?? 0,
    currency,
    probability: opportunity.probability ?? 10,
    expectedCloseDate: opportunity.expectedCloseDate
      ? opportunity.expectedCloseDate.toISOString().slice(0, 10)
      : undefined,
    opportunityOwner: mapOwnerPerson(opportunity.ownerId),
    offeringIds: [],
    team: mapTeam(opportunity.team),
  };
}
