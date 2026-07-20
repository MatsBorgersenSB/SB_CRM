import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { canDeleteContact } from "@/lib/permissions";
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

  if (!canDeleteContact(role)) {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden("Only superusers can delete contacts"),
    );
  }

  try {
    const { contacts } = getServerSharePointServices();
    await contacts.delete(contactId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
