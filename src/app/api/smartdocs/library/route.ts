import { NextResponse } from "next/server";
import { readSmartDocsLibrary } from "@/lib/pipeline-db";

export async function GET() {
  const library = await readSmartDocsLibrary();
  return NextResponse.json({ library });
}
