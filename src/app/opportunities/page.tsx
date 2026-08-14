import { Suspense } from "react";
import { OpportunitiesOperationsShell } from "@/components/layout/opportunities-operations-shell";
import {
  readLiveActivities,
  readLiveCommercialPackages,
  readLivePortfolio,
} from "@/lib/prisma-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OpportunitiesPage() {
  const [{ companies, pipelines }, activities, commercialPackages] = await Promise.all([
    readLivePortfolio(),
    readLiveActivities(),
    readLiveCommercialPackages(),
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
