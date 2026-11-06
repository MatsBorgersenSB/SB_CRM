import { WorkspaceLoading } from "@/components/ui/workspace-feedback";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Deal360PageShell } from "@/components/layout/deal-360-page-shell";
import { normalizeEntityParam } from "@/lib/resolvers/entity-resolver";
import {
  readLiveActivities,
  readLiveCommercialPackages,
  readLivePortfolio,
} from "@/lib/prisma-data";
import { readProjects } from "@/lib/project-db";
import {
  findOpportunityInPortfolio,
  findPrismaOpportunityByRouteKey,
  resolveOpportunityRouteRecord,
} from "@/lib/resolve-opportunity-route";
import { mapPrismaOpportunityToPipelineRow } from "@/lib/prisma-mappers";
import { project360Href } from "@/types/relationship-navigation";
import type { PipelineRow } from "@/types/pipeline";

type OpportunityRouteParams = {
  id?: string;
  dealId?: string;
  opportunityId?: string;
};

/**
 * Shared Opportunity / Deal 360 loader.
 * Pattern: normalize param → Prisma (try/catch) → portfolio/seed → notFound().
 */
export async function OpportunityDetailWorkspace({
  params,
  paramKeys = ["id", "dealId", "opportunityId"],
}: {
  params: Promise<OpportunityRouteParams>;
  paramKeys?: Array<keyof OpportunityRouteParams>;
}) {
  const resolvedParams = await params;

  let rawKey = "";
  for (const key of paramKeys) {
    const value = resolvedParams[key];
    if (value) {
      rawKey = normalizeEntityParam(value);
      if (rawKey) break;
    }
  }

  // Mirror: id || dealId, decode, strip query, trim (case kept for UUID / PL- codes)
  const cleanKey = rawKey.toLowerCase();

  if (!rawKey) {
    notFound();
  }

  const [
    { companies, pipelines: portfolioPipelines },
    activities,
    commercialPackages,
    projects,
  ] = await Promise.all([
    readLivePortfolio(),
    readLiveActivities(),
    readLiveCommercialPackages(),
    readProjects().catch(() => []),
  ]);

  let prismaMapped: PipelineRow | null = null;
  let prismaArchived = false;
  try {
    const prismaRow =
      (await findPrismaOpportunityByRouteKey(rawKey)) ??
      (await findPrismaOpportunityByRouteKey(cleanKey));
    if (prismaRow) {
      if (prismaRow.status === "archived") {
        prismaArchived = true;
      } else {
        prismaMapped = mapPrismaOpportunityToPipelineRow(prismaRow);
      }
    }
  } catch (error) {
    console.warn("DB opportunity lookup bypassed:", error);
  }

  // If this opportunity was moved into a Development Project, redirect directly to the Project 360.
  const migratedProject = projects.find(
    (p) =>
      p.migratedFromDealId?.toLowerCase() === cleanKey ||
      p.migratedFromDealCode?.toLowerCase() === cleanKey ||
      (prismaArchived && p.linkedDealId?.toLowerCase() === cleanKey),
  );
  if (migratedProject) {
    redirect(project360Href(migratedProject.id));
  }

  // Prisma is the source of truth for captured understanding. Never prefer a
  // list projection that omitted those answers.
  let opportunity =
    prismaMapped ??
    findOpportunityInPortfolio(portfolioPipelines, rawKey) ??
    findOpportunityInPortfolio(portfolioPipelines, cleanKey) ??
    null;

  if (!opportunity) {
    opportunity =
      (await resolveOpportunityRouteRecord(portfolioPipelines, rawKey)) ?? null;
  }

  if (!opportunity) {
    notFound();
  }

  const pipelines = prismaMapped
    ? [
        prismaMapped,
        ...portfolioPipelines.filter((row) => row.id !== prismaMapped!.id),
      ]
    : portfolioPipelines.some((row) => row.id === opportunity.id)
      ? portfolioPipelines
      : [opportunity, ...portfolioPipelines];

  return (
    <Suspense fallback={<WorkspaceLoading label="Opening opportunity" />}>
      <Deal360PageShell
        dealId={opportunity.id}
        companies={companies}
        pipelines={pipelines}
        activities={activities}
        commercialPackages={commercialPackages}
      />
    </Suspense>
  );
}
