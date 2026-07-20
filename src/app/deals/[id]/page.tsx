import { Suspense } from "react";
import { Deal360PageShell } from "@/components/layout/deal-360-page-shell";
import { readActivities, readCommercialPackages, readCompanies, readPipelines } from "@/lib/pipeline-db";

type Deal360PageProps = {
  params: Promise<{ id: string }>;
};

export default async function Deal360Page({ params }: Deal360PageProps) {
  const { id } = await params;

  const [companies, pipelines, activities, commercialPackages] = await Promise.all([
    readCompanies(),
    readPipelines(),
    readActivities(),
    readCommercialPackages(),
  ]);

  return (
    <Suspense fallback={null}>
      <Deal360PageShell
        dealId={id}
        companies={companies}
        pipelines={pipelines}
        activities={activities}
        commercialPackages={commercialPackages}
      />
    </Suspense>
  );
}
