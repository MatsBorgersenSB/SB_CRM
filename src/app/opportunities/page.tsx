import { Suspense } from "react";
import { OpportunitiesOperationsShell } from "@/components/layout/opportunities-operations-shell";
import { readActivities, readCommercialPackages, readCompanies, readPipelines } from "@/lib/pipeline-db";

export default async function OpportunitiesPage() {
  const [pipelines, companies, activities, commercialPackages] = await Promise.all([
    readPipelines(),
    readCompanies(),
    readActivities(),
    readCommercialPackages(),
  ]);

  return (
    <Suspense fallback={null}>
      <OpportunitiesOperationsShell
        pipelines={pipelines}
        companies={companies}
        activities={activities}
        commercialPackages={commercialPackages}
      />
    </Suspense>
  );
}
