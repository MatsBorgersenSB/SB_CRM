import { NextResponse } from "next/server";
import type { SharePointPerson } from "@/types/company";
import { importQuickImport, type QuickImportPreview } from "@/lib/discovery/quick-import";

export async function POST(request: Request) {
  let body: { preview?: QuickImportPreview; accountOwner?: SharePointPerson | null };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.preview) {
    return NextResponse.json({ error: "Preview payload is required" }, { status: 400 });
  }

  try {
    const result = await importQuickImport(body.preview, {
      accountOwner: body.accountOwner,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
