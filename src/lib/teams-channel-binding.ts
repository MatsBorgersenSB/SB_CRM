import "server-only";

import { withPrismaRetry } from "@/lib/prisma";

export type TeamsChannelBindingRecord = {
  id: string;
  teamId: string;
  channelId: string;
  companyId: string | null;
  projectId: string | null;
  boundBy: string | null;
  boundAt: string;
};

function mapRow(row: {
  id: string;
  teamId: string;
  channelId: string;
  companyId: string | null;
  projectId: string | null;
  boundBy: string | null;
  boundAt: Date;
}): TeamsChannelBindingRecord {
  return {
    id: row.id,
    teamId: row.teamId,
    channelId: row.channelId,
    companyId: row.companyId,
    projectId: row.projectId,
    boundBy: row.boundBy,
    boundAt: row.boundAt.toISOString(),
  };
}

export async function getTeamsChannelBinding(
  teamId: string,
  channelId: string,
): Promise<TeamsChannelBindingRecord | null> {
  const row = await withPrismaRetry((prisma) =>
    prisma.teamsChannelBinding.findUnique({
      where: {
        teamId_channelId: { teamId, channelId },
      },
    }),
  );
  return row ? mapRow(row) : null;
}

export async function upsertTeamsChannelBinding(input: {
  teamId: string;
  channelId: string;
  companyId?: string | null;
  projectId?: string | null;
  boundBy?: string | null;
}): Promise<TeamsChannelBindingRecord> {
  const teamId = input.teamId.trim();
  const channelId = input.channelId.trim();
  if (!teamId || !channelId) {
    throw new Error("teamId and channelId are required");
  }
  const companyId = input.companyId?.trim() || null;
  const projectId = input.projectId?.trim() || null;
  if (!companyId && !projectId) {
    throw new Error("Provide companyId or projectId");
  }
  if (companyId && projectId) {
    throw new Error("Bind to either a company or a project — not both");
  }

  const row = await withPrismaRetry((prisma) =>
    prisma.teamsChannelBinding.upsert({
      where: { teamId_channelId: { teamId, channelId } },
      create: {
        teamId,
        channelId,
        companyId,
        projectId,
        boundBy: input.boundBy?.trim() || null,
      },
      update: {
        companyId,
        projectId,
        boundBy: input.boundBy?.trim() || null,
        boundAt: new Date(),
      },
    }),
  );
  return mapRow(row);
}

export async function deleteTeamsChannelBinding(
  teamId: string,
  channelId: string,
): Promise<boolean> {
  try {
    await withPrismaRetry((prisma) =>
      prisma.teamsChannelBinding.delete({
        where: { teamId_channelId: { teamId, channelId } },
      }),
    );
    return true;
  } catch {
    return false;
  }
}
