/**
 * Backfill Opportunity.code (PL-####) for rows missing a public code.
 *
 * Usage: npx tsx scripts/backfill-opportunity-codes.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });

import { nextPipelineId } from "../src/lib/entity-id";
import { getPrisma } from "../src/lib/prisma";

async function main() {
  const prisma = getPrisma();

  try {
    const all = await prisma.opportunity.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { createdAt: "asc" },
    });

    const withCodes = all.filter((row) => row.code?.trim());
    let maxSeed = withCodes.map((row) => ({
      id: row.code!,
      code: row.code,
    }));

    let assigned = 0;
    for (const row of all) {
      if (row.code?.trim()) continue;
      const code = nextPipelineId(maxSeed);
      await prisma.opportunity.update({
        where: { id: row.id },
        data: { code },
      });
      maxSeed = [...maxSeed, { id: code, code }];
      assigned += 1;
      console.log(`Assigned ${code} → ${row.name} (${row.id})`);
    }

    console.log(
      `Done. Assigned ${assigned} code(s); ${withCodes.length} already had codes.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
