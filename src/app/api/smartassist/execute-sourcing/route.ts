import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { allocateNextCompanyCode } from "@/lib/data/companies";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SuggestionInput = {
  name?: unknown;
  region?: unknown;
};

const SECTOR = "Timber & Forestry";
const SUPPLIER_TYPE = "Supplier / Vendor";

function parseSuggestions(value: unknown): Array<{ name: string; region: string }> {
  if (!Array.isArray(value)) return [];
  const suggestions: Array<{ name: string; region: string }> = [];
  for (const row of value) {
    if (!row || typeof row !== "object") continue;
    const record = row as SuggestionInput;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    const region = typeof record.region === "string" ? record.region.trim() : "";
    if (name.length < 2) continue;
    suggestions.push({ name: name.slice(0, 200), region: region.slice(0, 120) });
    if (suggestions.length === 5) break;
  }
  return suggestions;
}

function callStart(targetDate: string | undefined): Date {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);

  if (!targetDate) return tomorrow;
  const target = new Date(targetDate);
  if (Number.isNaN(target.getTime())) return tomorrow;

  const scheduled = new Date(target);
  scheduled.setDate(scheduled.getDate() - 1);
  scheduled.setHours(9, 0, 0, 0);
  if (scheduled.getTime() <= now.getTime()) return tomorrow;
  return scheduled;
}

export async function POST(request: Request) {
  const session = await auth().catch(() => null);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "AUTH_REQUIRED", createdCount: 0 }, { status: 401 });
  }

  let body: { suggestions?: unknown; targetDate?: unknown };
  try {
    body = (await request.json()) as { suggestions?: unknown; targetDate?: unknown };
  } catch {
    return NextResponse.json({ success: false, error: "SUGGESTIONS_REQUIRED", createdCount: 0 }, { status: 400 });
  }

  const suggestions = parseSuggestions(body.suggestions);
  if (suggestions.length === 0) {
    return NextResponse.json({ success: false, error: "SUGGESTIONS_REQUIRED", createdCount: 0 }, { status: 400 });
  }

  const targetDate = typeof body.targetDate === "string" ? body.targetDate : undefined;
  const authorId = session.user.email?.trim() || session.azureOid?.trim() || "smartassist";
  const startDate = callStart(targetDate);

  try {
    const createdCount = await getPrisma().$transaction(async (tx) => {
      let created = 0;
      for (const suggestion of suggestions) {
        const existing = await tx.company.findFirst({
          where: { name: { equals: suggestion.name, mode: "insensitive" } },
          select: { id: true },
        });

        let companyId = existing?.id;
        if (!companyId) {
          const code = await allocateNextCompanyCode(tx);
          const company = await tx.company.create({
            data: {
              code,
              name: suggestion.name,
              status: "active",
              sectors: [SECTOR],
              types: [SUPPLIER_TYPE],
              companyType: SUPPLIER_TYPE,
              stateRegion: suggestion.region || null,
              size: "unknown",
            },
            select: { id: true },
          });
          companyId = company.id;
          created += 1;
          await tx.companyNote.create({
            data: {
              companyId,
              authorId,
              content:
                "SmartAssist sourcing proposal. Supplier lead, not a confirmed relationship. Sector tag: Timber & Forestry.",
            },
          });
        }

        await tx.activity.create({
          data: {
            activityType: "PHONE_CALL",
            title: `Ringe ${suggestion.name}`,
            startDate,
            companyId,
            isAiProposed: false,
          },
        });
      }
      return created;
    });

    return NextResponse.json({ success: true, createdCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Sourcing could not be saved.";
    return NextResponse.json({ success: false, error: message, createdCount: 0 }, { status: 500 });
  }
}
