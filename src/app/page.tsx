import { DashboardShell } from "@/components/layout/dashboard-shell";
import { readLiveFocusContext } from "@/lib/prisma-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
