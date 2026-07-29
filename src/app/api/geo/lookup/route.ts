import { NextResponse } from "next/server";
import { lookupAddressOSM, type OsmLookupResult } from "@/lib/geo/nominatim";

const TTL_MS = 60_000;
const cache = new Map<string, { expiresAt: number; value: OsmLookupResult }>();

export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();

  if (!q) {
    return NextResponse.json({ error: "Missing required query parameter: q" }, { status: 400 });
  }

  const key = q.toLowerCase();
  const cached = cache.get(key);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(cached.value, {
      headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
    });
  }

  const value = await lookupAddressOSM(q);
  cache.set(key, { expiresAt: Date.now() + TTL_MS, value });

  return NextResponse.json(value, {
    headers: { "Cache-Control": "public, max-age=60, s-maxage=60" },
  });
}

