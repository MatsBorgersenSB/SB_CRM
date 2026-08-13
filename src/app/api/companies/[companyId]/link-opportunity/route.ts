import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { canManageOpportunityStakeholders } from "@/lib/permissions";
import { linkCompanyToPipeline, resolveCompanyForSmartDocs } from "@/lib/pipeline-db";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const role = getRequestRole(request);

  if (!canManageOpportunityStakeholders(role)) {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden(
        "You cannot link opportunities for this company",
      ),
    );
  }

  try {
    const body = (await request.json()) as { pipelineId?: string };
    const pipelineId = body.pipelineId?.trim();
    if (!pipelineId) {
      return NextResponse.json({ error: "pipelineId is required" }, { status: 400 });
    }

    const company = await resolveCompanyForSmartDocs(companyId);
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const updated = await linkCompanyToPipeline(company.CompanyID, pipelineId);
    return NextResponse.json({ company: updated });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
