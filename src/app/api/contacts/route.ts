import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import {
  parsePageRequest,
  sharePointErrorResponse,
} from "@/services/sharepoint/server/api-utils";
import { getServerSharePointServices } from "@/services/sharepoint/factory";
import { checkContactDuplicate } from "@/lib/validation/deduplication";
import type { CreateContactInput } from "@/types/contact";

export async function GET(request: Request) {
  try {
    const { contacts } = getServerSharePointServices();
    const page = parsePageRequest(request);
    const result = await contacts.list(page);

    if (page.pageSize || page.skipToken) {
      return NextResponse.json(result);
    }

    return NextResponse.json(result.items);
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}

type CreateContactBody = CreateContactInput & {
  companyId?: string;
  /** Bypass soft name match after user confirms “Create as Distinct Person”. */
  forceCreateDistinct?: boolean;
};

/**
 * POST /api/contacts
 * Body: CreateContactInput + companyId + optional forceCreateDistinct
 */
export async function POST(request: Request) {
  const role = getRequestRole(request);
  if (role === "client_lead") {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden("Insufficient role to create contacts"),
    );
  }

  let body: CreateContactBody;
  try {
    body = (await request.json()) as CreateContactBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const companyId =
    body.companyId?.trim() ||
    (body.Company && "CompanyID" in body.Company ? body.Company.CompanyID : "") ||
    "";

  if (!companyId) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  const firstName = body.FirstName?.trim() ?? "";
  const lastName = body.LastName?.trim() ?? "";
  const email = body.Email?.trim() ?? "";

  if (!firstName || !lastName || !email) {
    return NextResponse.json(
      { error: "FirstName, LastName, and Email are required" },
      { status: 400 },
    );
  }

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

    const { contacts } = getServerSharePointServices();
    const { forceCreateDistinct: _force, companyId: _companyId, ...input } = body;
    const contact = await contacts.create({
      ...input,
      FirstName: firstName,
      LastName: lastName,
      Email: email,
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
