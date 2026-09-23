import { DashboardShell } from "@/components/layout/dashboard-shell";
import { readLiveFocusContext, readLiveSmartDocsLibrary } from "@/lib/prisma-data";
import { listPendingTenders } from "@/lib/tenders/queries";
import type { Activity } from "@/types/activity";
import type { CommercialPackage } from "@/types/commercial-package";
import type { Company } from "@/types/company";
import type { PipelineRow } from "@/types/pipeline";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";
import type { TenderListItem } from "@/lib/tenders/types";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const EMPTY_FOCUS = {
  companies: [] as Company[],
  pipelines: [] as PipelineRow[],
  activities: [] as Activity[],
  commercialPackages: [] as CommercialPackage[],
};

function settle<T>(promise: Promise<T>, fallback: T, label: string): Promise<T> {
  return promise.catch((error) => {
    console.warn(
      `[today] ${label} unavailable`,
      error instanceof Error ? error.message : error,
    );
    return fallback;
  });
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  fallback: T,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[today] ${label} timed out after ${ms}ms`);
      resolve(fallback);
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export default async function Home() {
  const focus = await withTimeout(
    settle(readLiveFocusContext(), EMPTY_FOCUS, "focus"),
    8000,
    EMPTY_FOCUS,
    "focus",
  );
  const companies = focus.companies;
  const pipelines = focus.pipelines;
  const activities = focus.activities;
  const commercialPackages = focus.commercialPackages;

  const emptyDocs: SmartDocLibraryRecord[] = [];
  const emptyTenders: TenderListItem[] = [];
  const [smartDocs, tenders] = await Promise.all([
    withTimeout(
      settle(readLiveSmartDocsLibrary(), emptyDocs, "SmartDocs"),
      4000,
      emptyDocs,
      "SmartDocs",
    ),
    withTimeout(
      settle(
        listPendingTenders({ take: 12, expire: false }),
        emptyTenders,
        "tenders",
      ),
      4000,
      emptyTenders,
      "tenders",
    ),
  ]);

  return (
    <DashboardShell
      companies={companies}
      pipelines={pipelines}
      activities={activities}
      commercialPackages={commercialPackages}
      smartDocs={smartDocs}
      tenders={tenders}
    />
  );
}
