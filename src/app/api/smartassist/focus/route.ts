import { NextResponse } from "next/server";
import { buildSmartAssistFocus } from "@/lib/smart-assist-engine";
import { loadCorrespondenceEvidenceByCompanyId } from "@/lib/company-correspondence-data";
import { readLiveFocusContext } from "@/lib/prisma-data";
import { DEFAULT_AUTH_USER } from "@/types/auth";

export async function GET() {
  const { companies, pipelines, activities, commercialPackages } =
    await readLiveFocusContext();

  const correspondenceByCompanyId =
    await loadCorrespondenceEvidenceByCompanyId(companies);

  const focus = buildSmartAssistFocus(
    companies,
    pipelines,
    activities,
    commercialPackages,
    DEFAULT_AUTH_USER,
    { correspondenceByCompanyId },
  );

  return NextResponse.json({
    focus,
    meta: {
      companies,
      pipelines,
      activities,
      commercialPackages,
      correspondenceByCompanyId: Object.fromEntries(correspondenceByCompanyId),
    },
  });
}
