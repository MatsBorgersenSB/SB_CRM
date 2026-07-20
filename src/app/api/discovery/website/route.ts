import { NextResponse } from "next/server";
import { discoverWebsite } from "@/lib/discovery/website-discovery";
import { readCompanies } from "@/lib/pipeline-db";

export async function POST(request: Request) {
  let body: { url?: string };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "Website URL is required" }, { status: 400 });
  }

  try {
    const companies = await readCompanies();
    const result = await discoverWebsite(url, companies);
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Website discovery failed";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
