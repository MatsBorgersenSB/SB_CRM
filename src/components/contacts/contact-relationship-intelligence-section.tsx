"use client";

import { ContactLifecycleInsights } from "@/components/contacts/contact-lifecycle-insights";
import { MissingTouchpointsPanel } from "@/components/m365/missing-touchpoints-panel";
import type { Activity } from "@/types/activity";
import type { Company } from "@/types/company";
import type { Contact } from "@/types/contact";
import type { OutlookEvidenceRecord } from "@/types/outlook-reconciliation";
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
  outlookEvidence,
  showEmailReconciliation,
  onReconciliationImported,
}: {
  contact: Contact;
  companyId: string;
  companyName: string;
  companies: Company[];
  pipelines: PipelineRow[];
  activities: Activity[];
  outlookEvidence?: OutlookEvidenceRecord[];
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

      {showEmailReconciliation && outlookEvidence ? (
        <div className="border-t border-carbon-blue/10 pt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-carbon-blue/40">
            Outlook emails
          </p>
          <MissingTouchpointsPanel
            companies={companies}
            pipelines={pipelines}
            activities={activities}
            outlookEvidence={outlookEvidence}
            entityFilter={{
              entityType: "contact",
              entityId: contact.ContactID,
            }}
            onImported={onReconciliationImported}
          />
        </div>
      ) : null}
    </div>
  );
}
