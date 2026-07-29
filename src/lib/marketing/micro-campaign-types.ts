/** Shared micro-campaign types — safe for client components. */

export type MicroCampaignType =
  | "LINKEDIN_POST"
  | "COLD_OUTREACH_SEQUENCE"
  | "SOLUTION_BRIEF";

export type MicroCampaignOptions = {
  campaignType: MicroCampaignType;
  targetRole?: string;
};

export type MicroCampaignAsset = {
  label: string;
  content: string;
};

export type MicroCampaignResult = {
  title: string;
  campaignType: MicroCampaignType;
  generatedAssets: MicroCampaignAsset[];
  keyAngles: string[];
  companyId: string;
  companyName: string;
  groundedIn: string[];
};

export const MICRO_CAMPAIGN_TYPES: Array<{
  id: MicroCampaignType;
  label: string;
}> = [
  { id: "LINKEDIN_POST", label: "LinkedIn Post" },
  { id: "COLD_OUTREACH_SEQUENCE", label: "Outreach Sequence" },
  { id: "SOLUTION_BRIEF", label: "Solution Brief" },
];

export const MICRO_CAMPAIGN_ROLES = [
  "Economic Buyer",
  "Executive Sponsor",
  "Champion",
  "Technical Evaluator",
  "Plant Manager",
  "Sustainability Lead",
] as const;
