import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { canUploadSmartDocs } from "@/lib/permissions";
import {
  extractSourceFindingPreview,
  isPublicHttpUrl,
} from "@/lib/source-findings";

const FETCH_MS = 8000;
const MAX_BYTES = 750_000;

export async function POST(request: Request) {
  const role = await resolveRequestRole(request);
  if (!canUploadSmartDocs(role) && role !== "admin") {
    return NextResponse.json(
      { error: "You cannot add findings with this role" },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  if (!isPublicHttpUrl(url)) {
    return NextResponse.json(
      { error: "Paste a public http(s) URL — not an internal address" },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_MS),
      headers: {
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
        "User-Agent": "SmartCRM-findings/1.0",
      },
    });
    if (!response.ok) {
      return NextResponse.json({
        title: hostnameOf(url),
        claims: fallbackClaims(
          `The page returned ${response.status}. The link is saved — add what you learned next to it.`,
        ),
      });
    }

    const buffer = await response.arrayBuffer();
    const bytes = buffer.byteLength > MAX_BYTES ? buffer.slice(0, MAX_BYTES) : buffer;
    const html = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    const preview = extractSourceFindingPreview(html, url);
    return NextResponse.json(preview);
  } catch (error) {
    console.warn(
      "[findings] read failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({
      title: hostnameOf(url),
      claims: fallbackClaims(
        "SmartAssist could not read the page. The link will still be saved — write what you learned.",
      ),
    });
  }
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Public source";
  }
}

function fallbackClaims(statement: string) {
  return [
    {
      id: "attached",
      statement,
      impact: "A linked source is only useful once someone confirms what it means for this record.",
    },
  ];
}
