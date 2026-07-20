import { discoverWebsite } from "../src/lib/discovery/website-discovery";

const result = await discoverWebsite("https://fjordfilter.com");
console.log(
  JSON.stringify(
    {
      company: result.company,
      contacts: result.contacts,
      pagesAnalyzed: result.pagesAnalyzed,
    },
    null,
    2,
  ),
);
