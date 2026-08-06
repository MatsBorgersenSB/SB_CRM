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
import { checkContactDuplicate } from "@/lib/validation/deduplication";
import type { CreateContactInput } from "@/types/contact";

type CreateContactBody = CreateContactInput & {
  forceCreateDistinct?: boolean;
};

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
  let body: CreateContactBody;
  try {
    body = (await request.json()) as CreateContactBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const firstName = body.FirstName?.trim() ?? "";
  const lastName = body.LastName?.trim() ?? "";
  const email = body.Email?.trim() ?? "";

  try {
    const dedupe = await checkContactDuplicate({
      firstName,
      lastName,
      email,
      companyId,
    });

    if (dedupe.status === "EXACT_EMAIL_EXISTS") {
      return NextResponse.json(
        {
          error: `A contact with email "${email}" already exists.`,
          status: dedupe.status,
          existingContact: dedupe.existingContact,
        },
        { status: 409 },
      );
    }

    if (dedupe.status === "NAME_SIMILARITY_MATCH" && !body.forceCreateDistinct) {
      return NextResponse.json(
        {
          error: "Potential duplicate contact found. Confirm how to proceed.",
          status: dedupe.status,
          existingContacts: dedupe.existingContacts,
        },
        { status: 409 },
      );
    }

    const { forceCreateDistinct: _force, ...input } = body;
    const { contacts } = getServerSharePointServices();
    const contact = await contacts.create({
      ...input,
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
        forceCreateDistinct: Boolean(body.forceCreateDistinct),
      },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
