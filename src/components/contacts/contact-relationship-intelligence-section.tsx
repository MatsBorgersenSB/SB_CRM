"use client";

import { ContactLifecycleInsights } from "@/components/contacts/contact-lifecycle-insights";
import { ContactRecentOutlook } from "@/components/contacts/contact-recent-outlook";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { Contact } from "@/types/contact";
import { getContactDisplayName } from "@/types/contact";
import type { PipelineRow } from "@/types/pipeline";

/**
 * Insights and recommended actions — health lives in the status panel (Phase 1.28B).
 */
export function ContactRelationshipIntelligenceSection({
  contact,
  companyId,
  companyName,
  companies,
  pipelines,
  activities,
}: {
  contact: Contact;
  companyId: string;
  companyName: string;
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  /** @deprecated Seed Outlook reconciliation replaced by live ContactRecentOutlook. */
  outlookEvidence?: unknown;
  showEmailReconciliation?: boolean;
  onReconciliationImported?: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <ContactLifecycleInsights
        contact={contact}
        companyId={companyId}
        companyName={companyName}
        companies={companies}
        pipelines={pipelines}
        activities={activities}
        showBanner={false}
      />

      <ContactRecentOutlook
        contactId={contact.ContactID}
        contactEmail={contact.Email || undefined}
        contactName={getContactDisplayName(contact)}
        contactPhone={contact.Mobile || contact.Phone || undefined}
      />
    </div>
  );
}
