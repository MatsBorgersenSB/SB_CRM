import { getActivitiesForCompany } from "@/lib/activity-utils";
import { getCompanySmartDocs, getLinkedPipelines } from "@/lib/company-utils";
import type { Company } from "@/types/company";
import type { Activity } from "@/types/activity";
import type { PipelineRow } from "@/types/pipeline";

export type CompanyDeletionBlockers = {
  opportunities: number;
  activities: number;
  documents: number;
};

export function getCompanyDeletionBlockers(
  company: Company,
  pipelines: PipelineRow[],
  activities: Activity[],
): CompanyDeletionBlockers {
  const linkedPipelines = getLinkedPipelines(company, pipelines);
  const companyActivities = getActivitiesForCompany(activities, company);
  const documents = getCompanySmartDocs(company, pipelines).filter(
    (pipeline) => Boolean(pipeline.FileLeafRef?.trim()),
  );

  return {
    opportunities: linkedPipelines.length,
    activities: companyActivities.length,
    documents: documents.length,
  };
}

export function isCompanyDeletable(blockers: CompanyDeletionBlockers): boolean {
  return (
    blockers.opportunities === 0 &&
    blockers.activities === 0 &&
    blockers.documents === 0
  );
}

export const COMPANY_DELETE_BLOCKED_MESSAGE = "Cannot delete. Archive instead.";
