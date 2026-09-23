import { NextResponse } from "next/server";
import { buildSmartAssistFocus } from "@/lib/smart-assist-engine";
import { loadCorrespondenceEvidenceByCompanyId } from "@/lib/company-correspondence-data";
import { readLiveFocusContext, readLiveSmartDocsLibrary } from "@/lib/prisma-data";
import { listPendingTenders } from "@/lib/tenders/queries";
import { DEFAULT_AUTH_USER } from "@/types/auth";

export async function GET() {
  const { companies, pipelines, activities, commercialPackages } =
    await readLiveFocusContext();

  const [correspondenceByCompanyId, smartDocs, tenders] = await Promise.all([
    loadCorrespondenceEvidenceByCompanyId(companies, { take: 100 }).catch(
      () => new Map(),
    ),
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
