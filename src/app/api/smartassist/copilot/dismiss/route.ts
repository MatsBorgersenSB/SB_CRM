import { NextResponse } from "next/server";
import {
  COPILOT_DISMISS_NOTE_MIN,
  listCoPilotDismissalKeys,
  recordCoPilotDismissal,
} from "@/lib/smartassist-copilot-dismissals";
import {
  deriveLearningSuppressKeys,
  listLearnedCoPilotSuppressKeys,
} from "@/lib/smartassist-copilot-learning";

/**
 * GET — list durable Co-Pilot dismissal keys (+ learned policy keys) for the user.
 * Query: ?userEmail=
 */
export async function GET(request: Request) {
  const userEmail = new URL(request.url).searchParams.get("userEmail");
  try {
    const keys = await listLearnedCoPilotSuppressKeys(userEmail);
    return NextResponse.json({ keys });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not load dismissals.";
    // Fallback to raw keys if learning query fails
    try {
      const keys = await listCoPilotDismissalKeys(userEmail);
      return NextResponse.json({ keys, error: message });
    } catch {
      return NextResponse.json({ error: message, keys: [] as string[] }, { status: 500 });
    }
  }
}

/**
 * POST — dismiss a Co-Pilot recommendation with a required short note.
 * Body: { suggestionKey, note, proposalId?, companyId?, actionKind?, userEmail?, userDisplayName? }
 */
export async function POST(request: Request) {
  let body: {
    suggestionKey?: string;
    note?: string;
    proposalId?: string;
    companyId?: string;
    actionKind?: string;
    userEmail?: string;
    userDisplayName?: string;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const suggestionKey = body.suggestionKey?.trim();
  const note = body.note?.trim() ?? "";

  if (!suggestionKey) {
    return NextResponse.json(
      { error: "A suggestion key is required." },
      { status: 400 },
    );
  }

  if (note.length < COPILOT_DISMISS_NOTE_MIN) {
    return NextResponse.json(
      {
        error: `Write a short note explaining why (at least ${COPILOT_DISMISS_NOTE_MIN} characters).`,
      },
      { status: 400 },
    );
  }

  try {
    const record = await recordCoPilotDismissal({
      suggestionKey,
      note,
      proposalId: body.proposalId,
      companyId: body.companyId,
      actionKind: body.actionKind,
      userEmail: body.userEmail,
      userDisplayName: body.userDisplayName,
    });

    const learnedKeys = deriveLearningSuppressKeys({
      suggestionKey: record.suggestionKey,
      note: record.note,
      companyId: record.companyId,
      actionKind: record.actionKind,
    });

    return NextResponse.json({ ok: true, record, learnedKeys });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not save dismissal.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
