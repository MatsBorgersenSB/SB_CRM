import { formatDate as formatRegionalDate } from "@/lib/regional-format-preference";
import type { WebsiteDiscoveryResult } from "@/lib/discovery/types";
import type { GraphSearchResultItem } from "@/lib/smartassist/graphSearch";
import type {
  RegistryOfficer,
  UnifiedEuropeanCompany,
} from "@/lib/integrations/company-registers/types";
import type {
  CompanyExploration,
  ExploreFact,
  ExploreInternalHit,
  ExploreKnownCompany,
  ExplorePerson,
  ExploreRegistryMatch,
  ExploreSource,
  ExploreWebsite,
} from "@/lib/smartassist/explore/types";
import type { Company } from "@/types/company";
import type { CompanyType } from "@/types/company-type";
import { company360Href } from "@/types/company-360";
import { normalizeCompanyDomain } from "@/lib/company-domain";

/** External calls, injected so the composition can be tested without the network. */
export type ExploreDeps = {
  searchRegistry: (subject: string) => Promise<UnifiedEuropeanCompany[]>;
  fetchOfficers: (match: UnifiedEuropeanCompany) => Promise<RegistryOfficer[]>;
  discoverWebsite: (url: string) => Promise<WebsiteDiscoveryResult | null>;
  searchInternal: (subject: string) => Promise<GraphSearchResultItem[]>;
};

export type ExploreCompanyInput = {
  question: string;
  subject: string;
  /** A website the user told us about; overrides what the register says. */
  websiteHint?: string | null;
  companies: Company[];
  openOpportunityIds?: Set<string>;
};

const TYPE_OPTIONS: CompanyType[] = [
  "Unclassified",
  "Prospect",
  "Customer",
  "Supplier / Vendor",
  "Partner",
  "Public / Government",
  "University / Research",
  "Competitor",
];

const LEGAL_SUFFIX =
  /\b(as|asa|sa|da|ans|ba|ks|nuf|ab|oy|oyj|aps|a\/s|gmbh|ag|ltd|limited|plc|bv|nv|sarl|sas|srl|spa|inc|llc|co|kg)\b\.?/gi;

