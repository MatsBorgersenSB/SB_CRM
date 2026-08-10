import { DashboardShell } from "@/components/layout/dashboard-shell";
import { readLiveFocusContext } from "@/lib/prisma-data";

export default async function Home() {
  const { companies, pipelines, activities, commercialPackages } =
    await readLiveFocusContext();

  return (
    <DashboardShell
      companies={companies}
      pipelines={pipelines}
      activities={activities}
      commercialPackages={commercialPackages}
    />
  );
}
