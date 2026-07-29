import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Company360Shell } from "@/components/company-360/company-360-shell";
import { getCompanyById } from "@/lib/data/companies";
import { pickEntityRouteParam } from "@/lib/entity-route-utils";
import { readProjects } from "@/lib/project-db";
import { readInventory } from "@/lib/pipeline-db";
import {
  readLiveActivities,
  readLiveCommercialPackages,
  readLivePortfolio,
} from "@/lib/prisma-data";
import type { EntityRouteParams } from "@/lib/resolvers/entity-resolver";

type Company360PageProps = {
  /** Next.js 15 — dynamic route params are async. */
  params: Promise<EntityRouteParams>;
};

export default async function Company360Page({ params }: Company360PageProps) {
  const resolvedParams = await params;
  const rawId =
    pickEntityRouteParam(resolvedParams, ["companyId", "id"]) ||
    resolvedParams.companyId ||
    resolvedParams.id ||
    "";

  const cleanId = (() => {
    try {
      return decodeURIComponent(String(rawId).split("?")[0] ?? "").trim();
    } catch {
      return String(rawId).trim();
    }
  })();

  if (!cleanId) {
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

  // Prisma by id OR code, then seed/portfolio with the same matchers.
  const company = await getCompanyById(cleanId, companies);

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
