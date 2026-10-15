import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { importExploration } from "@/lib/smartassist/explore/import";
import { markExplorationImported } from "@/lib/smartassist/explore/run.server";
import type { ExploreImportRequest } from "@/lib/smartassist/explore/types";

export const dynamic = "force-dynamic";

/**
 * POST ExploreImportRequest & { explorationId? }
 * Creates the company and the people the user ticked. The user chose the relationship type.
 */
export async function POST(request: Request) {
  const session = await auth().catch(() => null);
  if (!session?.user && process.env.NODE_ENV !== "development") {
    return NextResponse.json({ success: false, error: "AUTH_REQUIRED" }, { status: 401 });
  }

  let body: Partial<ExploreImportRequest> & { explorationId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ success: false, error: "EXPLORATION_REQUIRED" }, { status: 400 });
  }

  if (!body.exploration || body.exploration.kind !== "company" || !body.companyType) {
    return NextResponse.json({ success: false, error: "EXPLORATION_REQUIRED" }, { status: 400 });
  }

  try {
    const result = await importExploration(
      {
        exploration: body.exploration,
        companyType: body.companyType,
        selectedPeopleIds: Array.isArray(body.selectedPeopleIds) ? body.selectedPeopleIds.map(String) : [],
        accountOwner: body.accountOwner ?? null,
      },
      { email: session?.user?.email ?? null, name: session?.user?.name ?? null },
    );
    await markExplorationImported(
      typeof body.explorationId === "string" ? body.explorationId : null,
      result.companyId,
    );
    revalidatePath("/companies");
    revalidatePath("/contacts");
    return NextResponse.json({ success: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
