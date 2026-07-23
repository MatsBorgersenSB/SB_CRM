import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { generateEmailDraft, type EmailDraftTone } from "@/lib/ai/email-copilot";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";

/**
 * POST /api/ai/email-draft
 * Body: { context, contactName, dealStage?, tone?, companyName?, objective?, entityId? }
 */
export async function POST(request: Request) {
  const role = getRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      context?: string;
      contactName?: string;
      dealStage?: string;
      tone?: EmailDraftTone;
      companyName?: string;
      objective?: string;
      entityType?: string;
      entityId?: string;
    };

    const contactName = body.contactName?.trim();
    const context = body.context?.trim() ?? "";

    if (!contactName) {
      return NextResponse.json(
        { error: "contactName is required" },
        { status: 400 },
      );
    }

    const draft = generateEmailDraft({
      context,
      contactName,
      dealStage: body.dealStage,
      tone: body.tone,
      companyName: body.companyName,
      objective: body.objective,
    });

    const actor = resolveAuditActor(request, role);
    await logAuditEvent({
      ...actor,
      action: "AI_DRAFT_GENERATED",
      entityType: body.entityType?.trim() || "Contact",
      entityId: body.entityId?.trim() || contactName,
      ipAddress: clientIpFromRequest(request),
      metadata: {
        tone: draft.tone,
        confidenceScore: draft.confidenceScore,
        dealStage: body.dealStage ?? null,
      },
    });

    return NextResponse.json({ success: true, draft });
  } catch (error) {
    console.error("[ai/email-draft]", error);
    return NextResponse.json(
      { error: "Failed to generate email draft" },
      { status: 500 },
    );
  }
}
