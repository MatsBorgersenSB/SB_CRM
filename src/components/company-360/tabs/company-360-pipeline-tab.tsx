"use client";

import type { Company360Snapshot } from "@/lib/company-360-data";
import type { DocumentIntelligence } from "@/lib/document-intelligence-engine";
import { Company360DealsTab } from "@/components/company-360/tabs/company-360-deals-tab";
import { Company360DocumentsTab } from "@/components/company-360/tabs/company-360-documents-tab";
import { Company360MaterialsTab } from "@/components/company-360/tabs/company-360-materials-tab";
import { CollapsibleSection } from "@/components/ui/collapsible-section";

export function Company360PipelineTab({
  snapshot,
  documentIntelligences,
}: {
  snapshot: Company360Snapshot;
  documentIntelligences: DocumentIntelligence[];
}) {
  const docCount = snapshot.documents.length;
  const materialCount = snapshot.materials.length;

  return (
    <div className="flex flex-col gap-4">
      <Company360DealsTab pipelines={snapshot.pipelines} />

      {docCount > 0 ? (
        <CollapsibleSection
          title="Documents in context"
          description={`${docCount} SmartDoc${docCount === 1 ? "" : "s"} linked to this account`}
          tier="nice-to-have"
        >
          <Company360DocumentsTab
            documents={snapshot.documents}
            intelligences={documentIntelligences}
          />
        </CollapsibleSection>
      ) : null}

      {materialCount > 0 ? (
        <CollapsibleSection
          title="Materials"
          description={`${materialCount} feedstock track${materialCount === 1 ? "" : "s"}`}
          tier="expert"
        >
          <Company360MaterialsTab materials={snapshot.materials} />
        </CollapsibleSection>
      ) : null}
    </div>
  );
}
