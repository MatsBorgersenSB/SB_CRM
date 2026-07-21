import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import type { InfluenceLevel, SentimentStance } from "@/generated/prisma";

const INFLUENCE_LEVELS: InfluenceLevel[] = ["high", "medium", "low", "unknown"];
const STANCES: SentimentStance[] = [
  "champion",
  "positive",
  "neutral",
  "blocker",
  "unknown",
];

function isInfluenceLevel(value: unknown): value is InfluenceLevel {
  return typeof value === "string" && INFLUENCE_LEVELS.includes(value as InfluenceLevel);
}

function isStance(value: unknown): value is SentimentStance {
  return typeof value === "string" && STANCES.includes(value as SentimentStance);
}

export type InfluenceProfileDto = {
  id: string;
  opportunityId: string;
  contactId: string;
  influenceLevel: InfluenceLevel;
  stance: SentimentStance;
  notes: string | null;
  contact: {
    id: string;
    fullName: string;
    firstName: string | null;
    lastName: string | null;
    jobTitle: string | null;
    email: string;
  };
};

function toDto(profile: {
  id: string;
  opportunityId: string;
  contactId: string;
  influenceLevel: InfluenceLevel;
  stance: SentimentStance;
  notes: string | null;
  contact: {
    id: string;
    fullName: string | null;
    firstName: string | null;
    lastName: string | null;
    jobTitle: string | null;
    emails: unknown;
  };
}): InfluenceProfileDto {
  const emails = Array.isArray(profile.contact.emails) ? profile.contact.emails : [];
  const primary = emails.find(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      "isPrimary" in entry &&
      (entry as { isPrimary?: boolean }).isPrimary,
  ) as { address?: string } | undefined;
  const first = emails[0] as { address?: string } | undefined;
  const email = primary?.address ?? first?.address ?? "";

  const fullName =
    profile.contact.fullName?.trim() ||
    `${profile.contact.firstName ?? ""} ${profile.contact.lastName ?? ""}`.trim() ||
    email ||
    "Unknown contact";

  return {
    id: profile.id,
    opportunityId: profile.opportunityId,
    contactId: profile.contactId,
    influenceLevel: profile.influenceLevel,
    stance: profile.stance,
    notes: profile.notes,
    contact: {
      id: profile.contact.id,
      fullName,
      firstName: profile.contact.firstName,
      lastName: profile.contact.lastName,
      jobTitle: profile.contact.jobTitle,
      email,
    },
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: opportunityId } = await params;

  try {
    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true },
    });
    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    const profiles = await prisma.stakeholderInfluenceProfile.findMany({
      where: { opportunityId },
      include: {
        contact: {
          select: {
            id: true,
            fullName: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            emails: true,
          },
        },
      },
      orderBy: [{ influenceLevel: "asc" }, { updatedAt: "desc" }],
    });

    return NextResponse.json({
      opportunityId,
      profiles: profiles.map(toDto),
    });
  } catch (error) {
    console.error("[influence GET]", error);
    return NextResponse.json({ error: "Failed to load influence profiles" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: opportunityId } = await params;
  const role = getRequestRole(request);

  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = (await request.json()) as {
      contactId?: string;
      influenceLevel?: unknown;
      stance?: unknown;
      notes?: string | null;
    };

    if (!body.contactId || typeof body.contactId !== "string") {
      return NextResponse.json({ error: "contactId is required" }, { status: 400 });
    }

    const opportunity = await prisma.opportunity.findUnique({
      where: { id: opportunityId },
      select: { id: true },
    });
    if (!opportunity) {
      return NextResponse.json({ error: "Opportunity not found" }, { status: 404 });
    }

    const contact = await prisma.contact.findUnique({
      where: { id: body.contactId },
      select: { id: true },
    });
    if (!contact) {
      return NextResponse.json({ error: "Contact not found" }, { status: 404 });
    }

    const data: {
      influenceLevel?: InfluenceLevel;
      stance?: SentimentStance;
      notes?: string | null;
    } = {};

    if (body.influenceLevel !== undefined) {
      if (!isInfluenceLevel(body.influenceLevel)) {
        return NextResponse.json({ error: "Invalid influenceLevel" }, { status: 400 });
      }
      data.influenceLevel = body.influenceLevel;
    }
    if (body.stance !== undefined) {
      if (!isStance(body.stance)) {
        return NextResponse.json({ error: "Invalid stance" }, { status: 400 });
      }
      data.stance = body.stance;
    }
    if (body.notes !== undefined) {
      data.notes = body.notes;
    }

    const profile = await prisma.stakeholderInfluenceProfile.upsert({
      where: {
        opportunityId_contactId: {
          opportunityId,
          contactId: body.contactId,
        },
      },
      create: {
        opportunityId,
        contactId: body.contactId,
        influenceLevel: data.influenceLevel ?? "unknown",
        stance: data.stance ?? "unknown",
        notes: data.notes ?? null,
      },
      update: data,
      include: {
        contact: {
          select: {
            id: true,
            fullName: true,
            firstName: true,
            lastName: true,
            jobTitle: true,
            emails: true,
          },
        },
      },
    });

    return NextResponse.json({ profile: toDto(profile) });
  } catch (error) {
    console.error("[influence PATCH]", error);
    return NextResponse.json({ error: "Failed to update influence profile" }, { status: 500 });
  }
}
