import { NextResponse } from "next/server";
import {
  importDiscoveredContactForCompany,
  importWebsiteDiscovery,
  upsertCompanyFromDiscovery,
} from "@/lib/discovery/website-import";
import type { WebsiteDiscoveryResult } from "@/lib/discovery/types";
import type { SharePointPerson } from "@/types/company";

export async function POST(request: Request) {
  let body: {
    discovery?: WebsiteDiscoveryResult;
    selectedContactIds?: string[];
    phase?: "full" | "company" | "contact";
    companyId?: string;
    contactId?: string;
    accountOwner?: SharePointPerson | null;
  };

  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.discovery?.company?.name?.trim()) {
    return NextResponse.json({ error: "Discovery payload is required" }, { status: 400 });
  }

  const phase = body.phase ?? "full";

  try {
    if (phase === "company") {
      const result = await upsertCompanyFromDiscovery(body.discovery, body.accountOwner);
      return NextResponse.json(result);
    }

    if (phase === "contact") {
      if (!body.companyId || !body.contactId) {
        return NextResponse.json(
          { error: "companyId and contactId are required for contact import" },
          { status: 400 },
        );
      }

      const contact = body.discovery.contacts.find((c) => c.id === body.contactId);
      if (!contact) {
        return NextResponse.json({ error: "Contact not found in discovery" }, { status: 404 });
      }

      const result = await importDiscoveredContactForCompany(body.companyId, contact);
      return NextResponse.json(result);
    }

    const result = await importWebsiteDiscovery({
      discovery: body.discovery,
      selectedContactIds: body.selectedContactIds ?? [],
      accountOwner: body.accountOwner,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
