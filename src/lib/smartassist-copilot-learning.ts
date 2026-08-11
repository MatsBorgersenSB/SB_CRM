/**
 * FS-013 — Learn from Co-Pilot dismiss notes (suppression policies).
 * Reality First: notes drive suppress keys only — never invent CRM writes.
 */

import "server-only";

import { getPrisma } from "@/lib/prisma";
import { normalizeCoPilotUserEmail } from "@/lib/smartassist-copilot-dismissals";
import { COPILOT_DISMISS_ANONYMOUS } from "@/lib/smartassist-copilot-dismiss-constants";

const SUPPLIER_PATTERN =
  /\b(supplier|vendor|not\s+a\s+customer|not\s+a\s+client|buy\s+from|purchasing)\b/i;
const ALREADY_DONE_PATTERN =
  /\b(already\s+done|already\s+completed|done\s+already|completed|not\s+needed|no\s+longer)\b/i;
const TOO_SOON_PATTERN =
  /\b(too\s+soon|not\s+now|later|next\s+quarter|premature)\b/i;
const WRONG_TARGET_PATTERN =
  /\b(wrong\s+company|duplicate|not\s+relevant|irrelevant|spam)\b/i;

/**
 * Derive extra suppression keys from a single dismiss note.
 */
export function deriveLearningSuppressKeys(input: {
  suggestionKey: string;
  note: string;
  companyId?: string | null;
  actionKind?: string | null;
}): string[] {
  const keys = new Set<string>();
  const note = input.note.trim();
  const companyId = input.companyId?.trim();

  keys.add(input.suggestionKey);

  if (SUPPLIER_PATTERN.test(note) && companyId) {
    keys.add(`create_opportunity:${companyId}`);
    keys.add(`policy:no_opportunity:${companyId}`);
  }

  if (ALREADY_DONE_PATTERN.test(note) || TOO_SOON_PATTERN.test(note)) {
    keys.add(input.suggestionKey);
  }

  if (WRONG_TARGET_PATTERN.test(note) && companyId && input.actionKind) {
    keys.add(`${input.actionKind}:${companyId}`);
  }

  return [...keys];
}

/**
 * Expand stored dismissals into the full suppress set for a user (keys + learned policies).
 */
export async function listLearnedCoPilotSuppressKeys(
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
      select: {
        suggestionKey: true,
        note: true,
        companyId: true,
        actionKind: true,
      },
    });

    const keys = new Set<string>();
    for (const row of rows) {
      for (const key of deriveLearningSuppressKeys({
        suggestionKey: row.suggestionKey,
        note: row.note,
        companyId: row.companyId,
        actionKind: row.actionKind,
      })) {
        keys.add(key);
      }
    }
    return [...keys];
  } catch (error) {
    console.warn("[copilot-learning] list failed — returning empty set", error);
    return [];
  }
}
