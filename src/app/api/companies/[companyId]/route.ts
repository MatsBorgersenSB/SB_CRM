import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { canDeleteCompany } from "@/lib/permissions";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { getServerSharePointServices } from "@/services/sharepoint/factory";
import type { UpdateCompanyInput } from "@/services/sharepoint/repositories/local/local-companies.repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;

  try {
    const { companies } = getServerSharePointServices();
    const company = await companies.getById(companyId);
    return NextResponse.json(company);
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const body = (await request.json()) as UpdateCompanyInput;

  try {
    const { companies } = getServerSharePointServices();
    const updated = await companies.update(companyId, body);
    return NextResponse.json(updated);
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const role = getRequestRole(request);

  if (!canDeleteCompany(role)) {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden("Only superusers can delete companies"),
    );
  }

  try {
    const { companies } = getServerSharePointServices();
    await companies.delete(companyId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
