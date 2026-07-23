import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { getServerSharePointServices } from "@/services/sharepoint/factory";
import type { CreateContactInput } from "@/types/contact";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const role = getRequestRole(request);
  if (role === "client_lead") {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden("Insufficient role to create contacts"),
    );
  }

  const { companyId } = await params;
  const body = (await request.json()) as CreateContactInput;

  try {
    const { contacts } = getServerSharePointServices();
    const contact = await contacts.create({
      ...body,
      Company: { CompanyID: companyId },
    });

    const actor = resolveAuditActor(request, role);
    await logAuditEvent({
      ...actor,
      action: "CONTACT_CREATED",
      entityType: "Contact",
      entityId: contact.ContactID,
      ipAddress: clientIpFromRequest(request),
      metadata: {
        companyId,
        title: contact.Title,
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
