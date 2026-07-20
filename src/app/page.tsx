import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  readActivities,
  readCommercialPackages,
  readCompanies,
  readPipelines,
} from "@/lib/pipeline-db";

export default async function Home() {
  const [pipelines, companies, activities, commercialPackages] = await Promise.all([
    readPipelines(),
    readCompanies(),
    readActivities(),
    readCommercialPackages(),
  ]);

  return (
    <DashboardShell
      companies={companies}
      pipelines={pipelines}
      activities={activities}
      commercialPackages={commercialPackages}
    />
  );
}
