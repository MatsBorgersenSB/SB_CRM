import { NextResponse } from "next/server";
import {
  searchEuropeanRegisters,
  type UnifiedEuropeanCompany,
} from "@/lib/integrations/company-registers";

const TTL_MS = 60_000;
const cache = new Map<string, { expiresAt: number; value: UnifiedEuropeanCompany[] }>();

/**
 * GET /api/discovery/registry?q=...&country=NO&domain=example.no
 * Pan-European business registry lookup (Brønnøysund, CVR, PRH, FR, UK, DE, EE, VIES).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim();
  const country = url.searchParams.get("country")?.trim() || undefined;
  const domain = url.searchParams.get("domain")?.trim() || undefined;

  if (!q || q.length < 2) {
    return NextResponse.json(
      { error: "Missing or too-short query parameter: q (min 2 chars)" },
      { status: 400 },
    );
  }

  const cacheKey = `${q.toLowerCase()}|${(country ?? "").toUpperCase()}|${(domain ?? "").toLowerCase()}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return NextResponse.json(
      { results: cached.value },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
    );
  }

  try {
    const results = await searchEuropeanRegisters(q, {
      countryCodeHint: country,
      domainHint: domain,
      limit: 12,
    });
    cache.set(cacheKey, { expiresAt: Date.now() + TTL_MS, value: results });
    return NextResponse.json(
      { results },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=60" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Registry search failed";
    return NextResponse.json({ error: message, results: [] }, { status: 502 });
  }
}