export function normalizeCompanyName(value: string): string {
  return value
    .toLowerCase()
    .replace(LEGAL_SUFFIX, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function namesMatch(a: string, b: string): boolean {
  const x = normalizeCompanyName(a);
  const y = normalizeCompanyName(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const shorter = x.length <= y.length ? x : y;
  const longer = shorter === x ? y : x;
  return shorter.length >= 5 && longer.includes(shorter);
}

function toRegistryMatch(row: UnifiedEuropeanCompany): ExploreRegistryMatch {
  return {
    legalName: row.legalName,
    registrationNumber: row.registrationNumber,
    vatNumber: row.vatNumber ?? null,
    country: row.country,
    countryCode: row.countryCode,
    streetAddress: row.streetAddress ?? null,
    postalCode: row.postalCode ?? null,
    city: row.city ?? null,
    industryCode: row.industryCode ?? null,
    industryDescription: row.industryDescription ?? null,
    website: row.website ?? null,
    sourceRegistry: row.sourceRegistry,
  };
}

function registryPublicUrl(match: ExploreRegistryMatch): string | undefined {
  if (match.countryCode === "NO") {
    return `https://virksomhet.brreg.no/nb/oppslag/enheter/${match.registrationNumber}`;
  }
  return undefined;
}

function pickRegistryMatch(
  subject: string,
  rows: UnifiedEuropeanCompany[],
): { best: UnifiedEuropeanCompany | null; alternatives: UnifiedEuropeanCompany[] } {
  if (rows.length === 0) return { best: null, alternatives: [] };
  const exact = rows.find((row) => normalizeCompanyName(row.legalName) === normalizeCompanyName(subject));
  const best = exact ?? rows[0]!;
  const alternatives = rows.filter((row) => row !== best && namesMatch(row.legalName, subject)).slice(0, 3);
  return { best, alternatives };
}

function knownCompanies(
  subject: string,
  registry: UnifiedEuropeanCompany | null,
  websiteDomain: string | null,
  companies: Company[],
  openOpportunityIds?: Set<string>,
): ExploreKnownCompany[] {
  const matches = companies.filter((company) => {
    if (registry && company.organizationNumber && company.organizationNumber.replace(/\s/g, "") === registry.registrationNumber) {
      return true;
    }
    if (websiteDomain && normalizeCompanyDomain(company.Domain) === websiteDomain) return true;
    if (namesMatch(company.Title, subject)) return true;
    return registry ? namesMatch(company.Title, registry.legalName) : false;
  });
  return matches.slice(0, 3).map((company) => ({
    companyId: company.CompanyID,
    name: company.Title,
    href: company360Href(company),
    types: company.CompanyTypes ?? [],
    contactCount: company.contacts.length,
    openOpportunities: openOpportunityIds
      ? company.pipelineIds.filter((id) => openOpportunityIds.has(id)).length
      : company.pipelineIds.length,
  }));
}

function toInternalHit(item: GraphSearchResultItem): ExploreInternalHit {
  return {
    id: item.id,
    sourceType: item.sourceType,
    title: item.title,
    timestamp: item.timestamp,
    snippet: item.snippet,
    webUrl: item.webUrl,
  };
}

function websiteFromDiscovery(url: string, discovery: WebsiteDiscoveryResult): ExploreWebsite {
  const absolute = discovery.sourceUrl?.trim() || url;
  return {
    url: /^https?:\/\//i.test(absolute) ? absolute : `https://${absolute.replace(/^\/+/, "")}`,
    domain: discovery.company.domain || normalizeCompanyDomain(url),
    email: discovery.company.email.trim() || null,
    phone: discovery.company.phone.trim() || null,
    address: discovery.company.address.trim() || null,
    pagesRead: discovery.pagesAnalyzed.length,
  };
}

function peopleFrom(
  discovery: WebsiteDiscoveryResult | null,
  officers: RegistryOfficer[],
  websiteSourceId: string,
  registrySourceId: string,
): ExplorePerson[] {
  const people: ExplorePerson[] = [];
  const seen = new Set<string>();
  for (const contact of discovery?.contacts ?? []) {
    const name = contact.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    people.push({
      id: `web-${people.length + 1}`,
      name,
      role: contact.jobTitle.trim(),
      email: contact.email.trim() || null,
      phone: contact.phone.trim() || null,
      sourceId: websiteSourceId,
    });
  }
  for (const officer of officers) {
    const key = officer.name.toLowerCase();
    if (seen.has(key)) {
      // The website already names this person; keep the richer record, add the register role if missing.
      const existing = people.find((p) => p.name.toLowerCase() === key);
      if (existing && !existing.role) existing.role = officer.role;
      continue;
    }
    seen.add(key);
    people.push({
      id: `reg-${people.length + 1}`,
      name: officer.name,
      role: officer.role,
      email: null,
      phone: null,
      sourceId: registrySourceId,
    });
  }
  return people;
}

function countryLabel(match: ExploreRegistryMatch): string {
  const map: Record<string, string> = {
    NO: "Norwegian",
    SE: "Swedish",
    DK: "Danish",
    FI: "Finnish",
    DE: "German",
    GB: "British",
    FR: "French",
    NL: "Dutch",
    BE: "Belgian",
    AT: "Austrian",
    CH: "Swiss",
    ES: "Spanish",
    PT: "Portuguese",
    IT: "Italian",
    EE: "Estonian",
    LU: "Luxembourg",
  };
  return map[match.countryCode] ?? match.country;
}

function latestTimestamp(hits: ExploreInternalHit[]): string | null {
  const stamps = hits.map((h) => h.timestamp).filter(Boolean).sort();
  return stamps.length > 0 ? stamps[stamps.length - 1]! : null;
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return formatRegionalDate(date);
}

export function composeSummary(input: {
  subject: string;
  known: ExploreKnownCompany[];
  registry: ExploreRegistryMatch | null;
  internal: ExploreInternalHit[];
  people: ExplorePerson[];
}): string {
  const { subject, known, registry, internal, people } = input;
  const first = known[0];
  const industry = registry?.industryDescription ? ` (${registry.industryDescription.toLowerCase()})` : "";
  const where = registry?.city ? `, based in ${registry.city}` : "";
  const traces =
    internal.length > 0
      ? `${internal.length} ${internal.length === 1 ? "item" : "items"} in our mail, files or Teams mention it`
      : "no correspondence with them on record";

  if (first) {
    const typeLabel = first.types.length > 0 ? first.types.join(", ") : "relationship not classified";
    return `${first.name} is already in SmartCRM (${typeLabel}) with ${first.contactCount} ${first.contactCount === 1 ? "contact" : "contacts"} and ${first.openOpportunities} ${first.openOpportunities === 1 ? "opportunity" : "opportunities"}. ${capitalize(traces)}.`;
  }

  if (registry) {
    const leadership = people.filter((p) => p.sourceId.startsWith("registry")).length;
    const peopleNote =
      people.length > 0
        ? ` ${people.length} named ${people.length === 1 ? "person" : "people"} found${leadership > 0 ? ", including registered leadership" : ""}.`
        : "";
    return `${registry.legalName} is a registered ${countryLabel(registry)} company${industry}${where}. Not in SmartCRM yet; ${traces}.${peopleNote}`;
  }

  return `Nothing in SmartCRM or the public registers matches "${subject}", and ${traces}. Check the spelling or give me their website.`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export async function exploreCompany(
  input: ExploreCompanyInput,
  deps: ExploreDeps,
): Promise<CompanyExploration> {
  const subject = input.subject.trim();

  const [registryRows, internalRows] = await Promise.all([
    deps.searchRegistry(subject).catch(() => [] as UnifiedEuropeanCompany[]),
    deps.searchInternal(subject).catch(() => [] as GraphSearchResultItem[]),
  ]);

  const { best, alternatives } = pickRegistryMatch(subject, registryRows);
  const registry = best ? toRegistryMatch(best) : null;

  const hintDomain = input.websiteHint ? normalizeCompanyDomain(input.websiteHint) : "";
  const knownBefore = knownCompanies(subject, best, hintDomain || null, input.companies, input.openOpportunityIds);
  const websiteUrl =
    input.websiteHint?.trim() ||
    registry?.website ||
    (knownBefore[0] ? input.companies.find((c) => c.CompanyID === knownBefore[0]!.companyId)?.Domain ?? "" : "");

  const [discovery, officers] = await Promise.all([
    websiteUrl ? deps.discoverWebsite(websiteUrl).catch(() => null) : Promise.resolve(null),
    best ? deps.fetchOfficers(best).catch(() => [] as RegistryOfficer[]) : Promise.resolve([] as RegistryOfficer[]),
  ]);

  const websiteDomain = discovery?.company.domain || (websiteUrl ? normalizeCompanyDomain(websiteUrl) : "");
  const known = knownCompanies(subject, best, websiteDomain || null, input.companies, input.openOpportunityIds);
  const internal = internalRows.map(toInternalHit);

  const sources: ExploreSource[] = [];
  const crmSourceId = "crm";
  sources.push({ id: crmSourceId, kind: "crm", label: "SmartCRM" });
  const registrySourceId = "registry";
  if (registry) {
    sources.push({
      id: registrySourceId,
      kind: "registry",
      label: registry.sourceRegistry,
      url: registryPublicUrl(registry),
    });
  }
  const websiteSourceId = "website";
  const website = discovery && websiteUrl ? websiteFromDiscovery(websiteUrl, discovery) : null;
  if (website) {
    sources.push({ id: websiteSourceId, kind: "website", label: website.domain, url: website.url });
  }
  const internalSourceId = "internal";
  if (internal.length > 0) {
    sources.push({ id: internalSourceId, kind: "internal", label: "Mail, files and Teams" });
  }

  const people = peopleFrom(discovery, officers, websiteSourceId, registrySourceId);

  const facts: ExploreFact[] = [];
  if (known[0]) {
    const k = known[0];
    facts.push({
      text: `Already in SmartCRM as ${k.name}${k.types.length > 0 ? ` (${k.types.join(", ")})` : ""}.`,
      sourceId: crmSourceId,
    });
  }
  if (registry) {
    facts.push({
      text: `${registry.legalName} — org. no. ${registry.registrationNumber}, ${registry.country}${registry.city ? `, ${registry.postalCode ?? ""} ${registry.city}`.replace(/\s+/g, " ") : ""}.`,
      sourceId: registrySourceId,
    });
    if (registry.industryDescription) {
      facts.push({
        text: `Registered industry: ${registry.industryDescription}${registry.industryCode ? ` (${registry.industryCode})` : ""}.`,
        sourceId: registrySourceId,
      });
    }
  }
  if (website) {
    const reach = [website.email, website.phone].filter(Boolean).join(" · ");
    facts.push({
      text: `Website ${website.domain}${reach ? ` — ${reach}` : ""}.`,
      sourceId: websiteSourceId,
    });
  }
  if (officers.length > 0) {
    facts.push({
      text: `Registered leadership: ${officers
        .slice(0, 4)
        .map((o) => `${o.name} (${o.role})`)
        .join(", ")}.`,
      sourceId: registrySourceId,
    });
  }
  if (internal.length > 0) {
    const latest = latestTimestamp(internal);
    facts.push({
      text: `${internal.length} ${internal.length === 1 ? "item" : "items"} in our mail, files or Teams mention it${latest ? `, latest ${formatDate(latest)}` : ""}.`,
      sourceId: internalSourceId,
    });
  }

  const unknown: string[] = [];
  if (!registry) {
    unknown.push("No register entry found under this name — the legal identity is unconfirmed.");
  }
  if (alternatives.length > 0) {
    unknown.push(
      `${alternatives.length} other registered ${alternatives.length === 1 ? "company has" : "companies have"} a similar name — confirm this is the right one.`,
    );
  }
  if (!website) {
    unknown.push(
      registry
        ? "The register lists no website, so what they actually do is unconfirmed. If you know it, add it below."
        : "No website found.",
    );
  } else if (discovery && discovery.contacts.length === 0) {
    unknown.push("Their website names no people.");
  }
  if (people.length === 0) {
    unknown.push("No named people yet — ask for a contact when you first reach out.");
  } else if (people.every((p) => !p.email && !p.phone)) {
    unknown.push("Named leadership has no email or phone on record yet.");
  }
  if (internal.length === 0) {
    unknown.push("No correspondence with them in our mail, files or Teams.");
  }
  if (known.length === 0) {
    unknown.push("What kind of relationship this is — choose when you import.");
  } else if (known[0] && known[0].types.length === 0) {
    unknown.push("Relationship posture is not set on the existing record.");
  }

  const summary = composeSummary({ subject, known, registry, internal, people });

  return {
    kind: "company",
    question: input.question,
    subject,
    summary,
    known: { companies: known, internal },
    found: {
      registry,
      alternatives: alternatives.map(toRegistryMatch),
      website,
      people,
      facts,
    },
    unknown,
    sources,
    next: {
      canImport: known.length === 0 && Boolean(registry || website),
      defaultType: "Unclassified",
      typeOptions: TYPE_OPTIONS,
      openHref: known[0]?.href ?? null,
    },
  };
}
