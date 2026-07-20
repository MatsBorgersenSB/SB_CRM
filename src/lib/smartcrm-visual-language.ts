/**
 * SmartCRM Visual Language (Phase 4D.6)
 * Consistent scan-friendly icons across all workspaces.
 */

export const SMARTCRM_ICONS = {
  contact: "👤",
  company: "🏢",
  opportunity: "🎯",
  document: "📄",
  documentSet: "📁",
  email: "📧",
  phone: "📞",
  location: "📍",
  website: "🌐",
  meeting: "📅",
  needsAttention: "⚠",
  urgent: "🔥",
  waiting: "⏳",
  healthy: "✅",
  completed: "✓",
  value: "💰",
  stage: "📈",
  probability: "🎲",
  opNumber: "🔖",
  edit: "✏️",
  search: "🔍",
  activity: "📅",
  add: "➕",
  project: "🚀",
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
  | "CommercialBaseline";

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

export function healthStatusScanIcon(
  status: string,
): RelationshipHealthScanIcon {
  if (status === "At Risk") return "urgent";
  if (status === "Weak") return "needsAttention";
  return "healthy";
}

export function healthStatusEmoji(status: string): string {
  return SMARTCRM_ICONS[healthStatusScanIcon(status)];
}

export function attentionObjectEmoji(objectType: AttentionObjectTypeKey): string {
  return ATTENTION_OBJECT_ICONS[objectType];
}

export function searchEntityEmoji(entityType: SearchEntityTypeKey): string {
  return SEARCH_ENTITY_ICONS[entityType];
}
