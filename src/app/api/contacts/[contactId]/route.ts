import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { canDeleteContact } from "@/lib/permissions";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";
import { canPerformHighPrivilegeAction } from "@/lib/security/rbac";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { getServerSharePointServices } from "@/services/sharepoint/factory";
import type { UpdateContactInput } from "@/types/contact";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const { contactId } = await params;

  try {
    const { contacts } = getServerSharePointServices();
    const contact = await contacts.getById(contactId);
    return NextResponse.json(contact);
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const { contactId } = await params;
  const body = (await request.json()) as UpdateContactInput;

  try {
    const { contacts } = getServerSharePointServices();
    const updated = await contacts.update(contactId, body);
    return NextResponse.json(updated);
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const { contactId } = await params;
  const role = getRequestRole(request);

  // FS-013: high-privilege delete — enterprise ADMIN only
  if (!canPerformHighPrivilegeAction({ role }) || !canDeleteContact(role)) {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden("Only ADMIN can delete contacts"),
    );
  }

  try {
    const { contacts } = getServerSharePointServices();
    await contacts.delete(contactId);

    const actor = resolveAuditActor(request, role);
    await logAuditEvent({
      ...actor,
      action: "CONTACT_DELETED",
      entityType: "Contact",
      entityId: contactId,
      ipAddress: clientIpFromRequest(request),
      metadata: { privileged: true },
    });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
