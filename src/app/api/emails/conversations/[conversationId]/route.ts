import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { purgeConversation, setConversationLinks } from "@/lib/email-intelligence-data";

function idOrNull(value: unknown): string | null | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Link / unlink a conversation to an opportunity and/or project by conversation id.
 * Used by the Mail page for threads with no contact on them.
 * Body: { opportunityId?: string | null, projectId?: string | null }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const role = await resolveRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { conversationId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    opportunityId?: string | null;
    projectId?: string | null;
  };
  const opportunityId = idOrNull(body.opportunityId);
  const projectId = idOrNull(body.projectId);
  if (opportunityId === undefined && projectId === undefined) {
    return NextResponse.json(
      { error: "opportunityId or projectId is required" },
      { status: 400 },
    );
  }

  try {
    const result = await setConversationLinks(conversationId, {
      opportunityId,
      projectId,
    });
    if (result.updated === 0) {
      return NextResponse.json(
        { error: "No matching emails to update, or related record not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, ...result, conversationId });
  } catch (error) {
    console.error("[conversation links PATCH]", error);
    return NextResponse.json(
      {
        error: "Failed to update email link",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * Remove a conversation from SmartCRM (private / irrelevant). Outlook is not changed.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const role = await resolveRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { conversationId } = await params;
  try {
    const result = await purgeConversation(conversationId);
    if (result.purged === 0) {
      return NextResponse.json({ error: "No matching emails to remove" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, conversationId, purged: result.purged });
  } catch (error) {
    console.error("[conversation purge DELETE]", error);
    return NextResponse.json(
      {
        error: "Failed to remove emails",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
