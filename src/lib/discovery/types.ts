export type DiscoveredContact = {
  id: string;
  name: string;
  jobTitle: string;
  email: string;
  phone: string;
};

/** Structured geo extracted during website discovery (maps to Prisma company address fields). */
export type DiscoveredGeoAddress = {
  streetAddress: string;
  postalCode: string;
  city: string;
  stateRegion: string;
  country: string;
  countryCode: string;
  continent: string;
};

export type DiscoveredCompany = {
  name: string;
  phone: string;
  email: string;
  website: string;
  /** Raw address string as found on the site (display / fallback). */
  address: string;
  domain: string;
  streetAddress: string;
  postalCode: string;
  city: string;
  stateRegion: string;
  country: string;
  countryCode: string;
  continent: string;
};

export type WebsiteDiscoveryResult = {
  sourceUrl: string;
  company: DiscoveredCompany;
  contacts: DiscoveredContact[];
  matchedCompanyId: string | null;
  matchedCompanyName: string | null;
  pagesAnalyzed: string[];
};
