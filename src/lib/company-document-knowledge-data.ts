import "server-only";

import { findPrismaCompanyByRouteKey } from "@/lib/data/companies";
import { getPrisma } from "@/lib/prisma";
import {
  EMPTY_DOCUMENT_KNOWLEDGE_STATE,
  parseCompanyDocumentKnowledgeState,
  type CompanyDocumentKnowledgeState,
} from "@/lib/company-document-knowledge";
import type { Prisma } from "@/generated/prisma";

export async function loadCompanyDocumentKnowledge(
  routeKey: string,
): Promise<CompanyDocumentKnowledgeState> {
  try {
    const row = await findPrismaCompanyByRouteKey(routeKey);
    if (!row) return EMPTY_DOCUMENT_KNOWLEDGE_STATE;
    return parseCompanyDocumentKnowledgeState(
      (row as { documentKnowledge?: unknown }).documentKnowledge,
    );
  } catch (error) {
    console.warn(
      "[document-knowledge] load skipped:",
      error instanceof Error ? error.message : error,
    );
    return EMPTY_DOCUMENT_KNOWLEDGE_STATE;
  }
}

export async function saveCompanyDocumentKnowledge(
  routeKey: string,
  state: CompanyDocumentKnowledgeState,
): Promise<CompanyDocumentKnowledgeState> {
  const row = await findPrismaCompanyByRouteKey(routeKey);
  if (!row) {
    throw Object.assign(new Error("Company not found"), { status: 404 });
  }

  const updated = await getPrisma().company.update({
    where: { id: row.id },
    data: {
      documentKnowledge: state as unknown as Prisma.InputJsonValue,
    },
    select: { documentKnowledge: true },
  });

  return parseCompanyDocumentKnowledgeState(updated.documentKnowledge);
}
