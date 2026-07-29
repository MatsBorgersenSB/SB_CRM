import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  extractSignalsFromText,
  type ExtractedSignals,
} from "@/lib/assistant/signal-extractor";
import { findPrismaCompanyByRouteKey } from "@/lib/data/companies";
import { withPrismaRetry } from "@/lib/prisma";
import { createActivity } from "@/lib/pipeline-db";
import { resolveOpportunityId } from "@/lib/meeting-intelligence-data";
import { stableNumericId } from "@/lib/prisma-mappers";

type ExtractRequestBody = {
  rawText?: string;
  companyId?: string | null;
  opportunityId?: string | null;
  /** When true, persist decisions and create commitment tasks. */
  persist?: boolean;
  signals?: ExtractedSignals;
};

export async function POST(request: Request) {
  let body: ExtractRequestBody;
  try {
    body = (await request.json()) as ExtractRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const rawText = body.rawText?.trim() ?? "";
  if (!rawText && !body.signals) {
    return NextResponse.json({ error: "rawText is required" }, { status: 400 });
  }

  try {
    const signals = body.signals ?? (await extractSignalsFromText(rawText));

    if (!body.persist) {
      return NextResponse.json({ signals, persisted: false });
    }

    let prismaCompanyId: string | null = null;
    let companyTitle: string | null = null;
    let companyNumericId = 0;

    if (body.companyId?.trim()) {
      const company = await findPrismaCompanyByRouteKey(body.companyId.trim());
      if (company) {
        prismaCompanyId = company.id;
        companyTitle = company.name;
        companyNumericId = stableNumericId(company.id);
      }
    }

    let prismaOpportunityId: string | null = null;
    if (body.opportunityId?.trim()) {
      prismaOpportunityId =
        (await resolveOpportunityId(body.opportunityId.trim())) ??
        body.opportunityId.trim();
    }

    const createdDecisions = await withPrismaRetry(async (prisma) => {
      const rows = [];
      for (const decision of signals.decisions) {
        const row = await prisma.decisionJournal.create({
          data: {
            companyId: prismaCompanyId,
            opportunityId: prismaOpportunityId,
            decisionText: decision.decisionText,
            rationale: decision.rationale ?? null,
            stakeholderName: decision.stakeholderName ?? null,
            category: decision.category,
            confidenceScore: decision.confidenceScore,
            sourceSnippet: rawText.slice(0, 500) || null,
          },
        });
        rows.push(row);
      }
      return rows;
    });

    const createdTasks = [];
    for (const commitment of signals.commitments) {
      try {
        const activity = await createActivity({
          ActivityType: "Task",
          ActivityDate: new Date().toISOString(),
          Subject: commitment.title.slice(0, 180),
          ActivityDescription: commitment.title,
          Summary: commitment.title,
          ActionRequired: true,
          NextAction: commitment.title,
          NextActionDate: commitment.dueDate ?? "",
          ActionStatus: "Open",
          ActionOutcome: "",
          AgreedActions: [
            {
              text: commitment.title,
              dueDate: commitment.dueDate ?? "",
            },
          ],
          Company:
            prismaCompanyId && companyTitle
              ? { Id: companyNumericId, Title: companyTitle }
              : body.companyId
                ? { CompanyID: body.companyId }
                : null,
          Deal: body.opportunityId
            ? { DealID: body.opportunityId }
            : null,
        });
        createdTasks.push(activity);
      } catch (error) {
        console.warn(
          "[extract-signals] Could not create commitment task:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    // Persist risks as company notes when a company is linked (organizational memory).
    if (prismaCompanyId && signals.risks.length > 0) {
      await withPrismaRetry(async (prisma) => {
        for (const risk of signals.risks) {
          await prisma.companyNote.create({
            data: {
              companyId: prismaCompanyId!,
              authorId: "smartassist-signal-extractor",
              content: `[Risk · ${risk.severity}] ${risk.description}`,
            },
          });
        }
      }).catch(() => undefined);
    }

    revalidatePath("/companies");
    revalidatePath("/activities");
    if (body.companyId) {
      revalidatePath(`/companies/${encodeURIComponent(body.companyId)}`);
    }

    return NextResponse.json({
      signals,
      persisted: true,
      decisionsSaved: createdDecisions.length,
      tasksCreated: createdTasks.length,
      risksSaved: prismaCompanyId ? signals.risks.length : 0,
      decisions: createdDecisions,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Signal extraction failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
