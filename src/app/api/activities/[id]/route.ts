import { NextResponse } from "next/server";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";
import { getServerSharePointServices } from "@/services/sharepoint/factory";
import type { UpdateActivityInput } from "@/types/activity";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const { activities } = getServerSharePointServices();
    const activity = await activities.getById(id);
    return NextResponse.json(activity);
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = (await request.json()) as UpdateActivityInput;

  try {
    const { activities } = getServerSharePointServices();
    const updated = await activities.update(id, body);
    return NextResponse.json(updated);
  } catch (error) {
    return sharePointErrorResponse(error);
  }
}
