import { NextResponse } from "next/server";
import { findPrismaCompanyByRouteKey } from "@/lib/data/companies";
import { withPrismaRetry } from "@/lib/prisma";

/**
 * GET /api/assistant/decision-journal?companyId=CO-1001
 * Lists Decision Journal entries for a company (and optional opportunity).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const companyId = url.searchParams.get("companyId")?.trim();
  const opportunityId = url.searchParams.get("opportunityId")?.trim();

  if (!companyId && !opportunityId) {
    return NextResponse.json(
      { error: "companyId or opportunityId is required" },
      { status: 400 },
    );
  }

  try {
    let prismaCompanyId: string | undefined;
    if (companyId) {
      const company = await findPrismaCompanyByRouteKey(companyId);
      prismaCompanyId = company?.id;
      if (!prismaCompanyId) {
        return NextResponse.json({ items: [] });
      }
    }

    const items = await withPrismaRetry((prisma) =>
      prisma.decisionJournal.findMany({
        where: {
          ...(prismaCompanyId ? { companyId: prismaCompanyId } : {}),
          ...(opportunityId ? { opportunityId } : {}),
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    );

    return NextResponse.json({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load decision journal";
    return NextResponse.json({ error: message, items: [] }, { status: 500 });
  }
}
