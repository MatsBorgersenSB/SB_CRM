import { Suspense } from "react";
import { CompaniesOperationsShell } from "@/components/layout/companies-operations-shell";
import {
  readActivities,
  readCommercialPackages,
  readCompanies,
  readPipelines,
} from "@/lib/pipeline-db";

export default async function CompaniesPage() {
  const [companies, pipelines, activities, commercialPackages] = await Promise.all([
    readCompanies(),
    readPipelines(),
    readActivities(),
    readCommercialPackages(),
  ]);

  return (
    <Suspense fallback={null}>
      <CompaniesOperationsShell
        companies={companies}
        pipelines={pipelines}
        activities={activities}
        commercialPackages={commercialPackages}
      />
    </Suspense>
  );
}
