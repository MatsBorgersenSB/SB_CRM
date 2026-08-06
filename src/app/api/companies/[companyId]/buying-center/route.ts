import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  buyingCenterRoleToStorage,
  clampRelationshipScore,
  getCompanyBuyingCenter,
  normalizeBuyingCenterRole,
} from "@/lib/assistant/buying-center";
import { updateRegistryContact } from "@/lib/contact-registry";
import { findPrismaCompanyByRouteKey } from "@/lib/data/companies";
import { findPrismaContactByIdOrEmail } from "@/lib/resolve-contact-route";
import type { BuyingRole, UpdateContactInput } from "@/types/contact";

type RouteContext = {
  params: Promise<{ companyId: string }>;
};

type PatchBody = {
  contactId?: string;
  buyingRole?: string | null;
  relationshipScore?: number | null;
};

/**
 * GET /api/companies/[companyId]/buying-center
 * Returns buying-center matrix + coverage analysis.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const key = companyId?.trim();
  if (!key) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  try {
    const buyingCenter = await getCompanyBuyingCenter(key);
    if (!buyingCenter) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }
    return NextResponse.json(buyingCenter);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load buying center";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * PATCH /api/companies/[companyId]/buying-center
 * Body: { contactId, buyingRole?, relationshipScore? }
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { companyId } = await context.params;
  const key = companyId?.trim();
  if (!key) {
    return NextResponse.json({ error: "companyId is required" }, { status: 400 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const contactId = body.contactId?.trim();
  if (!contactId) {
    return NextResponse.json({ error: "contactId is required" }, { status: 400 });
  }

  if (body.buyingRole === undefined && body.relationshipScore === undefined) {
    return NextResponse.json(
      { error: "buyingRole or relationshipScore is required" },
      { status: 400 },
    );
  }

  try {
    const company = await findPrismaCompanyByRouteKey(key);
    if (!company) {
      return NextResponse.json({ error: "Company not found" }, { status: 404 });
    }

    const contact = await findPrismaContactByIdOrEmail(contactId);
    if (!contact || contact.companyId !== company.id) {
      return NextResponse.json(
        { error: "Contact not found on this company" },
        { status: 404 },
      );
    }

    const patch: UpdateContactInput = {};

    if (body.buyingRole !== undefined) {
      const code = normalizeBuyingCenterRole(
        body.buyingRole === null || body.buyingRole === ""
          ? "UNASSIGNED"
          : body.buyingRole,
      );
      // Empty string → null in updateRegistryContact
      patch.buyingRole = (buyingCenterRoleToStorage(code) ??
        ("" as unknown as BuyingRole)) as BuyingRole;
    }

    if (body.relationshipScore !== undefined) {
      patch.relationshipScore =
        body.relationshipScore === null
          ? (null as unknown as number)
          : (clampRelationshipScore(body.relationshipScore) ?? undefined);
    }

    await updateRegistryContact(contact.id, patch);

    revalidatePath(`/companies/${encodeURIComponent(key)}`);
    revalidatePath("/contacts");

    const buyingCenter = await getCompanyBuyingCenter(key);
    return NextResponse.json({
      ok: true,
      buyingCenter,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update buying center";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
