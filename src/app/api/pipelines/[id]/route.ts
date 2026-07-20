import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { assertPipelinePatchAllowed } from "@/lib/permissions";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";
import { getServerSharePointServices } from "@/services/sharepoint/factory";
import type { UpdateDealInput } from "@/types/deal";

/** Legacy alias — delegates to Deals SharePoint service. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as UpdateDealInput;
  const role = getRequestRole(request);

  try {
    assertPipelinePatchAllowed(role, body);
    const { deals } = getServerSharePointServices();
    const updated = await deals.update(id, body);

    return NextResponse.json({
      ...updated,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
