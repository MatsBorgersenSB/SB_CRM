import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { getActiveM365AccessToken } from "@/lib/m365-client";
import { readOutlookMessagesFromGraph } from "@/lib/m365/outlook-selected-message-graph";

/**
 * Read sender and conversation for mails the user checked in Outlook.
 * POST { items: [{ itemId, alternateItemId?, internetMessageId? }] }
 */
export async function POST(request: Request) {
  const role = await resolveRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json().catch(() => ({}))) as {
      items?: Array<{
        itemId?: string;
        alternateItemId?: string;
        internetMessageId?: string;
      }>;
    };
    const items = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
    const token = await getActiveM365AccessToken();
    if (!token) {
      return NextResponse.json({ messages: [], needsMicrosoftConsent: true });
    }
    const messages = await readOutlookMessagesFromGraph(items);
    return NextResponse.json({ messages, needsMicrosoftConsent: false });
  } catch (error) {
    console.error("[m365 outlook selected-messages POST]", error);
    return NextResponse.json(
      {
        error: "Failed to read selected mail",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
