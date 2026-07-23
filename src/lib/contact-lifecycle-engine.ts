import { getContactDisplayName } from "@/types/contact";
import type { Contact } from "@/types/contact";
import type {
  CareerHistoryEntry,
  CompanyTransferRecord,
  ContactLifecycleAudit,
  ContactLifecycleInsight,
  EmploymentStatus,
} from "@/types/contact-lifecycle";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { activityMatchesContact, getActivitiesForContact } from "@/lib/activity-utils";

/** Pure contact lifecycle analysis — safe for client and server bundles (no fs). */

export type ContactLifecycleContext = {
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
};

function lifecycleId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function normalizeEmploymentStatus(
  contact: Pick<Contact, "EmploymentStatus" | "IsSuspicious" | "IsArchived">,
): EmploymentStatus {
  if (contact.IsArchived) return "Former Employee";
  if (contact.IsSuspicious) return "Suspicious";
  return contact.EmploymentStatus ?? "Active";
}

export function buildCurrentCareerEntry(
  contact: Contact,
  company: Pick<Company, "CompanyID" | "Title">,
  startDate?: string,
): CareerHistoryEntry {
  return {
    id: lifecycleId("career"),
    companyId: company.CompanyID,
    companyName: company.Title,
    role: contact.Role,
    jobTitle: contact.JobTitle || contact.Role,
    startDate: startDate ?? new Date().toISOString().slice(0, 10),
    endDate: null,
  };
}

export function buildCareerTimeline(
  contact: Contact,
  company: Pick<Company, "CompanyID" | "Title">,
): CareerHistoryEntry[] {
  const history = [...(contact.CareerHistory ?? [])];
  const currentIndex = history.findIndex(
    (entry) => entry.companyId === company.CompanyID && entry.endDate === null,
  );

  if (currentIndex === -1) {
    history.push(buildCurrentCareerEntry(contact, company));
  } else {
    history[currentIndex] = {
      ...history[currentIndex],
      role: contact.Role,
      jobTitle: contact.JobTitle || contact.Role,
      companyName: company.Title,
    };
  }

  return history.sort((a, b) => {
    const aDate = a.endDate ?? a.startDate;
    const bDate = b.endDate ?? b.startDate;
    return bDate.localeCompare(aDate);
  });
}

