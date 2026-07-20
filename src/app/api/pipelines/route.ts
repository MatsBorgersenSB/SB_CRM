import { NextResponse } from "next/server";
import {
  parsePageRequest,
  sharePointErrorResponse,
} from "@/services/sharepoint/server/api-utils";
import { getServerSharePointServices } from "@/services/sharepoint/factory";

/** Legacy alias — delegates to Deals SharePoint service. */
export async function GET(request: Request) {
  try {
    const { deals } = getServerSharePointServices();
    const page = parsePageRequest(request);
    const result = await deals.list(page);

    if (page.pageSize || page.skipToken) {
      return NextResponse.json(result);
    }

    return NextResponse.json(result.items);
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
