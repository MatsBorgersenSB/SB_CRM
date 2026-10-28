import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import {
  clearConversationHandled,
  markConversationHandled,
} from "@/lib/email-intelligence-data";

type Params = { params: Promise<{ conversationId: string }> };

function failure(label: string, error: unknown) {
  console.error(label, error);
  return NextResponse.json(
    {
      error: "Could not update this conversation. If this keeps happening, run npm run db:migrate.",
      detail: error instanceof Error ? error.message : "Unknown error",
    },
    { status: 500 },
  );
}

/** Mark a conversation "no reply needed". A newer message brings the ask back. */
export async function POST(request: Request, { params }: Params) {
  const role = await resolveRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { conversationId } = await params;
  try {
    const handledAt = await markConversationHandled(conversationId);
    return NextResponse.json({ ok: true, conversationId, handledAt });
  } catch (error) {
    return failure("[conversation handled POST]", error);
  }
}

/** Undo "no reply needed". */
export async function DELETE(request: Request, { params }: Params) {
  const role = await resolveRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { conversationId } = await params;
  try {
    await clearConversationHandled(conversationId);
    return NextResponse.json({ ok: true, conversationId });
  } catch (error) {
    return failure("[conversation handled DELETE]", error);
  }
}