/** Hide career timeline when a contact has only one company and one role with no transfers. */
export function isTimelineMeaningful(
  contact: Pick<Contact, "CareerHistory" | "CompanyTransfers">,
  timeline: CareerHistoryEntry[],
): boolean {
  const transfers = contact.CompanyTransfers ?? [];
  if (transfers.length > 0) return true;

  const distinctCompanies = new Set(timeline.map((entry) => entry.companyId));
  if (distinctCompanies.size > 1) return true;

  const closedRoles = timeline.filter((entry) => entry.endDate !== null);
  if (closedRoles.length > 0) return true;

  const openRoles = timeline.filter((entry) => entry.endDate === null);
  if (openRoles.length > 1) return true;

  return timeline.length > 1;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function nameKey(contact: Pick<Contact, "FirstName" | "LastName">): string {
  return getContactDisplayName(contact).toLowerCase();
}

export function findDuplicateContacts(
  contact: Contact,
  companyId: string,
  context: ContactLifecycleContext,
): { contact: Contact; companyId: string; companyName: string; reason: string }[] {
  const duplicates: {
    contact: Contact;
    companyId: string;
    companyName: string;
    reason: string;
  }[] = [];

  const email = normalizeEmail(contact.Email);
  const name = nameKey(contact);

  for (const company of context.companies) {
    for (const candidate of company.contacts) {
      if (candidate.ContactID === contact.ContactID) continue;

      const sameEmail = email && normalizeEmail(candidate.Email) === email;
      const sameName = name && nameKey(candidate) === name;

      if (sameEmail) {
        duplicates.push({
          contact: candidate,
          companyId: company.CompanyID,
          companyName: company.Title,
          reason: "Same email address",
        });
      } else if (sameName && company.CompanyID === companyId) {
        duplicates.push({
          contact: candidate,
          companyId: company.CompanyID,
          companyName: company.Title,
          reason: "Same name at this company",
        });
      } else if (sameName && candidate.Phone && contact.Phone && candidate.Phone === contact.Phone) {
        duplicates.push({
          contact: candidate,
          companyId: company.CompanyID,
          companyName: company.Title,
          reason: "Same name and phone number",
        });
      }
    }
  }

  return duplicates;
}

function countOpportunityReferences(
  contactId: string,
  company: Company,
  pipelines: PipelineRow[],
): number {
  const linked = new Set<string>(company.pipelineIds);

  for (const pipeline of pipelines) {
    const onTeam = pipeline.team?.some((member) => member.contactId === contactId);
    if (onTeam) linked.add(pipeline.id);
  }

  return linked.size;
}

export function countPreservedReferences(
  contact: Contact,
  company: Company,
  context: ContactLifecycleContext,
): CompanyTransferRecord["preservedReferences"] {
  const activities = getActivitiesForContact(context.activities, contact.ContactID, contact);
  const opportunities = countOpportunityReferences(
    contact.ContactID,
    company,
    context.pipelines,
  );

  const documents = activities.reduce(
    (count, activity) => count + (activity.LinkedDocuments?.length ?? 0),
    0,
  );

  const emails = activities.filter(
    (activity) =>
      activity.ActivityType === "Email" ||
      activity.Subject.toLowerCase().includes("email"),
  ).length;

  return {
    activities: activities.length,
    documents,
    opportunities,
    emails,
  };
}

function contactHref(contactId: string, companyId: string, action?: string): string {
  const base = `/contacts/${encodeURIComponent(contactId)}?company=${encodeURIComponent(companyId)}`;
  return action ? `${base}&lifecycle=${action}` : base;
}

export function analyzeContactLifecycle(
  contact: Contact,
  companyId: string,
  companyName: string,
  context: ContactLifecycleContext,
): ContactLifecycleAudit {
  const insights: ContactLifecycleInsight[] = [];
  const transfers = contact.CompanyTransfers ?? [];
  const latestTransfer = transfers[transfers.length - 1];

  if (latestTransfer) {
    const daysSince = Math.floor(
      (Date.now() - new Date(latestTransfer.transferDate).getTime()) / 86_400_000,
    );
    if (daysSince <= 90) {
      insights.push({
        id: `company-move-${contact.ContactID}`,
        category: "company_move",
        categoryLabel: "Company move",
        title: `${getContactDisplayName(contact)} moved to ${latestTransfer.newCompanyName}`,
        why: `Transfer recorded ${latestTransfer.transferDate} from ${latestTransfer.previousCompanyName}.`,
        impact:
          "Relationship context shifted — review open opportunities and re-establish cadence at the new company.",
        recommendedAction: "Confirm role and schedule an introduction at the new company.",
        resolutionHref: contactHref(contact.ContactID, companyId, "transfer"),
        resolutionLabel: "Review company transfer",
        severity: "warning",
      });
    }
  }

  const career = buildCareerTimeline(contact, {
    CompanyID: companyId,
    Title: companyName,
  });
  const roleChanges = career.filter(
    (entry, index, rows) =>
      index > 0 &&
      rows[index - 1]!.companyId === entry.companyId &&
      rows[index - 1]!.role !== entry.role,
  );

  if (roleChanges.length > 0) {
    const latest = roleChanges[0]!;
    insights.push({
      id: `role-change-${contact.ContactID}`,
      category: "role_change",
      categoryLabel: "Role change",
      title: `Role changed to ${latest.role}`,
      why: `Career timeline shows a role transition at ${latest.companyName}.`,
      impact: "Stakeholder map and deal influence may have changed.",
      recommendedAction: "Update stakeholder mapping and revisit active opportunities.",
      resolutionHref: contactHref(contact.ContactID, companyId, "position"),
      resolutionLabel: "Update contact position",
      severity: "info",
    });
  }

  const duplicates = findDuplicateContacts(contact, companyId, context);
  for (const duplicate of duplicates.slice(0, 3)) {
    insights.push({
      id: `duplicate-${contact.ContactID}-${duplicate.contact.ContactID}`,
      category: "potential_duplicate",
      categoryLabel: "Potential duplicate",
      title: `Possible duplicate: ${getContactDisplayName(duplicate.contact)}`,
      why: `${duplicate.reason} — also listed at ${duplicate.companyName}.`,
      impact: "Split history weakens relationship intelligence and follow-up accuracy.",
      recommendedAction: "Review both records and merge if they represent the same person.",
      resolutionHref: contactHref(contact.ContactID, companyId, "merge"),
      resolutionLabel: "Review merge candidates",
      severity: "warning",
    });
  }

  const contactActivities = getActivitiesForContact(
    context.activities,
    contact.ContactID,
    contact,
  );
  const employmentStatus = normalizeEmploymentStatus(contact);

  if (
    employmentStatus === "Active" &&
    contactActivities.length >= 3 &&
    contact.RelationshipLevel !== "Strategic"
  ) {
    insights.push({
      id: `relationship-opportunity-${contact.ContactID}`,
      category: "relationship_opportunity",
      categoryLabel: "Relationship opportunity",
      title: "High engagement — consider elevating relationship",
      why: `${contactActivities.length} logged interactions with ${getContactDisplayName(contact)}.`,
      impact: "Strong operational contact may be ready for strategic engagement.",
      recommendedAction: "Review relationship level and map to active opportunities.",
      resolutionHref: contactHref(contact.ContactID, companyId, "edit"),
      resolutionLabel: "Elevate relationship level",
      severity: "info",
    });
  }

  if (contact.IsArchived) {
    insights.push({
      id: `archived-${contact.ContactID}`,
      category: "relationship_opportunity",
      categoryLabel: "Archived contact",
      title: "Contact is archived",
      why: "Archived contacts are hidden from default lists but history is preserved.",
      impact: "No active outreach expected unless restored.",
      recommendedAction: "Restore contact if relationship resumes.",
      resolutionHref: contactHref(contact.ContactID, companyId, "archive"),
      resolutionLabel: "Manage archive status",
      severity: "info",
    });
  }

  const summary =
    insights.length === 0
      ? "No lifecycle signals — this relationship appears stable."
      : `${insights.length} lifecycle signal${insights.length === 1 ? "" : "s"} detected. Review recommendations below.`;

  return {
    contactId: contact.ContactID,
    generatedAt: new Date().toISOString(),
    insights,
    summary,
  };
}

export function toActionableInsight(
  insight: ContactLifecycleInsight,
): {
  id: string;
  eyebrow: string;
  title: string;
  why: string;
  impact: string;
  recommendedAction: string;
  expectedOutcome: string;
  resolutionHref: string;
  resolutionLabel: string;
  severity: "critical" | "warning" | "healthy";
} {
  return {
    id: insight.id,
    eyebrow: insight.categoryLabel,
    title: insight.title,
    why: insight.why,
    impact: insight.impact,
    recommendedAction: insight.recommendedAction,
    expectedOutcome:
      "Lifecycle risk is addressed with a clear owner action — relationship continuity stays commercially protected.",
    resolutionHref: insight.resolutionHref,
    resolutionLabel: insight.resolutionLabel,
    severity:
      insight.severity === "critical"
        ? "critical"
        : insight.severity === "warning"
          ? "warning"
          : "healthy",
  };
}

export { lifecycleId };

const DEPARTURE_EMPLOYMENT_STATUSES = new Set([
  "Former Employee",
  "Left Company",
  "Retired",
]);

export type ContactRelationshipPortfolioInsight = {
  contactId: string;
  contactName: string;
  companyId: string;
  companyName: string;
  insightCount: number;
  topInsightTitle: string;
  resolutionHref: string;
  severity: "critical" | "warning" | "info";
};

export function analyzeContactRelationshipPortfolio(
  context: ContactLifecycleContext,
): {
  generatedAt: string;
  summary: string;
  contacts: ContactRelationshipPortfolioInsight[];
  totals: {
    roleChanges: number;
    companyChanges: number;
    duplicates: number;
    opportunities: number;
  };
} {
  const contacts: ContactRelationshipPortfolioInsight[] = [];
  let roleChanges = 0;
  let companyChanges = 0;
  let duplicates = 0;
  let opportunities = 0;

  for (const company of context.companies) {
    for (const contact of company.contacts) {
      if (contact.IsArchived) continue;

      const audit = analyzeContactLifecycle(
        contact,
        company.CompanyID,
        company.Title,
        context,
      );

      if (audit.insights.length === 0) continue;

      for (const insight of audit.insights) {
        if (insight.category === "role_change") roleChanges += 1;
        if (insight.category === "company_move") companyChanges += 1;
        if (insight.category === "potential_duplicate") duplicates += 1;
        if (insight.category === "relationship_opportunity") opportunities += 1;
      }

      const top = audit.insights[0]!;
      contacts.push({
        contactId: contact.ContactID,
        contactName: getContactDisplayName(contact),
        companyId: company.CompanyID,
        companyName: company.Title,
        insightCount: audit.insights.length,
        topInsightTitle: top.title,
        resolutionHref: top.resolutionHref,
        severity: top.severity,
      });
    }
  }

  contacts.sort((a, b) => {
    const order = { critical: 0, warning: 1, info: 2 };
    return order[a.severity] - order[b.severity];
  });

  const summary =
    contacts.length === 0
      ? "All contacts appear stable — no lifecycle signals across the portfolio."
      : `${contacts.length} contact${contacts.length === 1 ? "" : "s"} with lifecycle signals — review role changes, company moves, duplicates, and opportunities.`;

  return {
    generatedAt: new Date().toISOString(),
    summary,
    contacts,
    totals: { roleChanges, companyChanges, duplicates, opportunities },
  };
}
