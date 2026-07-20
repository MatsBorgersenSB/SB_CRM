import { NextResponse } from "next/server";
import { executeContactMerge } from "@/lib/contact-lifecycle-actions";

type RouteContext = { params: Promise<{ contactId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { contactId } = await context.params;

  let body: { secondaryContactId?: string };
  try {
    body = (await request.json()) as { secondaryContactId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.secondaryContactId) {
    return NextResponse.json({ error: "secondaryContactId is required" }, { status: 400 });
  }

  if (body.secondaryContactId === contactId) {
    return NextResponse.json({ error: "Cannot merge a contact with itself" }, { status: 400 });
  }

  try {
    const contact = await executeContactMerge(contactId, body.secondaryContactId);
    return NextResponse.json({ contact });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Merge failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
