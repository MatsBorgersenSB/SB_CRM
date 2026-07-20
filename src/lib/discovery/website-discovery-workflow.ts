import type { WebsiteDiscoveryResult } from "@/lib/discovery/types";
import type { Company } from "@/types/company";

export type DiscoveryStepId =
  | "website_reachable"
  | "company_identified"
  | "discovering_contacts"
  | "discovering_emails"
  | "building_candidates";

export const DISCOVERY_STEP_ORDER: DiscoveryStepId[] = [
  "website_reachable",
  "company_identified",
  "discovering_contacts",
  "discovering_emails",
  "building_candidates",
];

export const DISCOVERY_STEP_LABELS: Record<DiscoveryStepId, string> = {
  website_reachable: "Website Reachable",
  company_identified: "Company Identified",
  discovering_contacts: "Discovering Contacts",
  discovering_emails: "Discovering Emails",
  building_candidates: "Building Contact Candidates",
};

export function countEmailsFound(discovery: WebsiteDiscoveryResult): number {
  const emails = new Set<string>();
  if (discovery.company.email.trim()) {
    emails.add(discovery.company.email.trim().toLowerCase());
  }
  for (const contact of discovery.contacts) {
    if (contact.email.trim()) emails.add(contact.email.trim().toLowerCase());
  }
  return emails.size;
}

export type WebsiteDiscoveryInsights = {
  keyStakeholders: string[];
  decisionMakers: string[];
  coverageNotes: string[];
};

const DECISION_MAKER_PATTERN =
  /\b(ceo|cto|cfo|director|manager|head|vp|president|founder|owner|lead|chief|sponsor|executive)\b/i;

export function buildWebsiteDiscoveryInsights(
  discovery: WebsiteDiscoveryResult,
): WebsiteDiscoveryInsights {
  const decisionMakers = discovery.contacts
    .filter(
      (c) =>
        DECISION_MAKER_PATTERN.test(c.jobTitle) || DECISION_MAKER_PATTERN.test(c.name),
    )
    .map((c) => (c.jobTitle ? `${c.name} · ${c.jobTitle}` : c.name))
    .slice(0, 5);

  const keyStakeholders = discovery.contacts
    .filter((c) => c.jobTitle.trim() || c.email.trim())
    .slice(0, 5)
    .map((c) => (c.jobTitle ? `${c.name} · ${c.jobTitle}` : c.name));

  const withEmail = discovery.contacts.filter((c) => c.email.trim()).length;
  const coverageNotes: string[] = [];

  if (discovery.contacts.length === 0) {
    coverageNotes.push("No named contacts on the website — consider manual stakeholder mapping.");
  } else if (withEmail < discovery.contacts.length) {
    coverageNotes.push(
      `${withEmail} of ${discovery.contacts.length} contacts have email — follow up on missing reachability.`,
    );
  } else {
    coverageNotes.push("All discovered contacts have email — strong import coverage.");
  }

  if (decisionMakers.length === 0 && discovery.contacts.length > 0) {
    coverageNotes.push("No clear executive titles found — verify decision-maker coverage after import.");
  } else if (decisionMakers.length > 0) {
    coverageNotes.push(
      `${decisionMakers.length} potential decision maker${decisionMakers.length === 1 ? "" : "s"} identified from titles.`,
    );
  }

  return {
    keyStakeholders,
    decisionMakers,
    coverageNotes,
  };
}

export type ImportCompletionSummary = {
  company: Company;
  companyCreated: boolean;
  newContacts: number;
  updatedContacts: number;
  skippedContacts: number;
  errors: string[];
  durationMs: number;
  importedContactIds: string[];
};

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
