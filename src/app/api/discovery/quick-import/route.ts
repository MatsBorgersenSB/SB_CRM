import { NextResponse } from "next/server";
import { analyzeQuickImport } from "@/lib/discovery/quick-import";

export async function POST(request: Request) {
  let body: { text?: string; contextCompanyId?: string };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.text?.trim()) {
    return NextResponse.json({ error: "Text is required" }, { status: 400 });
  }

  try {
    const preview = await analyzeQuickImport(body.text.trim(), body.contextCompanyId);
    return NextResponse.json(preview);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
