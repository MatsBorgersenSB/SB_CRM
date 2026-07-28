import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Company360Shell } from "@/components/company-360/company-360-shell";
import { isNextNotFound, normalizeRouteKey } from "@/lib/entity-route-utils";
import { readProjects } from "@/lib/project-db";
import { readInventory } from "@/lib/pipeline-db";
import {
  readLiveActivities,
  readLiveCommercialPackages,
  readLivePortfolio,
} from "@/lib/prisma-data";
import { resolveCompanyRouteRecord } from "@/lib/resolve-company-route";

type Company360PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function Company360Page({ params }: Company360PageProps) {
  const resolvedParams = await params;
  const companyId = normalizeRouteKey(resolvedParams.companyId);

  if (!companyId) {
    notFound();
  }

  try {
    const [
      { companies, pipelines },
      activities,
      inventory,
      commercialPackages,
      projects,
    ] = await Promise.all([
      readLivePortfolio(),
      readLiveActivities(),
      readInventory(),
      readLiveCommercialPackages(),
      readProjects(),
    ]);

    const company = await resolveCompanyRouteRecord(companies, companyId);

    if (!company) {
      notFound();
    }

    return (
      <Suspense fallback={null}>
        <Company360Shell
          initialCompany={company}
          companies={companies}
          pipelines={pipelines}
          activities={activities}
          inventory={inventory}
          commercialPackages={commercialPackages}
          projects={projects}
        />
      </Suspense>
    );
  } catch (error) {
    if (isNextNotFound(error)) throw error;
    console.error(
      "[Company360Page] Company detail failed:",
      error instanceof Error ? error.message : error,
    );
    notFound();
  }
}
