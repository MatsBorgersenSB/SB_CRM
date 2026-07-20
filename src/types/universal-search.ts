import type { AttentionAction } from "@/types/attention-item";

export const SEARCH_ENTITY_TYPES = [
  "company",
  "contact",
  "deal",
  "activity",
  "document",
  "document_set",
  "transmission",
  "attention",
  "note",
  "raw_material",
] as const;

export type SearchEntityType = (typeof SEARCH_ENTITY_TYPES)[number];

export type SearchSmartMeta = {
  locationLabel?: string;
  openOpportunities?: number;
  pipelineValueLabel?: string;
  contactCount?: number;
  attentionCount?: number;
  companyId?: string;
  companyName?: string;
};

export type SearchIndexItem = {
  id: string;
  entityType: SearchEntityType;
  name: string;
  typeLabel: string;
  contextPreview: string;
  /** Human-readable last activity e.g. "Phone Call · 3 hours ago" */
  lastActivityLabel: string;
  /** ISO date for sorting suggestions — empty when unknown */
  lastActivityAt: string;
  href: string;
  /** Lowercase haystack for client-side matching */
  searchText: string;
  /** Rich living-record metadata for companies and hubs */
  smartMeta?: SearchSmartMeta;
  /** Attention item id when entityType is attention */
  attentionItemId?: string;
  /** Executable Smart Assist actions */
  actions?: AttentionAction[];
};

export type SearchResultGroup = {
  entityType: SearchEntityType | "command" | "relationship";
  label: string;
  items: SearchIndexItem[];
};

export type RelationshipSearchBundle = {
  companyId: string;
  companyName: string;
  locationLabel: string;
  openOpportunities: number;
  contactCount: number;
  pipelineValueLabel: string;
  attentionCount: number;
  href: string;
  contacts: SearchIndexItem[];
  opportunities: SearchIndexItem[];
  documents: SearchIndexItem[];
  attentionItems: SearchIndexItem[];
};

export type SearchCommand = {
  id: string;
  label: string;
  description: string;
  href: string;
  keywords: string[];
};

export type AskSearchResult = {
  answer: string;
  recommendedAction: string;
  actionHref?: string;
  items: SearchIndexItem[];
};

export type SmartSearchMode = "search" | "ask";

export const SEARCH_GROUP_LABELS: Record<SearchEntityType, string> = {
  company: "Companies",
  contact: "Contacts",
  deal: "Opportunities",
  activity: "Activities",
  document: "Documents",
  document_set: "Document Sets",
  transmission: "Transmission Packages",
  attention: "Attention Items",
  note: "Notes",
  raw_material: "Raw Materials",
};

export const SEARCH_GROUP_ORDER: SearchEntityType[] = [
  "company",
  "contact",
  "deal",
  "document",
  "document_set",
  "transmission",
  "attention",
  "activity",
  "note",
  "raw_material",
];

export const ASK_SUGGESTED_QUESTIONS = [
  "Which opportunities need attention?",
  "Which companies have no recent activity?",
  "What quotations are awaiting response?",
  "Which opportunities close this month?",
  "Which customers have the highest pipeline value?",
  "Which suppliers do we work with?",
  "Who are our strategic customers?",
  "What changed this week?",
] as const;

export const SEARCH_COMMANDS: SearchCommand[] = [
  {
    id: "create-company",
    label: "Create Company",
    description: "Add a new account to SmartCRM",
    href: "/companies?tools=1",
    keywords: ["create company", "new company", "add company"],
  },
  {
    id: "create-contact",
    label: "Create Contact",
    description: "Add a stakeholder to an account",
    href: "/companies?tools=1",
    keywords: ["create contact", "new contact", "add contact"],
  },
  {
    id: "create-opportunity",
    label: "Create Opportunity",
    description: "Open the opportunities workspace",
    href: "/opportunities",
    keywords: ["create opportunity", "new opportunity", "add opportunity", "new deal"],
  },
  {
    id: "schedule-meeting",
    label: "Schedule Meeting",
    description: "Open activities to plan a meeting",
    href: "/activities",
    keywords: ["schedule meeting", "book meeting", "plan meeting"],
  },
  {
    id: "build-document-set",
    label: "Build Document Set",
    description: "Open opportunities to manage commercial packages",
    href: "/opportunities",
    keywords: ["build document set", "create document set", "document set"],
  },
  {
    id: "create-transmission",
    label: "Create Transmission Package",
    description: "Open opportunities with commercial workflow",
    href: "/opportunities?filter=needs_attention",
    keywords: ["create transmission", "transmission package", "send quotation"],
  },
  {
    id: "draft-email",
    label: "Draft Customer Email",
    description: "Go to Focus to act on attention items",
    href: "/",
    keywords: ["draft email", "draft customer email", "compose email"],
  },
  {
    id: "exec-brief",
    label: "Generate Executive Brief",
    description: "Weekly portfolio summary and recommendations",
    href: "/intelligence",
    keywords: ["generate executive brief", "executive brief", "executive briefing"],
  },
  {
    id: "sales-review",
    label: "Generate Sales Review",
    description: "Pipeline and opportunity intelligence",
    href: "/intelligence",
    keywords: ["generate sales review", "sales review"],
  },
  {
    id: "commercial-review",
    label: "Generate Commercial Review",
    description: "Quotations, transmission, and baseline progress",
    href: "/intelligence",
    keywords: ["generate commercial review", "commercial review"],
  },
  {
    id: "company-summary",
    label: "Generate Company Summary",
    description: "Open companies workspace for account review",
    href: "/companies",
    keywords: ["generate company summary", "company summary"],
  },
  {
    id: "opportunity-assessment",
    label: "Generate Opportunity Assessment",
    description: "Open opportunities operations workspace",
    href: "/opportunities",
    keywords: ["generate opportunity assessment", "opportunity assessment"],
  },
];
