import { DashboardShell } from "@/components/layout/dashboard-shell";
import {
  readLiveActivities,
  readLiveCommercialPackages,
  readLivePortfolio,
} from "@/lib/prisma-data";

export default async function Home() {
  const [{ companies, pipelines }, activities, commercialPackages] = await Promise.all([
    readLivePortfolio(),
    readLiveActivities(),
    readLiveCommercialPackages(),
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
