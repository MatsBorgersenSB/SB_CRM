import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Company360Shell } from "@/components/company-360/company-360-shell";
import { getCompanyById } from "@/lib/data/companies";
import { loadCompanyDuplicateHint } from "@/lib/duplicate-management";
import { pickEntityRouteParam } from "@/lib/entity-route-utils";
import { readProjects } from "@/lib/project-db";
import { loadCorrespondenceEvidenceForCompany } from "@/lib/company-correspondence-data";
import {
  readLiveActivities,
  readLiveCommercialPackages,
  readLiveInventory,
  readLivePortfolio,
} from "@/lib/prisma-data";
import { emptyInventory } from "@/lib/inventory-data";
import type { EntityRouteParams } from "@/lib/resolvers/entity-resolver";
import type { Company } from "@/types/company";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Company360PageProps = {
  /** Next.js 15 — dynamic route params are async. */
  params: Promise<EntityRouteParams>;
};

function mergeCompanyIntoPortfolio(
  companies: Company[],
  company: Company,
): Company[] {
  const exists = companies.some(
    (row) =>
      row.CompanyID === company.CompanyID ||
      row.code === company.code ||
      row.code === company.CompanyID,
  );
  if (exists) {
    return companies.map((row) =>
      row.CompanyID === company.CompanyID ||
      row.code === company.code ||
      row.code === company.CompanyID
        ? company
        : row,
    );
  }
  return [...companies, company];
}

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
    readLiveActivities().catch((error) => {
      console.warn("[company-360] activities unavailable", error);
      return [];
    }),
    readLiveInventory().catch((error) => {
      console.warn("[company-360] inventory unavailable", error);
      return emptyInventory;
    }),
    readLiveCommercialPackages().catch((error) => {
      console.warn("[company-360] commercial packages unavailable", error);
      return [];
    }),
    readProjects().catch((error) => {
      console.warn("[company-360] projects unavailable", error);
      return [];
    }),
  ]);

  // Prisma by id OR code, then seed/portfolio with the same matchers.
  const resolved = await getCompanyById(cleanId, companies);

  if (!resolved) {
    notFound();
  }

  const company: Company = {
    ...resolved,
    contacts: resolved.contacts ?? [],
    pipelineIds: resolved.pipelineIds ?? [],
  };

  const shellCompanies = mergeCompanyIntoPortfolio(companies, company);
  const [duplicateHint, correspondence] = await Promise.all([
    loadCompanyDuplicateHint(company.code || company.CompanyID).catch((error) => {
      console.warn("[company-360] duplicate hint unavailable", error);
      return null;
    }),
    loadCorrespondenceEvidenceForCompany(company).catch((error) => {
      console.warn("[company-360] correspondence unavailable", error);
      return null;
    }),
  ]);

  return (
    <Suspense fallback={null}>
      <Company360Shell
        initialCompany={company}
        companies={shellCompanies}
        pipelines={pipelines}
        activities={activities}
        inventory={inventory}
        commercialPackages={commercialPackages}
        projects={projects}
        duplicateHint={duplicateHint}
        correspondence={correspondence}
      />
    </Suspense>
  );
}
