import { NextResponse } from "next/server";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";
import { getServerSharePointServices } from "@/services/sharepoint/factory";

export async function GET() {
  try {
    const { rawMaterials } = getServerSharePointServices();
    const metrics = await rawMaterials.getMetrics();
    return NextResponse.json(metrics);
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
