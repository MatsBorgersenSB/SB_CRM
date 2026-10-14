import "server-only";

import type { Prisma } from "@/generated/prisma";
import { withPrismaRetry } from "@/lib/prisma";
import { readLiveCompanies } from "@/lib/prisma-data";
import { exploreCompany } from "@/lib/smartassist/explore/company-explore";
import { liveExploreDeps } from "@/lib/smartassist/explore/deps.server";
import { describeIntent, parseExploreIntent } from "@/lib/smartassist/explore/intent";
import type {
  ExploreIntent,
  ExploreResult,
  UnsupportedExploration,
} from "@/lib/smartassist/explore/types";

export type RunExploreInput = {
  question: string;
  websiteHint?: string | null;
  graphToken: string | null;
  askedBy: string;
};

export type RunExploreOutcome =
  | { ok: true; result: ExploreResult; explorationId: string | null }
  | { ok: false; error: "NOT_UNDERSTOOD" };

function unsupported(
  question: string,
  intent: Exclude<ExploreIntent, { kind: "company" }>,
  internal: UnsupportedExploration["known"]["internal"],
): UnsupportedExploration {
  const summary =
    intent.kind === "suppliers"
      ? `Finding ${intent.commodity} suppliers${intent.region ? ` near ${intent.region}` : ""} by industry and place is the next phase of SmartAssist and is not connected yet. I won't guess company names. ${
          internal.length > 0
            ? `${internal.length} ${internal.length === 1 ? "item" : "items"} in our own mail, files or Teams mention this.`
            : "Nothing in our own mail, files or Teams mentions this."
        }`
      : `I don't answer regulatory questions from memory — limits change and the answer must come from the regulation text, which SmartAssist cannot read yet. ${
          internal.length > 0
            ? `${internal.length} ${internal.length === 1 ? "item" : "items"} in our own mail, files or Teams mention this.`
            : "Nothing in our own mail, files or Teams mentions this."
        }`;

  return {
    kind: "unsupported",
    question,
    intent,
    summary,
    known: { internal },
    unknown:
      intent.kind === "suppliers"
        ? ["Who supplies this in that area — register-driven supplier discovery is not live yet."]
        : ["The current legal limit and its source — regulatory research is not live yet."],
    sources: internal.length > 0 ? [{ id: "internal", kind: "internal", label: "Mail, files and Teams" }] : [],
  };
}

export async function runExplore(input: RunExploreInput): Promise<RunExploreOutcome> {
  const intent = parseExploreIntent(input.question);
  if (!intent) return { ok: false, error: "NOT_UNDERSTOOD" };

  const companies = await readLiveCompanies().catch(() => []);
  const deps = liveExploreDeps({ graphToken: input.graphToken, companies });

  let result: ExploreResult;
  if (intent.kind === "company") {
    result = await exploreCompany(
      {
        question: input.question,
        subject: intent.subject,
        websiteHint: input.websiteHint ?? null,
        companies,
      },
      deps,
    );
  } else {
    const subject = intent.kind === "suppliers" ? `${intent.commodity} ${intent.region ?? ""}`.trim() : intent.topic;
    const internal = await deps.searchInternal(subject).catch(() => []);
    result = unsupported(input.question, intent, internal);
  }

  const explorationId = await persist(input, intent, result).catch(() => null);
  return { ok: true, result, explorationId };
}

async function persist(
  input: RunExploreInput,
  intent: ExploreIntent,
  result: ExploreResult,
): Promise<string> {
  const row = await withPrismaRetry((prisma) =>
    prisma.smartAssistExploration.create({
      data: {
        question: input.question.trim(),
        intent: intent.kind,
        subject: intent.kind === "company" ? intent.subject : describeIntent(intent),
        result: JSON.parse(JSON.stringify(result)) as Prisma.InputJsonValue,
        askedBy: input.askedBy,
      },
      select: { id: true },
    }),
  );
  return row.id;
}

export async function markExplorationImported(explorationId: string | null, companyId: string): Promise<void> {
  if (!explorationId) return;
  await withPrismaRetry((prisma) =>
    prisma.smartAssistExploration.update({ where: { id: explorationId }, data: { companyId } }),
  ).catch(() => undefined);
}
