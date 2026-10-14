import "server-only";

import { discoverWebsite } from "@/lib/discovery/website-discovery";
import { normalizeWebsiteUrl } from "@/lib/discovery/website-fetch";
import { searchEuropeanRegisters } from "@/lib/integrations/company-registers";
import { fetchNorwayOfficers } from "@/lib/integrations/company-registers/adapters/norway";
import { mockGraphSearchResults, searchInternalContext } from "@/lib/smartassist/graphSearch";
import type { ExploreDeps } from "@/lib/smartassist/explore/company-explore";
import type { Company } from "@/types/company";

/** Live sources: public registers, the company's own website, and the user's Microsoft 365. */
export function liveExploreDeps(input: {
  graphToken: string | null;
  companies: Company[];
}): ExploreDeps {
  // Reality First: fictional mail/Teams hits only when explicitly requested, never just because a token is missing.
  const useMockGraph = process.env.MOCK_GRAPH_SEARCH === "true";

  return {
    searchRegistry: (subject) => searchEuropeanRegisters(subject, { limit: 6 }),
    fetchOfficers: (match) =>
      match.countryCode === "NO" ? fetchNorwayOfficers(match.registrationNumber) : Promise.resolve([]),
    discoverWebsite: async (url) => {
      let normalized: string;
      try {
        normalized = normalizeWebsiteUrl(url);
      } catch {
        return null;
      }
      return discoverWebsite(normalized, input.companies);
    },
    searchInternal: async (subject) => {
      if (useMockGraph) return mockGraphSearchResults();
      if (!input.graphToken) return [];
      return searchInternalContext(subject, input.graphToken);
    },
  };
}
