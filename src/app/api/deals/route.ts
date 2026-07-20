import { NextResponse } from "next/server";
import {
  parsePageRequest,
  sharePointErrorResponse,
} from "@/services/sharepoint/server/api-utils";
import { getServerSharePointServices } from "@/services/sharepoint/factory";
import type { CreateDealInput, CreateOpportunityInput } from "@/types/deal";

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

export async function POST(request: Request) {
  try {
    const { deals } = getServerSharePointServices();
    const body = (await request.json()) as CreateDealInput | CreateOpportunityInput;
    const created = await deals.create(body);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
