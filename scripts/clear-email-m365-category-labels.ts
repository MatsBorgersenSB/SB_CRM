/**
 * Optional cleanup helper. Prefer deploying the intentional-only category
 * policy — mail sync clears legacy DB labels and scrubs Outlook pollution.
 *
 * Usage:
 *   npx tsx scripts/clear-email-m365-category-labels.ts
 *   npx tsx scripts/clear-email-m365-category-labels.ts --strip-outlook
 */
import { config } from "dotenv";

config({ path: ".env.local" });
config({ path: ".env" });

import { getPrisma } from "../src/lib/prisma";
import {
  getActiveM365AccessToken,
  stripSmartCrmCategories,
} from "../src/lib/m365-client";

async function main() {
  const stripOutlook = process.argv.includes("--strip-outlook");
  const prisma = getPrisma();

  const result = await prisma.emailMessageRecord.updateMany({
    where: { m365CategoryName: { not: null } },
    data: { m365CategoryName: null },
  });
  console.log(`Cleared m365CategoryName on ${result.count} email records.`);

  if (!stripOutlook) {
    console.log("Skip Outlook strip (pass --strip-outlook to remove tags in mailbox).");
    return;
  }

  const token = await getActiveM365AccessToken();
  if (!token) {
    console.warn("No active M365 token — cannot strip Outlook categories.");
    return;
  }

  const messages = await prisma.emailMessageRecord.findMany({
    select: { externalMessageId: true },
    orderBy: { sentAt: "desc" },
    take: 2000,
  });

  let stripped = 0;
  let failed = 0;
  for (const message of messages) {
    try {
      const changed = await stripSmartCrmCategories(
        token.accessToken,
        message.externalMessageId,
      );
      if (changed) stripped += 1;
    } catch {
      failed += 1;
    }
  }
  console.log(
    `Outlook strip attempted on ${messages.length} synced messages: ${stripped} updated, ${failed} failed.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await getPrisma().$disconnect();
  });
