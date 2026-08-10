import "server-only";

import { getPrisma } from "@/lib/prisma";
import type { CoPilotActionKind } from "@/types/smartassist-copilot";
import {
  COPILOT_DISMISS_ANONYMOUS,
  COPILOT_DISMISS_NOTE_MIN,
} from "@/lib/smartassist-copilot-dismiss-constants";

export { COPILOT_DISMISS_ANONYMOUS, COPILOT_DISMISS_NOTE_MIN };

export type CoPilotDismissalRecord = {
  suggestionKey: string;
  proposalId?: string;
  companyId?: string;
  actionKind?: string;
  note: string;
  userEmail: string;
  userDisplayName?: string;
  createdAt: string;
};

export function normalizeCoPilotUserEmail(email?: string | null): string {
  const trimmed = email?.trim().toLowerCase();
  return trimmed || COPILOT_DISMISS_ANONYMOUS;
}

export async function recordCoPilotDismissal(input: {
  suggestionKey: string;
  note: string;
  proposalId?: string;
  companyId?: string;
  actionKind?: CoPilotActionKind | string;
  userEmail?: string | null;
  userDisplayName?: string | null;
}): Promise<CoPilotDismissalRecord> {
  const note = input.note.trim();
  if (note.length < COPILOT_DISMISS_NOTE_MIN) {
    throw new Error(
      `A short note is required (at least ${COPILOT_DISMISS_NOTE_MIN} characters).`,
    );
  }

  const suggestionKey = input.suggestionKey.trim();
  if (!suggestionKey) {
    throw new Error("A suggestion key is required to dismiss.");
  }

  const userEmail = normalizeCoPilotUserEmail(input.userEmail);
  const prisma = getPrisma();

  const row = await prisma.coPilotDismissal.upsert({
    where: {
      suggestionKey_userEmail: {
        suggestionKey,
        userEmail,
      },
    },
    create: {
      suggestionKey,
      proposalId: input.proposalId?.trim() || null,
      companyId: input.companyId?.trim() || null,
      actionKind: input.actionKind ? String(input.actionKind) : null,
      note,
      userEmail,
      userDisplayName: input.userDisplayName?.trim() || null,
    },
    update: {
      proposalId: input.proposalId?.trim() || null,
      companyId: input.companyId?.trim() || null,
      actionKind: input.actionKind ? String(input.actionKind) : null,
      note,
      userDisplayName: input.userDisplayName?.trim() || null,
    },
  });

  return {
    suggestionKey: row.suggestionKey,
    proposalId: row.proposalId ?? undefined,
    companyId: row.companyId ?? undefined,
    actionKind: row.actionKind ?? undefined,
    note: row.note,
    userEmail: row.userEmail,
    userDisplayName: row.userDisplayName ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function listCoPilotDismissalKeys(
  userEmail?: string | null,
): Promise<string[]> {
  try {
    const prisma = getPrisma();
    const normalized = normalizeCoPilotUserEmail(userEmail);

    const rows = await prisma.coPilotDismissal.findMany({
      where: {
        OR:
          normalized === COPILOT_DISMISS_ANONYMOUS
            ? [{ userEmail: COPILOT_DISMISS_ANONYMOUS }]
            : [{ userEmail: normalized }, { userEmail: COPILOT_DISMISS_ANONYMOUS }],
      },
      select: { suggestionKey: true },
    });

    return [...new Set(rows.map((row) => row.suggestionKey))];
  } catch (error) {
    console.warn("[copilot-dismissals] list failed — returning empty set", error);
    return [];
  }
}
