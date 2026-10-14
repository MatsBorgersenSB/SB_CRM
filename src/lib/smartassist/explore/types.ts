import type { CompanyType } from "@/types/company-type";

/** What the user is really asking for. Decides which sources we consult. */
export type ExploreIntent =
  | { kind: "company"; subject: string }
  | { kind: "suppliers"; commodity: string; region: string | null }
  | { kind: "regulation"; topic: string };

export type ExploreSourceKind = "crm" | "registry" | "website" | "internal";

/** Every fact on the card points at one of these. */
export type ExploreSource = {
  id: string;
  kind: ExploreSourceKind;
  label: string;
  url?: string;
};

export type ExploreFact = {
  text: string;
  sourceId: string;
};

/** A company we already hold. */
export type ExploreKnownCompany = {
  companyId: string;
  name: string;
  href: string;
  types: string[];
  contactCount: number;
  openOpportunities: number;
};

export type ExploreInternalHit = {
  id: string;
  sourceType: "OUTLOOK" | "ONEDRIVE" | "TEAMS";
  title: string;
  timestamp: string;
  snippet: string;
  webUrl: string;
};

/** A register entry — the authoritative identity. */
export type ExploreRegistryMatch = {
  legalName: string;
  registrationNumber: string;
  vatNumber: string | null;
  country: string;
  countryCode: string;
  streetAddress: string | null;
  postalCode: string | null;
  city: string | null;
  industryCode: string | null;
  industryDescription: string | null;
  website: string | null;
  sourceRegistry: string;
};

export type ExploreWebsite = {
  url: string;
  domain: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  pagesRead: number;
};

/** A person we could import. Register officers have no email until we find one. */
export type ExplorePerson = {
  id: string;
  name: string;
  role: string;
  email: string | null;
  phone: string | null;
  sourceId: string;
};

export type CompanyExploration = {
  kind: "company";
  question: string;
  subject: string;
  /** One or two plain sentences: what this is and where we stand. */
  summary: string;
  known: {
    companies: ExploreKnownCompany[];
    internal: ExploreInternalHit[];
  };
  found: {
    registry: ExploreRegistryMatch | null;
    /** Other register entries with a similar name, so the user can confirm which one. */
    alternatives: ExploreRegistryMatch[];
    website: ExploreWebsite | null;
    people: ExplorePerson[];
    facts: ExploreFact[];
  };
  unknown: string[];
  sources: ExploreSource[];
  next: {
    /** False when the company is already in SmartCRM. */
    canImport: boolean;
    /** Constitution: unknown stays Unclassified unless the user says otherwise. */
    defaultType: CompanyType;
    typeOptions: CompanyType[];
    /** Set when the company already exists. */
    openHref: string | null;
  };
};

/** Intents we recognise but cannot research yet. We still say what we hold internally. */
export type UnsupportedExploration = {
  kind: "unsupported";
  question: string;
  intent: ExploreIntent;
  summary: string;
  known: { internal: ExploreInternalHit[] };
  unknown: string[];
  sources: ExploreSource[];
};

export type ExploreResult = CompanyExploration | UnsupportedExploration;

export type ExploreImportRequest = {
  exploration: CompanyExploration;
  companyType: CompanyType;
  selectedPeopleIds: string[];
  accountOwner?: { Id: number; Title: string } | null;
};

export type ExploreImportResult = {
  companyId: string;
  href: string;
  created: boolean;
  peopleImported: number;
  peopleSkipped: number;
};
