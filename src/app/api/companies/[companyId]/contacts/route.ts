import { NextResponse } from "next/server";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";
import { getServerSharePointServices } from "@/services/sharepoint/factory";
import type { CreateContactInput } from "@/types/contact";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { companyId } = await params;
  const body = (await request.json()) as CreateContactInput;

  try {
    const { contacts } = getServerSharePointServices();
    const contact = await contacts.create({
      ...body,
      Company: { CompanyID: companyId },
    });

    return NextResponse.json(contact, { status: 201 });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
