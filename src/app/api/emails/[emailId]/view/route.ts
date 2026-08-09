import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { readEmailMessageView } from "@/lib/email-message-view";

/**
 * Preview text + Outlook webLink for a synced EmailMessageRecord.
 * GET /api/emails/[emailId]/view?enrich=1
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ emailId: string }> },
) {
  const { emailId } = await params;
  await resolveRequestRole(request);

  const enrichParam = new URL(request.url).searchParams.get("enrich");
  const enrich = enrichParam !== "0" && enrichParam !== "false";

  try {
    const view = await readEmailMessageView(emailId, { enrich });
    if (!view) {
      return NextResponse.json({ error: "Email not found" }, { status: 404 });
    }
    return NextResponse.json(view);
  } catch (error) {
    console.error("[emails view GET]", error);
    return NextResponse.json(
      {
        error: "Failed to load email view",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
