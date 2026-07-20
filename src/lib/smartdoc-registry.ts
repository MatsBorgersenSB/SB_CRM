import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import { formatReactorCapacity } from "@/types/pipeline";
import type { SmartDocRecord } from "@/types/smartdoc";
import {
  smartDocFromLinkedDocument,
  smartDocFromLibraryRecord,
  smartDocFromPipeline,
} from "@/types/smartdoc";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";
import { findCompanyForDeal } from "@/lib/opportunity-intelligence-engine";

function slugify(value: string): string {
  return value.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48);
}

export function buildSmartDocRegistry(
  pipelines: PipelineRow[],
  activities: Activity[],
  library: SmartDocLibraryRecord[] = [],
): SmartDocRecord[] {
  const byId = new Map<string, SmartDocRecord>();

  for (const record of library) {
    byId.set(record.SmartDocID, smartDocFromLibraryRecord(record));
  }

  for (const pipeline of pipelines) {
    const doc = smartDocFromPipeline(pipeline);
    if (doc && !byId.has(doc.id)) byId.set(doc.id, doc);
  }

  for (const activity of activities) {
    for (const linked of activity.LinkedDocuments ?? []) {
      const dealId = linked.DealId;
      if (dealId && byId.has(dealId)) continue;

      const id = dealId ?? `doc-${slugify(linked.Title)}`;
      if (!byId.has(id)) {
        byId.set(id, smartDocFromLinkedDocument(linked, id));
      }
    }
  }

  return Array.from(byId.values());
}

export function getSmartDocById(
  documentId: string,
  pipelines: PipelineRow[],
  activities: Activity[],
  library: SmartDocLibraryRecord[] = [],
): SmartDocRecord | undefined {
  return buildSmartDocRegistry(pipelines, activities, library).find(
    (d) => d.id === documentId,
  );
}

export function getActivitiesReferencingDocument(
  document: SmartDocRecord,
  activities: Activity[],
): Activity[] {
  return activities.filter((activity) => {
    if (document.pipelineId && activity.Deal?.Title === document.pipelineId) {
      if (
        activity.Subject.toLowerCase().includes("smartdoc") ||
        activity.ActivityType === "Proposal Sent"
      ) {
        return true;
      }
    }

    return (activity.LinkedDocuments ?? []).some(
      (linked) =>
        linked.Title === document.fileName ||
        linked.DealId === document.pipelineId ||
        document.fileName.includes(linked.Title),
    );
  });
}

export function getLinkedCompaniesForDocument(
  document: SmartDocRecord,
  companies: Company[],
  pipelines: PipelineRow[],
): Company[] {
  const dealId = document.pipelineId ?? document.clientLookup;
  const company = findCompanyForDeal(dealId, companies);
  if (company) return [company];

  return companies.filter(
    (c) =>
      c.pipelineIds.includes(dealId) ||
      c.pipelineIds.includes(document.clientLookup),
  );
}

export function getLinkedPipelineForDocument(
  document: SmartDocRecord,
  pipelines: PipelineRow[],
): PipelineRow | undefined {
  const id = document.pipelineId ?? document.clientLookup;
  return pipelines.find((p) => p.id === id);
}

export function getLinkedContactsForDocument(
  document: SmartDocRecord,
  companies: Company[],
  activities: Activity[],
): Array<{ contactId: string; name: string; companyName: string }> {
  const refs = getActivitiesReferencingDocument(document, activities);
  const seen = new Set<string>();
  const contacts: Array<{ contactId: string; name: string; companyName: string }> = [];

  for (const activity of refs) {
    if (!activity.Contact?.Title) continue;
    const key = activity.Contact.Title;
    if (seen.has(key)) continue;
    seen.add(key);
    contacts.push({
      contactId: key,
      name: activity.Contact.Title,
      companyName: activity.Company?.Title ?? "—",
    });
  }

  for (const company of getLinkedCompaniesForDocument(document, companies, [])) {
    for (const contact of company.contacts) {
      const key = contact.ContactID;
      if (seen.has(key)) continue;
      seen.add(key);
      contacts.push({
        contactId: key,
        name: `${contact.FirstName} ${contact.LastName}`.trim(),
        companyName: company.Title,
      });
    }
  }

  return contacts.slice(0, 8);
}

export function getMaterialLinksForDocument(
  document: SmartDocRecord,
  pipeline: PipelineRow | undefined,
): Array<{ label: string; detail: string }> {
  if (!pipeline) return [];
  return [
    {
      label: pipeline.targetFeedstock,
      detail: `${formatReactorCapacity(pipeline.reactorDesignCapacity)} · ${pipeline.status}`,
    },
  ];
}
