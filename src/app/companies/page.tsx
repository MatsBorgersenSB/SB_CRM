import { Suspense } from "react";
import { CompaniesOperationsShell } from "@/components/layout/companies-operations-shell";
import {
  readLiveActivities,
  readLiveCommercialPackages,
  readLivePortfolio,
} from "@/lib/prisma-data";

export default async function CompaniesPage() {
  const [{ companies, pipelines }, activities, commercialPackages] = await Promise.all([
    readLivePortfolio(),
    readLiveActivities(),
    readLiveCommercialPackages(),
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
