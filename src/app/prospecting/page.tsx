import { ProspectingRadarWorkspace } from "@/components/prospecting/prospecting-radar-workspace";
import { readLiveCompanies } from "@/lib/prisma-data";
import { listPendingTenders } from "@/lib/tenders/queries";
import type { TenderListItem } from "@/lib/tenders/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function ProspectingRadarPage() {
  let tenders: TenderListItem[] = [];
  try {
    tenders = await listPendingTenders();
  } catch (error) {
    console.warn(
      "[prospecting] Unable to load tenders:",
      error instanceof Error ? error.message : error,
    );
  }

  const companies = await readLiveCompanies().catch(() => []);

  return <ProspectingRadarWorkspace tenders={tenders} companies={companies} />;
}
