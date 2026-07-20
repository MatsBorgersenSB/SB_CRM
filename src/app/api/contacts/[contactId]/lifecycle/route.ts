import { NextResponse } from "next/server";
import { auditContactLifecycle } from "@/lib/contact-lifecycle-actions";

type RouteContext = { params: Promise<{ contactId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const { contactId } = await context.params;
  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("company") ?? undefined;

  try {
    const audit = await auditContactLifecycle(contactId, companyId);
    return NextResponse.json(audit);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lifecycle audit failed";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}
