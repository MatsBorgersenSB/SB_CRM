import "server-only";

import { getPrisma } from "@/lib/prisma";
import {
  resolveMarketFacts,
  type MarketFactDecision,
  type ResolvedMarketFact,
} from "@/lib/market-facts";

function isDecision(value: string): value is MarketFactDecision {
  return value === "confirmed" || value === "dismissed";
}

export async function readMarketFacts(): Promise<ResolvedMarketFact[]> {
  const decisions: Record<string, MarketFactDecision | undefined> = {};
  try {
    const rows = await getPrisma().marketFactDecision.findMany();
    for (const row of rows) {
      if (isDecision(row.decision)) decisions[row.factId] = row.decision;
    }
  } catch (error) {
    console.warn(
      "[market-facts] decisions unavailable:",
      error instanceof Error ? error.message : error,
    );
  }
  return resolveMarketFacts(decisions);
}

export async function saveMarketFactDecision(
  factId: string,
  decision: MarketFactDecision,
): Promise<ResolvedMarketFact[]> {
  await getPrisma().marketFactDecision.upsert({
    where: { factId },
    create: { factId, decision },
    update: { decision },
  });
  return readMarketFacts();
}
