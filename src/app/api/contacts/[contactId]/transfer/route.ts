import { NextResponse } from "next/server";
import {
  executeContactTransfer,
  previewContactTransfer,
} from "@/lib/contact-lifecycle-actions";
import type { TransferContactInput } from "@/types/contact-lifecycle";

type RouteContext = { params: Promise<{ contactId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { contactId } = await context.params;

  let body: TransferContactInput & { preview?: boolean };
  try {
    body = (await request.json()) as TransferContactInput & { preview?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.targetCompanyId) {
    return NextResponse.json({ error: "targetCompanyId is required" }, { status: 400 });
  }

  try {
    if (body.preview) {
      const preview = await previewContactTransfer(contactId, body.targetCompanyId);
      return NextResponse.json({ preview });
    }

    const contact = await executeContactTransfer(contactId, body);
    return NextResponse.json({ contact });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Transfer failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
