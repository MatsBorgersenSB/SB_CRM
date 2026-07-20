import type { Document360Snapshot } from "@/lib/document-360-data";
import { Document360ActivitiesTab } from "@/components/smartdocs/tabs/document-360-activities-tab";
import { Document360MaterialsTab } from "@/components/smartdocs/tabs/document-360-materials-tab";
import { Document360OpportunitiesTab } from "@/components/smartdocs/tabs/document-360-opportunities-tab";
import { Document360RelationshipsTab } from "@/components/smartdocs/tabs/document-360-relationships-tab";

export function Document360LinkedTab({ snapshot }: { snapshot: Document360Snapshot }) {
  return (
    <div className="flex flex-col gap-8">
      <Document360RelationshipsTab snapshot={snapshot} />
      <Document360OpportunitiesTab snapshot={snapshot} />
      <Document360ActivitiesTab snapshot={snapshot} />
      <Document360MaterialsTab snapshot={snapshot} />
    </div>
  );
}
