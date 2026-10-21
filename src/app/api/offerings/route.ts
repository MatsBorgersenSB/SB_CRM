import { NextResponse } from "next/server";
import { offeringFromCustomId } from "@/lib/custom-offering";
import { withPrismaRetry } from "@/lib/prisma";

/** Offerings people have added, recovered from opportunities that already use them. */
export async function GET() {
  try {
    const rows = await withPrismaRetry((prisma) =>
      prisma.$queryRaw<{ id: string }[]>`
        SELECT DISTINCT offering AS id
        FROM opportunity_registry, unnest("offeringIds") AS offering
        WHERE offering LIKE 'custom:%'
      `,
    );
    const offerings = rows.flatMap((row) => {
      const offering = offeringFromCustomId(row.id);
      if (!offering) return [];
      return [{ id: offering.id, name: offering.name, category: offering.category }];
    });
    offerings.sort((a, b) => a.name.localeCompare(b.name));
    return NextResponse.json({ offerings });
  } catch (error) {
    console.error("[offerings] Could not list custom offerings", error);
    return NextResponse.json({ offerings: [] });
  }
}
