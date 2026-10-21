import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { linkConversationToOpportunity } from "@/lib/email-intelligence-data";
import { canCreateOpportunity } from "@/lib/permissions";

/** Link a synced Outlook conversation to an opportunity the user just confirmed. */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const role = await resolveRequestRole(request);
  if (!canCreateOpportunity(role)) {
    return NextResponse.json(
      { error: "You do not have permission to attach mail to an opportunity" },
      { status: 403 },
    );
  }

  const { conversationId } = await params;
  const body = (await request.json().catch(() => null)) as { opportunityId?: string } | null;
  const opportunityId = body?.opportunityId?.trim() ?? "";
  if (!opportunityId) {
    return NextResponse.json({ error: "opportunityId is required" }, { status: 400 });
  }

  try {
    const linked = await linkConversationToOpportunity(conversationId, opportunityId);
    if (!linked) {
      return NextResponse.json(
        { error: "Could not attach this mail. The opportunity or the thread was not found." },
        { status: 404 },
      );
    }
    return NextResponse.json(linked);
  } catch (error) {
    console.error("[mail opportunity link]", error);
    return NextResponse.json(
      { error: "Could not attach this mail to the opportunity" },
      { status: 500 },
    );
  }
}
