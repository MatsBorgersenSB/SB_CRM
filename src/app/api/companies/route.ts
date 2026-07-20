import { NextResponse } from "next/server";
import {
  parsePageRequest,
  sharePointErrorResponse,
} from "@/services/sharepoint/server/api-utils";
import { getServerSharePointServices } from "@/services/sharepoint/factory";
import type { NewCompanyInput } from "@/lib/entity-id";

export async function GET(request: Request) {
  try {
    const { companies } = getServerSharePointServices();
    const page = parsePageRequest(request);
    const result = await companies.list(page);

    if (page.pageSize || page.skipToken) {
      return NextResponse.json(result);
    }

    return NextResponse.json(result.items);
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as NewCompanyInput;

  try {
    const { companies } = getServerSharePointServices();
    const company = await companies.create(body);
    return NextResponse.json(company, { status: 201 });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
