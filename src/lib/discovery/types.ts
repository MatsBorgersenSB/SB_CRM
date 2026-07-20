export type DiscoveredContact = {
  id: string;
  name: string;
  jobTitle: string;
  email: string;
  phone: string;
};

export type DiscoveredCompany = {
  name: string;
  phone: string;
  email: string;
  website: string;
  address: string;
  domain: string;
};

export type WebsiteDiscoveryResult = {
  sourceUrl: string;
  company: DiscoveredCompany;
  contacts: DiscoveredContact[];
  matchedCompanyId: string | null;
  matchedCompanyName: string | null;
  pagesAnalyzed: string[];
};
