import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Company360Shell } from "@/components/company-360/company-360-shell";
import { readProjects } from "@/lib/project-db";
import {
  readActivities,
  readCommercialPackages,
  readCompanies,
  readInventory,
  readPipelines,
} from "@/lib/pipeline-db";

type Company360PageProps = {
  params: Promise<{ companyId: string }>;
};

export default async function Company360Page({ params }: Company360PageProps) {
  const { companyId } = await params;

  const [companies, pipelines, activities, inventory, commercialPackages, projects] = await Promise.all([
    readCompanies(),
    readPipelines(),
    readActivities(),
    readInventory(),
    readCommercialPackages(),
    readProjects(),
  ]);

  const company = companies.find(
    (record) => record.CompanyID === companyId || String(record.id) === companyId,
  );

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
