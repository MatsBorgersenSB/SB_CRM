import "server-only";

import { nextPipelineId } from "@/lib/entity-id";
import { withPrismaRetry } from "@/lib/prisma";
import { readPipelines } from "@/lib/pipeline-db";
import type { PipelineRow } from "@/types/pipeline";

type PrismaCodeClient = {
  opportunity: {
    findMany: (args: {
      where?: { code?: { not: null } };
      select: { code: true };
    }) => Promise<Array<{ code: string | null }>>;
  };
};

/** Allocate next PL-#### from Prisma opportunity codes + optional seed portfolio. */
export async function allocateNextOpportunityCode(
  prismaLike?: PrismaCodeClient,
  seedPipelines: PipelineRow[] = [],
): Promise<string> {
  const client =
    prismaLike ??
    ({
      opportunity: {
        findMany: (args: {
          where?: { code?: { not: null } };
          select: { code: true };
        }) => withPrismaRetry((prisma) => prisma.opportunity.findMany(args)),
      },
    } satisfies PrismaCodeClient);

  const [rows, portfolio] = await Promise.all([
    client.opportunity.findMany({
      where: { code: { not: null } },
      select: { code: true },
    }),
    seedPipelines.length > 0
      ? Promise.resolve(seedPipelines)
      : readPipelines().catch(() => [] as PipelineRow[]),
  ]);

  const synthetic: Array<{ id: string; code?: string | null }> = [
    ...portfolio,
    ...rows
      .map((row) => row.code?.trim())
      .filter((code): code is string => Boolean(code))
      .map((code) => ({ id: code, code })),
  ];

  return nextPipelineId(synthetic);
}
