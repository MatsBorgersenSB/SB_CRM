import { TeamWorkspaceShell } from "@/components/collaboration/team-workspace-shell";
import { readLiveFocusContext } from "@/lib/prisma-data";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const EMPTY = {
  companies: [] as Company[],
  pipelines: [] as PipelineRow[],
  activities: [] as Activity[],
  commercialPackages: [] as CommercialPackage[],
};

export default async function TeamPage() {
  let focus = EMPTY;
  try {
    focus = await readLiveFocusContext();
  } catch (error) {
    console.warn(
      "[team] focus unavailable",
      error instanceof Error ? error.message : error,
    );
  }

  return (
    <TeamWorkspaceShell
      companies={focus.companies}
      pipelines={focus.pipelines}
      activities={focus.activities}
    />
  );
}
