import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import {
  createM365DraftEmail,
  generateOutlookDeepLink,
  getAccessTokenForIntegration,
  getActiveM365AccessToken,
} from "@/lib/m365-client";

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

/**
 * POST /api/m365/draft
 * Body: { toEmail, subject, bodyHtml, opportunityId?, integrationId? }
 *
 * Active M365 integration → Graph draft + webLink
 * Otherwise → Outlook compose deepLink fallback
 */
export async function POST(request: Request) {
  const role = getRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      toEmail?: string;
      subject?: string;
      bodyHtml?: string;
      opportunityId?: string;
      integrationId?: string;
    };

    const toEmail = body.toEmail?.trim();
    const subject = body.subject?.trim();
    const bodyHtml = body.bodyHtml?.trim();

    if (!toEmail || !subject || !bodyHtml) {
      return NextResponse.json(
        { error: "toEmail, subject, and bodyHtml are required" },
        { status: 400 },
      );
    }

    let integrationId = body.integrationId?.trim() || null;
    if (integrationId) {
      const token = await getAccessTokenForIntegration(integrationId);
      if (!token) integrationId = null;
    } else {
      const active = await getActiveM365AccessToken();
      integrationId = active?.integrationId ?? null;
    }

    if (integrationId) {
      const draft = await createM365DraftEmail({
        integrationId,
        toEmail,
        subject,
        bodyHtml,
      });

      return NextResponse.json({
        success: true,
        mode: "graph_draft",
        draftId: draft.draftId,
        webLink: draft.webLink,
        opportunityId: body.opportunityId ?? null,
      });
    }

    const deepLink = generateOutlookDeepLink({
      toEmail,
      subject,
      body: htmlToPlainText(bodyHtml),
    });

    return NextResponse.json({
      success: true,
      mode: "deep_link",
      deepLink,
      opportunityId: body.opportunityId ?? null,
    });
  } catch (error) {
    console.error("[m365 draft POST]", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to create Outlook draft",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
