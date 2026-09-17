import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { searchLiveContacts } from "@/lib/contact-search";

/**
 * GET /api/contacts/search?q=  — Contact Registry hits for Outlook assign / pickers.
 */
export async function GET(request: Request) {
  const role = getRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() || "";
  if (query.length < 2) {
    return NextResponse.json({ contacts: [] });
  }

  try {
    const contacts = await searchLiveContacts(query);
    return NextResponse.json({ contacts });
  } catch (error) {
    console.error("[contacts search]", error);
    return NextResponse.json(
      {
        error: "Could not search contacts",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
