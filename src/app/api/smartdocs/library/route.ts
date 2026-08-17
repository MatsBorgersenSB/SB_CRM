import { NextResponse } from "next/server";
import { readLiveSmartDocsLibrary } from "@/lib/prisma-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const library = await readLiveSmartDocsLibrary();
  return NextResponse.json({ library });
}
