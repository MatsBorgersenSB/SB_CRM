import { NextResponse } from "next/server";
import {
  parsePageRequest,
  sharePointErrorResponse,
} from "@/services/sharepoint/server/api-utils";
import { getServerSharePointServices } from "@/services/sharepoint/factory";
import type { CreateActivityInput } from "@/types/activity";

export async function GET(request: Request) {
  try {
    const { activities } = getServerSharePointServices();
    const page = parsePageRequest(request);
    const result = await activities.list(page);

    if (page.pageSize || page.skipToken) {
      return NextResponse.json(result);
    }

    return NextResponse.json(result.items);
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const body = (await request.json()) as CreateActivityInput;

  try {
    const { activities } = getServerSharePointServices();
    const activity = await activities.create(body);
    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
