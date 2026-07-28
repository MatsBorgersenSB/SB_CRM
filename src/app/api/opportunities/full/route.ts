import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { authUserToAccountOwner } from "@/lib/company-owner";
import {
  canCreateCompany,
  canCreateOpportunity,
} from "@/lib/permissions";
import { getPrisma } from "@/lib/prisma";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";
import { scheduleOpportunitySharePointFolderProvision } from "@/lib/m365/provision-opportunity-folder";
import { SharePointServiceError } from "@/services/sharepoint/client/errors";
import { getServerSharePointServices } from "@/services/sharepoint/factory";
import { sharePointErrorResponse } from "@/services/sharepoint/server/api-utils";
import type { ContactListRole, CreateContactInput } from "@/types/contact";
import { CONTACT_LIST_ROLES } from "@/types/contact";
import type { CreateOpportunityInput } from "@/types/deal";
import type { CompanyRole } from "@/types/pipeline";
import { COMPANY_ROLES } from "@/types/pipeline";
import type { OpportunityStage } from "@/generated/prisma";
import type { AuthUser, UserRole } from "@/types/auth";

export type FullOpportunityNewCompany = {
  name: string;
  domain?: string;
};

export type FullOpportunityNewContact = {
  contactName?: string;
  contactEmail?: string;
  role?: string;
};

export type FullOpportunityCreateBody = {
  title?: string;
  assetName?: string;
  companyId?: string;
  companyRole?: CompanyRole;
  offeringIds?: string[];
  value?: number | null;
  salesValue?: number | null;
  expectedCloseDate?: string;
  currency?: string;
  stage?: string;
  /** When creating company on the fly (Search-or-Create). */
  newCompany?: FullOpportunityNewCompany | null;
  /** Optional primary contact for the new company. */
  newContact?: FullOpportunityNewContact | null;
};

const OPPORTUNITY_STAGES = new Set<string>([
  "prospecting",
  "qualification",
  "discovery",
  "proposal",
  "negotiation",
  "commitment",
  "closed_won",
  "closed_lost",
]);

function resolveStage(raw: string | undefined): OpportunityStage {
  if (raw && OPPORTUNITY_STAGES.has(raw)) return raw as OpportunityStage;
  return "prospecting";
}

