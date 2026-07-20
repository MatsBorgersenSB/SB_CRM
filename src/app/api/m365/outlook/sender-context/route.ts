import { NextResponse } from "next/server";
import { buildOutlookSenderPrepopulation } from "@/lib/m365/outlook-add-contact";
import { m365Error } from "@/lib/m365/api-response";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.trim().toLowerCase();
  const displayName = searchParams.get("name") ?? undefined;
  const messageBody = searchParams.get("signature") ?? undefined;

  if (!email) {
    return m365Error("Provide email query parameter", 400);
  }

  try {
    const prepopulation = await buildOutlookSenderPrepopulation({
      email,
      displayName,
      messageBody: messageBody ? decodeURIComponent(messageBody) : undefined,
    });
    return NextResponse.json(prepopulation);
  } catch {
    return m365Error("Failed to resolve sender context", 500);
  }
}

export async function POST(request: Request) {
  let body: { email?: string; displayName?: string; messageBody?: string };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return m365Error("Invalid request body", 400);
  }

  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return m365Error("Email is required", 400);
  }

  try {
    const prepopulation = await buildOutlookSenderPrepopulation({
      email,
      displayName: body.displayName,
      messageBody: body.messageBody,
    });
    return NextResponse.json(prepopulation);
  } catch {
    return m365Error("Failed to resolve sender context", 500);
  }
}
