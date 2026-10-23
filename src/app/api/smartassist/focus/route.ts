import { NextResponse } from "next/server";
import { buildSmartAssistFocus } from "@/lib/smart-assist-engine";
import { loadCorrespondenceEvidenceByCompanyId } from "@/lib/company-correspondence-data";
import { readLiveFocusContext, readLiveSmartDocsLibrary } from "@/lib/prisma-data";
import { listPendingTenders } from "@/lib/tenders/queries";
import { DEFAULT_AUTH_USER } from "@/types/auth";

export async function GET() {
  const focusPromise = readLiveFocusContext();
  const correspondencePromise = focusPromise.then(({ companies }) =>
    loadCorrespondenceEvidenceByCompanyId(companies, { take: 100 }).catch(
      () => new Map(),
    ),
  );

  const [
    { companies, pipelines, activities, commercialPackages },
    correspondenceByCompanyId,
    smartDocs,
    tenders,
  ] = await Promise.all([
    focusPromise,
    correspondencePromise,
    readLiveSmartDocsLibrary().catch(() => []),
    listPendingTenders({ take: 12 }).catch(() => []),
  ]);

  const focus = buildSmartAssistFocus(
    companies,
    pipelines,
    activities,
    commercialPackages,
    DEFAULT_AUTH_USER,
    { correspondenceByCompanyId, smartDocs, tenders },
  );

  return NextResponse.json({
    focus,
    meta: {
      companies,
      pipelines,
      activities,
      commercialPackages,
      correspondenceByCompanyId: Object.fromEntries(correspondenceByCompanyId),
      smartDocs,
      tenders,
    },
  });
}
