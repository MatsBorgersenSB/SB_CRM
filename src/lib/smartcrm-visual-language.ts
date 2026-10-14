/**
 * SmartCRM Visual Language (Phase 4D.6)
 * Semantic icon names shared across all workspaces.
 *
 * Icons render as Lucide line icons via `@/components/ui/smartcrm-icon`
 * — the same family as the sidebar. The registry below is the list of
 * semantic names; the text value is a plain-text fallback for non-UI
 * contexts (logs, exports) and must never be used as a visual glyph.
 */

export const SMARTCRM_ICONS = {
  contact: "contact",
  company: "company",
  opportunity: "opportunity",
  document: "document",
  documentSet: "document set",
  email: "email",
  phone: "phone",
  location: "location",
  website: "website",
  meeting: "meeting",
  needsAttention: "needs attention",
  urgent: "urgent",
  waiting: "waiting",
  healthy: "healthy",
  completed: "completed",
  value: "value",
  stage: "stage",
  probability: "probability",
  opNumber: "opportunity number",
  edit: "edit",
  search: "search",
  activity: "activity",
  add: "add",
  project: "project",
} as const;

export type SmartCRMIconName = keyof typeof SMARTCRM_ICONS;

export type AttentionSeverityKey =
  | "urgent"
  | "needs_attention"
  | "waiting"
  | "healthy"
  | "completed";

export type AttentionObjectTypeKey =
  | "Company"
  | "Contact"
  | "Opportunity"
  | "Activity"
  | "Document"
  | "DocumentSet"
  | "TransmissionPackage"
  | "CommercialBaseline"
  | "Tender";

export type SearchEntityTypeKey =
  | "company"
  | "contact"
  | "deal"
  | "activity"
  | "document"
  | "document_set"
  | "transmission"
  | "attention"
  | "note"
  | "raw_material";

export const ATTENTION_SEVERITY_ICONS: Record<AttentionSeverityKey, string> = {
  urgent: SMARTCRM_ICONS.urgent,
  needs_attention: SMARTCRM_ICONS.needsAttention,
  waiting: SMARTCRM_ICONS.waiting,
  healthy: SMARTCRM_ICONS.healthy,
  completed: SMARTCRM_ICONS.completed,
};

export const ATTENTION_OBJECT_ICONS: Record<AttentionObjectTypeKey, string> = {
  Company: SMARTCRM_ICONS.company,
  Contact: SMARTCRM_ICONS.contact,
  Opportunity: SMARTCRM_ICONS.opportunity,
  Activity: SMARTCRM_ICONS.meeting,
  Document: SMARTCRM_ICONS.document,
  DocumentSet: SMARTCRM_ICONS.documentSet,
  TransmissionPackage: SMARTCRM_ICONS.documentSet,
  CommercialBaseline: SMARTCRM_ICONS.document,
  Tender: SMARTCRM_ICONS.search,
};

export const SEARCH_ENTITY_ICONS: Record<SearchEntityTypeKey, string> = {
  company: SMARTCRM_ICONS.company,
  contact: SMARTCRM_ICONS.contact,
  deal: SMARTCRM_ICONS.opportunity,
  activity: SMARTCRM_ICONS.meeting,
  document: SMARTCRM_ICONS.document,
  document_set: SMARTCRM_ICONS.documentSet,
  transmission: SMARTCRM_ICONS.documentSet,
  attention: SMARTCRM_ICONS.needsAttention,
  note: SMARTCRM_ICONS.edit,
  raw_material: SMARTCRM_ICONS.documentSet,
};

/** Hub section titles → icon for living workspaces */
export const HUB_SECTION_ICONS: Record<string, SmartCRMIconName> = {
  "Company Details": "company",
  Company: "company",
  "Associated Contacts": "contact",
  Contacts: "contact",
  Contact: "contact",
  Person: "contact",
  Reach: "email",
  "Open Opportunities": "opportunity",
  Opportunities: "opportunity",
  Pipeline: "opportunity",
  "Related Opportunities": "opportunity",
  "Commercial Summary": "value",
  "Business Context": "document",
  Stakeholders: "contact",
  Activities: "activity",
  "Current Attention Items": "needsAttention",
  Attention: "needsAttention",
  "Next Action": "needsAttention",
  Document: "document",
  Documents: "document",
  "Document Set": "documentSet",
  Intelligence: "search",
  "Project Objective": "document",
  Milestones: "stage",
  Decisions: "edit",
  Risks: "needsAttention",
  Projects: "project",
  "Relationship Memory": "meeting",
  "Master Data": "edit",
};

export type RelationshipHealthScanIcon = "healthy" | "needsAttention" | "urgent";

/**
 * Map any health label (relationship, project, opportunity) onto a scan icon.
 * The symbol must never contradict the word, so anything that is not clearly
 * healthy resolves to a warning rather than a tick.
 */
export function healthStatusScanIcon(
  status: string,
): RelationshipHealthScanIcon {
  const normalized = status.trim().toLowerCase();
  if (normalized === "at risk" || normalized === "critical") return "urgent";
  if (
    normalized === "weak" ||
    normalized === "needs attention" ||
    normalized === "warning" ||
    normalized === "fair"
  ) {
    return "needsAttention";
  }
  if (
    normalized === "healthy" ||
    normalized === "strong" ||
    normalized === "strategic" ||
    normalized === "good" ||
    normalized === "stable"
  ) {
    return "healthy";
  }
  return "needsAttention";
}

