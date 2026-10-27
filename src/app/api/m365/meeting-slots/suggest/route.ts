import { NextResponse } from "next/server";
import { suggestMutualMeetingSlots } from "@/lib/m365/meeting-slot-scheduler";
import { getPrisma } from "@/lib/prisma";

/**
 * POST /api/m365/meeting-slots/suggest
 * Body: { durationMinutes?: number, colleagueNamesOrEmails?: string[], attendeeEmails?: string[], maxCandidates?: number }
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      durationMinutes?: number;
      colleagueNamesOrEmails?: string[];
      attendeeEmails?: string[];
      maxCandidates?: number;
    };

    const resolvedEmails = new Set<string>();
    for (const email of body.attendeeEmails ?? []) {
      const trimmed = email.trim().toLowerCase();
      if (trimmed.includes("@")) resolvedEmails.add(trimmed);
    }

    const inputs = (body.colleagueNamesOrEmails ?? [])
      .map((s) => s.trim())
      .filter(Boolean);

    if (inputs.length > 0) {
      for (const item of inputs) {
        if (item.includes("@")) {
          resolvedEmails.add(item.toLowerCase());
        }
      }
      try {
        const users = await getPrisma().user.findMany({
          select: { name: true, email: true },
        });
        for (const item of inputs) {
          const lower = item.toLowerCase();
          const match = users.find(
            (u) =>
              (u.name?.trim().toLowerCase() ?? "") === lower ||
              u.email.trim().toLowerCase() === lower,
          );
          if (match?.email) {
            resolvedEmails.add(match.email.trim().toLowerCase());
          }
        }
      } catch {
        // Ignore DB lookup failure in local fallback mode
      }
    }

    const suggestion = await suggestMutualMeetingSlots({
      durationMinutes: body.durationMinutes ?? 45,
      attendeeEmails: Array.from(resolvedEmails),
      maxCandidates: body.maxCandidates ?? 3,
    });

    return NextResponse.json(suggestion);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not suggest mutual meeting times.",
      },
      { status: 500 },
    );
  }
}
