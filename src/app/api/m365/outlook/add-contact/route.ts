import { NextResponse } from "next/server";
import { addOutlookContact } from "@/lib/m365/outlook-add-contact";
import { m365Error } from "@/lib/m365/api-response";
import type { OutlookContactEnrichment } from "@/lib/m365/outlook-sender-types";

type AddContactBody = {
  email?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  role?: string;
  industry?: string;
  companyTypes?: string[];
  matchedCompanyId?: string;
  skipAutoCompanyMatch?: boolean;
  enrichment?: OutlookContactEnrichment;
};

export async function POST(request: Request) {
  let body: AddContactBody;

  try {
    body = (await request.json()) as AddContactBody;
  } catch {
    return m365Error("Invalid request body", 400);
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return m365Error("Email is required", 400);
  }

  try {
    const result = await addOutlookContact({
      email,
      firstName: body.firstName?.trim() ?? "",
      lastName: body.lastName?.trim() ?? "",
      companyName: body.companyName?.trim() ?? "",
      role: body.role?.trim(),
      industry: body.industry?.trim(),
      companyTypes: body.companyTypes,
      matchedCompanyId: body.matchedCompanyId,
      skipAutoCompanyMatch: body.skipAutoCompanyMatch,
      enrichment: body.enrichment,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create contact";
    return m365Error(message, 500);
  }
}
