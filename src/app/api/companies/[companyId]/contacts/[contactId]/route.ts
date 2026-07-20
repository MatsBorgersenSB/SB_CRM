import { NextResponse } from "next/server";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";
import { getServerSharePointServices } from "@/services/sharepoint/factory";
import type { EditableContactField, UpdateContactInput } from "@/types/contact";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ companyId: string; contactId: string }> },
) {
  const { contactId } = await params;
  const body = (await request.json()) as Partial<Pick<UpdateContactInput, EditableContactField>>;

  try {
    const { contacts } = getServerSharePointServices();
    const updated = await contacts.update(contactId, body);
    return NextResponse.json(updated);
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
