import { NextResponse } from "next/server";
import { executeContactArchive } from "@/lib/contact-lifecycle-actions";
import type { EmploymentStatus } from "@/types/contact-lifecycle";

type RouteContext = { params: Promise<{ contactId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { contactId } = await context.params;

  let body: { archived?: boolean; employmentStatus?: EmploymentStatus };
  try {
    body = (await request.json()) as { archived?: boolean; employmentStatus?: EmploymentStatus };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.archived === undefined) {
    return NextResponse.json({ error: "archived is required" }, { status: 400 });
  }

  try {
    const contact = await executeContactArchive(
      contactId,
      body.archived,
      body.employmentStatus,
    );
    return NextResponse.json({ contact });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Archive failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
