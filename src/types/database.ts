import type { AnalyticsDb } from "@/lib/analytics-data";
import type { Company } from "@/lib/companies-data";
import type { Activity } from "@/types/activity";
import type { Interaction } from "@/lib/interactions-data";
import type { InventoryDb } from "@/lib/inventory-data";
import type { PipelineRow } from "@/types/pipeline";
import type { CommercialPackage } from "@/types/commercial-package";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";
import type { StoredResearchReport } from "@/types/research-report";
import type { OutlookEvidenceRecord } from "@/types/outlook-reconciliation";
import type { CompanyRole } from "@/types/entity-roles";

export type { CompanyRole };

export type PipelineDatabase = {
  pipelines: PipelineRow[];
  inventory: InventoryDb;
  companies: Company[];
  analytics: AnalyticsDb;
  /** @deprecated Migrated to activities */
  interactions?: Interaction[];
  activities: Activity[];
  commercialPackages: CommercialPackage[];
  smartDocsLibrary: SmartDocLibraryRecord[];
  researchReports?: StoredResearchReport[];
  /** Connected Outlook/Teams/Calendar evidence for reconciliation (Phase 1.26) */
  outlookEvidence?: OutlookEvidenceRecord[];
};
