import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { canCreateOpportunity } from "@/lib/permissions";
import { getPrisma, isPrismaConnectionError } from "@/lib/prisma";
import { provisionOpportunitySharePointFolder } from "@/lib/m365/provision-opportunity-folder";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";

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

type ProvisionBody = {
  dealId?: string;
  companyName?: string;
  opportunityTitle?: string;
};

/**
 * On-demand SharePoint folder create/link for an opportunity.
 * Prefer automatic provision on create; this is the user retry path.
 */
export async function POST(request: Request) {
  const role = getRequestRole(request);
  if (!canCreateOpportunity(role)) {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden("Insufficient role to provision SharePoint folder"),
    );
  }

  try {
    const body = (await request.json().catch(() => ({}))) as ProvisionBody;
    const dealId = body.dealId?.trim() ?? "";
    if (!dealId) {
      return NextResponse.json({ error: "dealId is required" }, { status: 400 });
    }

    const prisma = getPrisma();
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: dealId },
      select: {
        id: true,
        name: true,
        sharepointFolderUrl: true,
        sharepointFolderId: true,
        sharepointFolderPath: true,
        company: { select: { name: true } },
      },
    });

    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    if (opportunity.sharepointFolderUrl?.trim()) {
      return NextResponse.json({
        alreadyLinked: true,
        opportunityId: opportunity.id,
        sharepointFolderId: opportunity.sharepointFolderId,
        sharepointFolderUrl: opportunity.sharepointFolderUrl,
        sharepointFolderPath: opportunity.sharepointFolderPath,
      });
    }

    const companyName =
      body.companyName?.trim() || opportunity.company?.name || "General Clients";
    const opportunityTitle =
      body.opportunityTitle?.trim() || opportunity.name;

    const result = await provisionOpportunitySharePointFolder({
      opportunityId: opportunity.id,
      companyName,
      opportunityTitle,
    });

    return NextResponse.json({
      created: true,
      opportunityId: result.opportunityId,
      sharepointFolderId: result.folder.folderId,
      sharepointFolderUrl: result.folder.webUrl,
      sharepointFolderPath: result.folder.path,
    });
  } catch (error) {
    console.error("[api/opportunities/sharepoint] provision failed", error);
    return NextResponse.json(
      {
        error: "Failed to create SharePoint folder",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 502 },
    );
  }
}
