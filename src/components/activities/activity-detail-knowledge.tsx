"use client";

import { useSearchParams } from "next/navigation";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";
import type { StandardBioUserRecord } from "@/types/user-access";
import { ActivityBriefingView } from "@/components/activities/activity-briefing-view";
import { ActivityKnowledgeEditor } from "@/components/activities/activity-knowledge-editor";

export function ActivityDetailKnowledge({
  activity,
  companies,
  pipelines,
  allActivities,
  smartDocsLibrary,
  commercialPackages,
  assignableUsers = [],
}: {
  activity: Activity;
  companies: Company[];
  pipelines: PipelineRow[];
  allActivities: Activity[];
  smartDocsLibrary: SmartDocLibraryRecord[];
  commercialPackages: CommercialPackage[];
  assignableUsers?: StandardBioUserRecord[];
}) {
  const searchParams = useSearchParams();
  const capture = searchParams.get("capture") === "1";

  return (
    <ActivityKnowledgeEditor
      activity={activity}
      companies={companies}
      pipelines={pipelines}
      allActivities={allActivities}
      defaultEditing={capture}
      renderReadView={({ onEdit }) => (
        <ActivityBriefingView
          activity={activity}
          companies={companies}
          pipelines={pipelines}
          allActivities={allActivities}
          smartDocsLibrary={smartDocsLibrary}
          commercialPackages={commercialPackages}
          assignableUsers={assignableUsers}
          onEdit={onEdit}
        />
      )}
    />
  );
}
