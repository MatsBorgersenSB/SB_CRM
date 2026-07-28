import { NextResponse } from "next/server";
import { getPrisma, isPrismaConnectionError } from "@/lib/prisma";

/**
 * Lookup SharePoint folder metadata for a deal / opportunity title.
 * Matches Prisma opportunity by id (= dealId when synced) or by name.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const dealId = url.searchParams.get("dealId")?.trim() ?? "";
  const name = url.searchParams.get("name")?.trim() ?? "";

  if (!dealId && !name) {
    return NextResponse.json(
      { error: "dealId or name is required" },
      { status: 400 },
    );
  }

  try {
    const prisma = getPrisma();
    const opportunity = await prisma.opportunity.findFirst({
      where: {
        OR: [
          ...(dealId ? [{ id: dealId }] : []),
          ...(name
            ? [{ name: { equals: name, mode: "insensitive" as const } }]
            : []),
        ],
      },
      select: {
        id: true,
        name: true,
        sharepointFolderId: true,
        sharepointFolderUrl: true,
        sharepointFolderPath: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    if (!opportunity) {
      return NextResponse.json({
        found: false,
        sharepointFolderId: null,
        sharepointFolderUrl: null,
        sharepointFolderPath: null,
      });
    }

    return NextResponse.json({
      found: true,
      opportunityId: opportunity.id,
      name: opportunity.name,
      sharepointFolderId: opportunity.sharepointFolderId,
      sharepointFolderUrl: opportunity.sharepointFolderUrl,
      sharepointFolderPath: opportunity.sharepointFolderPath,
    });
  } catch (error) {
    if (isPrismaConnectionError(error)) {
      return NextResponse.json({
        found: false,
        sharepointFolderId: null,
        sharepointFolderUrl: null,
        sharepointFolderPath: null,
        detail: "Database unavailable",
      });
    }
    console.error("[api/opportunities/sharepoint] lookup failed", error);
    return NextResponse.json(
      {
        error: "Failed to resolve SharePoint folder",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
