import { NextResponse } from "next/server";
import { resolveRequestRole } from "@/lib/api-auth";
import { canUploadSmartDocs } from "@/lib/permissions";
import { MARKET_FACTS } from "@/lib/market-facts";
import { readMarketFacts, saveMarketFactDecision } from "@/lib/market-facts-data";

export async function GET() {
  const facts = await readMarketFacts();
  return NextResponse.json({ facts });
}

export async function POST(request: Request) {
  const role = await resolveRequestRole(request);
  if (!canUploadSmartDocs(role) && role !== "admin") {
    return NextResponse.json(
      { error: "You cannot confirm market facts with this role" },
      { status: 403 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    factId?: unknown;
    decision?: unknown;
  } | null;
  const factId = typeof body?.factId === "string" ? body.factId.trim() : "";
  const decision = body?.decision === "confirmed" || body?.decision === "dismissed" ? body.decision : null;
  if (!factId || !decision || !MARKET_FACTS.some((fact) => fact.id === factId)) {
    return NextResponse.json(
      { error: "factId and decision (confirmed or dismissed) are required" },
      { status: 400 },
    );
  }

  try {
    const facts = await saveMarketFactDecision(factId, decision);
    return NextResponse.json({ facts });
  } catch (error) {
    console.warn(
      "[market-facts] save failed:",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json({ error: "Could not save market fact" }, { status: 500 });
  }
}