function splitContactName(raw: string): { firstName: string; lastName: string } {
  const parts = raw.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function resolveContactListRole(
  role: string | undefined,
): { listRole: ContactListRole; jobTitle: string } {
  const trimmed = role?.trim() || "Decision Maker";
  if (trimmed === "Decision Maker") {
    return { listRole: "Executive Sponsor", jobTitle: "Decision Maker" };
  }
  if ((CONTACT_LIST_ROLES as string[]).includes(trimmed)) {
    return { listRole: trimmed as ContactListRole, jobTitle: trimmed };
  }
  return { listRole: "Executive Sponsor", jobTitle: trimmed };
}

function actorAsAuthUser(
  actor: ReturnType<typeof resolveAuditActor>,
  role: UserRole,
): AuthUser {
  const numericId = Number(actor.userId);
  return {
    id: Number.isFinite(numericId) ? numericId : 0,
    displayName: actor.userName || actor.userEmail || "SmartCRM User",
    role,
  };
}

/**
 * Composite create: optional new company + optional contact + opportunity (portfolio)
 * + Prisma registry row + async SharePoint document folder.
 */
export async function POST(request: Request) {
  const role = getRequestRole(request);
  if (!canCreateOpportunity(role)) {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden("Insufficient role to create opportunities"),
    );
  }

  let body: FullOpportunityCreateBody;
  try {
    body = (await request.json()) as FullOpportunityCreateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const title = (body.title ?? body.assetName ?? "").trim();
  const companyRole = body.companyRole;
  const offeringIds = Array.isArray(body.offeringIds) ? body.offeringIds : [];
  const newCompanyName = body.newCompany?.name?.trim() ?? "";
  const creatingCompany = Boolean(newCompanyName);
  const existingCompanyId = (body.companyId ?? "").trim();

  if (!title) {
    return NextResponse.json({ error: "title (or assetName) is required" }, { status: 400 });
  }
  if (!companyRole || !COMPANY_ROLES.includes(companyRole)) {
    return NextResponse.json({ error: "companyRole is required" }, { status: 400 });
  }
  if (offeringIds.length === 0) {
    return NextResponse.json(
      { error: "Select at least one Standard Bio offering" },
      { status: 400 },
    );
  }
  if (!creatingCompany && !existingCompanyId) {
    return NextResponse.json(
      { error: "companyId or newCompany.name is required" },
      { status: 400 },
    );
  }
  if (creatingCompany && !canCreateCompany(role)) {
    return sharePointErrorResponse(
      SharePointServiceError.forbidden("Insufficient role to create companies"),
    );
  }

  const actor = resolveAuditActor(request, role);
  const salesValue =
    typeof body.salesValue === "number"
      ? body.salesValue
      : typeof body.value === "number"
        ? body.value
        : undefined;

  try {
    const { companies, contacts, deals } = getServerSharePointServices();
    let companyId = existingCompanyId;
    let companyName = "";
    let createdCompany = null as Awaited<ReturnType<typeof companies.create>> | null;
    let createdContact = null as Awaited<ReturnType<typeof contacts.create>> | null;

    if (creatingCompany) {
      createdCompany = await companies.create({
        Title: newCompanyName,
        Industry: "Polymer Processing",
        Status: "Prospecting",
        CompanyTypes: ["Prospect"],
        City: "TBD",
        Domain: body.newCompany?.domain?.trim() ?? "",
        Phone: "",
        AccountOwner: authUserToAccountOwner(actorAsAuthUser(actor, role)),
      });
      companyId = createdCompany.CompanyID;
      companyName = createdCompany.Title;

      await logAuditEvent({
        ...actor,
        action: "COMPANY_CREATED",
        entityType: "Company",
        entityId: createdCompany.CompanyID,
        ipAddress: clientIpFromRequest(request),
        metadata: { title: createdCompany.Title },
      });

      const contactName = body.newContact?.contactName?.trim() ?? "";
      const contactEmail = body.newContact?.contactEmail?.trim() ?? "";
      if (contactName || contactEmail) {
        const { firstName, lastName } = splitContactName(
          contactName || contactEmail.split("@")[0] || "Contact",
        );
        const { listRole, jobTitle } = resolveContactListRole(body.newContact?.role);
        const contactInput: CreateContactInput = {
          FirstName: firstName || "Unknown",
          LastName: lastName || "Contact",
          JobTitle: jobTitle,
          Role: listRole,
          Email: contactEmail,
          Phone: "",
          Mobile: "",
          LinkedInURL: "",
          Status: "Prospecting",
          RelationshipLevel: "Operational",
          Company: { CompanyID: companyId },
        };
        createdContact = await contacts.create(contactInput);
        await logAuditEvent({
          ...actor,
          action: "CONTACT_CREATED",
          entityType: "Contact",
          entityId: createdContact.ContactID,
          ipAddress: clientIpFromRequest(request),
          metadata: {
            companyId,
            email: createdContact.Email || null,
          },
        });
      }
    } else {
      const existing = await companies.getById(companyId);
      companyName = existing.Title;
    }

    const dealInput: CreateOpportunityInput = {
      companyId,
      assetName: title,
      companyRole,
      offeringIds,
      ...(salesValue !== undefined ? { salesValue } : {}),
      ...(body.expectedCloseDate?.trim()
        ? { expectedCloseDate: body.expectedCloseDate.trim() }
        : {}),
      ...(body.currency ? { currency: body.currency as CreateOpportunityInput["currency"] } : {}),
    };

    const deal = await deals.create(dealInput);

    await logAuditEvent({
      ...actor,
      action: "DEAL_CREATED",
      entityType: "Deal",
      entityId: deal.id,
      ipAddress: clientIpFromRequest(request),
      metadata: {
        assetName: deal.assetName,
        companyId,
        createdCompanyOnTheFly: creatingCompany,
      },
    });

    // Best-effort Prisma registry + SharePoint document folder
    let opportunity = null as Awaited<
      ReturnType<ReturnType<typeof getPrisma>["opportunity"]["create"]>
    > | null;
    try {
      const prisma = getPrisma();
      let prismaCompanyId: string | null = null;
      const prismaCompany = await prisma.company.findFirst({
        where: {
          OR: [
            { id: companyId },
            { name: { equals: companyName, mode: "insensitive" } },
          ],
        },
        select: { id: true, name: true },
      });

      if (prismaCompany) {
        prismaCompanyId = prismaCompany.id;
        companyName = prismaCompany.name || companyName;
      } else if (creatingCompany) {
        const createdPrismaCompany = await prisma.company.create({
          data: {
            id: companyId,
            name: companyName,
            website: body.newCompany?.domain?.trim() || null,
            status: "active",
            types: ["prospect"],
            city: "TBD",
            ownerId: String(actor.userId),
          },
        });
        prismaCompanyId = createdPrismaCompany.id;
      }

      if (prismaCompanyId) {
        opportunity = await prisma.opportunity.create({
          data: {
            name: title,
            companyId: prismaCompanyId,
            ownerId: String(actor.userId || "system"),
            value: salesValue ?? null,
            stage: resolveStage(body.stage),
            currency: body.currency?.trim() || "EUR",
          },
        });

        scheduleOpportunitySharePointFolderProvision({
          opportunityId: opportunity.id,
          companyName,
          opportunityTitle: title,
        });
      }
    } catch (registryError) {
      console.warn(
        "[api/opportunities/full] Prisma registry sync skipped:",
        registryError,
      );
    }

    return NextResponse.json(
      {
        success: true,
        deal,
        company: createdCompany,
        contact: createdContact,
        opportunity,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[api/opportunities/full] create failed", error);
    return sharePointErrorResponse(error);
  }
}
