import { NextResponse } from "next/server";
import {
  parsePageRequest,
  sharePointErrorResponse,
} from "@/services/sharepoint/server/api-utils";
import { getServerSharePointServices } from "@/services/sharepoint/factory";

export async function GET(request: Request) {
  try {
    const { contacts } = getServerSharePointServices();
    const page = parsePageRequest(request);
    const result = await contacts.list(page);

    if (page.pageSize || page.skipToken) {
      return NextResponse.json(result);
    }

    return NextResponse.json(result.items);
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
