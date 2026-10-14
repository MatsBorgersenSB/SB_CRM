import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { runExplore } from "@/lib/smartassist/explore/run.server";
import { resolveUserGraphToken } from "@/lib/smartassist/session-graph-token";

export const dynamic = "force-dynamic";
/** Registers, a website crawl and Graph search in one call; give it room. */
export const maxDuration = 60;

/**
 * POST { question, websiteHint? }
 * Explores a company (or says honestly what it cannot research yet).
 * Reads only; nothing is created until the user approves an import.
 */
export async function POST(request: Request) {
  const session = await auth().catch(() => null);
  if (!session?.user && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ success: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }

  let body: { question?: unknown; websiteHint?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "QUESTION_REQUIRED" }, { status: 400 });
  }

  const question = typeof body.question === "string" ? body.question.trim().slice(0, 500) : "";
  if (!question) {
    return NextResponse.json({ success: false, error: "QUESTION_REQUIRED" }, { status: 400 });
  }
  const websiteHint =
    typeof body.websiteHint === "string" && body.websiteHint.trim() ? body.websiteHint.trim().slice(0, 300) : null;

  const graphToken = await resolveUserGraphToken(request).catch(() => null);
  const askedBy = session?.user?.email?.trim() || session?.azureOid?.trim() || "development";

  try {
    const outcome = await runExplore({ question, websiteHint, graphToken, askedBy });
    if (!outcome.ok) {
      return NextResponse.json({ success: false, error: outcome.error }, { status: 422 });
    }
    return NextResponse.json({ success: true, result: outcome.result, explorationId: outcome.explorationId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Exploration failed.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
