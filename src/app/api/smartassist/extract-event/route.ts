import { NextResponse } from "next/server";
import { extractEvent } from "@/lib/smartassist/eventExtract";

export const dynamic = "force-dynamic";

/**
 * POST { url?: string; text?: string }
 * Reads a public event page or pasted invitation and proposes a tradeshow /
 * seminar activity. Nothing is saved here; the user confirms in the wizard.
 */
export async function POST(request: Request) {
  let body: { url?: unknown; text?: unknown };
  try {
    body = (await request.json()) as { url?: unknown; text?: unknown };
  } catch {
    return NextResponse.json({ success: false, error: "SOURCE_REQUIRED" }, { status: 400 });
  }
  const url = typeof body.url === "string" ? body.url.trim() : "";
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!url && !text) {
    return NextResponse.json({ success: false, error: "SOURCE_REQUIRED" }, { status: 400 });
  }

  try {
    const proposal = await extractEvent({ url: url || undefined, text: text || undefined });
    if (!proposal) {
      return NextResponse.json({ success: false, error: "NOTHING_FOUND" }, { status: 422 });
    }
    return NextResponse.json({ success: true, proposal });
  } catch {
    return NextResponse.json({ success: false, error: "EXTRACTION_FAILED" }, { status: 500 });
  }
}
