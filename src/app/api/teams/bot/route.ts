import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type BotActivity = {
  type?: string;
  name?: string;
  value?: {
    messagePayload?: {
      id?: string;
      linkToMessage?: string;
      from?: { user?: { displayName?: string; userPrincipalName?: string; email?: string } };
      body?: { content?: string };
    };
    commandId?: string;
  };
  conversation?: { id?: string };
  from?: { aadObjectId?: string; name?: string };
};

/**
 * Minimal Teams bot endpoint for FS-018 message-extension task modules.
 * Opens Assign Message or Post-meeting hosts — no conversational bot.
 */
export async function POST(request: Request) {
  let activity: BotActivity;
  try {
    activity = (await request.json()) as BotActivity;
  } catch {
    return NextResponse.json({ error: "Invalid activity" }, { status: 400 });
  }

  const origin = new URL(request.url).origin;

  if (activity.type === "invoke") {
    const commandId = activity.value?.commandId || activity.name || "";
    const message = activity.value?.messagePayload;
    const email =
      message?.from?.user?.email ||
      message?.from?.user?.userPrincipalName ||
      "";
    const conversationId = activity.conversation?.id || message?.id || "";
    const messageId = message?.id || conversationId;

    const isPostMeeting =
      commandId.includes("postMeeting") || commandId.includes("post-meeting");

    const params = new URLSearchParams();
    if (email) params.set("email", email.toLowerCase());
    if (conversationId) params.set("conversationId", conversationId);
    if (messageId) params.set("messageId", messageId);

    const path = isPostMeeting ? "/teams/post-meeting" : "/teams/assign-message";
    const url = `${origin}${path}${params.toString() ? `?${params}` : ""}`;

    return NextResponse.json({
      task: {
        type: "continue",
        value: {
          title: isPostMeeting ? "Post-meeting notes" : "Assign to SmartCRM",
          height: "large",
          width: "medium",
          url,
          fallbackUrl: url,
        },
      },
    });
  }

  if (activity.type === "conversationUpdate" || activity.type === "installationUpdate") {
    return new NextResponse(null, { status: 200 });
  }

  return NextResponse.json({ type: "message", text: "SmartCRM is ready." });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "smartcrm-teams-bot",
    purpose: "FS-018 message extension task modules",
  });
}
