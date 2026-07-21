import { AppShell } from "@/components/layout/app-shell";
import { readLiveActivities, readLivePortfolio } from "@/lib/prisma-data";

export default async function DealsPage() {
  const [{ companies, pipelines }, activities] = await Promise.all([
    readLivePortfolio(),
    readLiveActivities(),
  ]);

  return (
    <AppShell
      initialPipelines={pipelines}
      companies={companies}
      activities={activities}
    />
  );
}
