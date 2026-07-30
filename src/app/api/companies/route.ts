import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getRequestRole } from "@/lib/api-auth";
import { canCreateCompany } from "@/lib/permissions";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";
import type { NewCompanyInput } from "@/lib/entity-id";
import {
  parsePageRequest,
  sharePointErrorResponse,
} from "@/services/sharepoint/server/api-utils";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { getServerSharePointServices } from "@/services/sharepoint/factory";
import { companyRouteKey } from "@/types/company-360";
import { checkCompanyDuplicate } from "@/lib/validation/deduplication";

export async function GET(request: Request) {
  try {
    const { companies } = getServerSharePointServices();
    const page = parsePageRequest(request);
    const result = await companies.list(page);

    if (page.pageSize || page.skipToken) {
      return NextResponse.json(result);
    }

    return NextResponse.json(result.items);
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const role = getRequestRole(request);
  if (!canCreateCompany(role)) {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden("Insufficient role to create companies"),
    );
  }

  const body = (await request.json()) as NewCompanyInput;

  try {
    const dedupe = await checkCompanyDuplicate({
      name: body.Title,
      orgNumber: body.organizationNumber ?? undefined,
    });

    if (dedupe.status === "DUPLICATE_EXISTS") {
      return NextResponse.json(
        {
          error: `A company named "${dedupe.existingCompany.name}" already exists.`,
          status: dedupe.status,
          existingCompany: dedupe.existingCompany,
        },
        { status: 409 },
      );
    }

    const { companies } = getServerSharePointServices();
    const company = await companies.create(body);

    const key = companyRouteKey(company);
    const actor = resolveAuditActor(request, role);
    await logAuditEvent({
      ...actor,
      action: "COMPANY_CREATED",
      entityType: "Company",
      entityId: key || company.CompanyID,
      ipAddress: clientIpFromRequest(request),
      metadata: { title: company.Title, code: company.code ?? company.CompanyID },
    });

    revalidatePath("/companies");
    revalidatePath("/contacts");

    return NextResponse.json(
      {
        ...company,
        href: `/companies/${encodeURIComponent(key)}`,
      },
      { status: 201 },
    );
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
