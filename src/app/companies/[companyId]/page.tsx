import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Company360Shell } from "@/components/company-360/company-360-shell";
import { pickEntityRouteParam } from "@/lib/entity-route-utils";
import { readProjects } from "@/lib/project-db";
import { readInventory } from "@/lib/pipeline-db";
import {
  readLiveActivities,
  readLiveCommercialPackages,
  readLivePortfolio,
} from "@/lib/prisma-data";
import { resolveCompanyRouteRecord } from "@/lib/resolve-company-route";
import type { EntityRouteParams } from "@/lib/resolvers/entity-resolver";

type Company360PageProps = {
  params: Promise<EntityRouteParams>;
};

export default async function Company360Page({ params }: Company360PageProps) {
  const resolvedParams = await params;
  const rawKey = pickEntityRouteParam(resolvedParams, ["companyId", "id"]);

  if (!rawKey) {
    notFound();
  }

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

  const company = await resolveCompanyRouteRecord(companies, rawKey);

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
}
