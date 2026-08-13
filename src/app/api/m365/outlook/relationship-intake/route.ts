import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { m365Error } from "@/lib/m365/api-response";
import {
  approveRelationshipIntake,
  buildRelationshipIntakeProposal,
} from "@/lib/m365/relationship-intake";
import type { OutlookContactEnrichment } from "@/lib/m365/outlook-sender-types";

function revalidateRelationshipLists(contactId: string, companyId: string) {
  revalidatePath("/contacts");
  revalidatePath("/companies");
  revalidatePath(`/contacts/${contactId}`);
  revalidatePath(`/companies/${companyId}`);
}

/**
 * FS-012 Relationship Intake
 * POST { action: "propose" } → draft only
 * POST { action: "approve" } → persist after user Yes
 */
export async function POST(request: Request) {
  let body: {
    action?: string;
    email?: string;
    displayName?: string;
    messageBody?: string;
    firstName?: string;
    lastName?: string;
    companyName?: string;
    role?: string;
    industry?: string;
    companyTypes?: string[];
    matchedCompanyId?: string;
    skipAutoCompanyMatch?: boolean;
    enrichment?: OutlookContactEnrichment;
    conversationId?: string;
    opportunityId?: string | null;
    projectId?: string | null;
    message?: {
      externalMessageId?: string;
      subject?: string;
      senderEmail?: string;
      recipientEmails?: string[];
      sentAt?: string;
      bodyPreview?: string;
      webLink?: string;
    };
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return m365Error("Invalid request body", 400);
  }

  const action = body.action?.trim() || "propose";
  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return m365Error("Email is required", 400);
  }

  try {
    if (action === "propose") {
      const proposal = await buildRelationshipIntakeProposal({
        email,
        displayName: body.displayName,
        messageBody: body.messageBody,
      });
      return NextResponse.json(proposal);
    }

    if (action === "approve") {
      const result = await approveRelationshipIntake({
        email,
        firstName: body.firstName?.trim() ?? "",
        lastName: body.lastName?.trim() ?? "",
        companyName: body.companyName?.trim() ?? "",
        role: body.role?.trim() ?? "",
        industry: body.industry?.trim(),
        companyTypes: body.companyTypes,
        matchedCompanyId: body.matchedCompanyId,
        skipAutoCompanyMatch: body.skipAutoCompanyMatch,
        enrichment: body.enrichment,
        conversationId: body.conversationId,
        opportunityId: body.opportunityId,
        projectId: body.projectId,
        message: body.message,
      });
      revalidateRelationshipLists(result.contactId, result.companyId);
      return NextResponse.json(result, { status: 201 });
    }

    return m365Error("action must be propose or approve", 400);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Relationship intake failed";
    return m365Error(message, 500);
  }
}
