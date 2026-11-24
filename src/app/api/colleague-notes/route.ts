import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { notifyColleagueDirectedNote } from "@/lib/notifications/living-signals";
import { resolveAuditActor } from "@/lib/security/audit-logger";
import type { DirectedNoteEntityKind } from "@/types/colleague-note";

export const dynamic = "force-dynamic";

const KINDS = new Set<DirectedNoteEntityKind>([
  "company",
  "opportunity",
  "activity",
  "contact",
  "project",
  "mail",
]);

/** ~4.5MB decoded — keeps Graph / request bodies practical. */
const MAX_ATTACHMENT_BYTES = 4_500_000;

/**
 * POST /api/colleague-notes — Michelin directed note to one colleague on a record.
 * JSON body may include optional linkUrl and attachment { name, contentType, contentBase64 }.
 */
export async function POST(request: Request) {
  const role = getRequestRole(request);
  resolveAuditActor(request, role);

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const kind = String(body.kind ?? "") as DirectedNoteEntityKind;
  if (!KINDS.has(kind)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const entityId = String(body.entityId ?? "").trim();
  const subject = String(body.subject ?? "").trim();
  const note = String(body.note ?? "").trim();
  const impact = String(body.impact ?? "").trim();
  const nextAction = String(body.nextAction ?? "").trim();
  const colleagueId = Number(body.colleagueId);
  const colleagueTitle = String(body.colleagueTitle ?? "").trim();
  const colleagueEmail =
    typeof body.colleagueEmail === "string" ? body.colleagueEmail.trim() : null;
  const linkUrl = typeof body.linkUrl === "string" ? body.linkUrl.trim() : null;

  let attachment: {
    name: string;
    contentType: string;
    contentBase64: string;
  } | null = null;

  const rawAttachment = body.attachment;
  if (rawAttachment && typeof rawAttachment === "object") {
    const file = rawAttachment as Record<string, unknown>;
    const name = String(file.name ?? "").trim();
    const contentType = String(file.contentType ?? "application/octet-stream").trim();
    const contentBase64 = String(file.contentBase64 ?? "")
      .replace(/^data:[^;]+;base64,/, "")
      .replace(/\s/g, "");
    if (name && contentBase64) {
      const approxBytes = Math.floor((contentBase64.length * 3) / 4);
      if (approxBytes > MAX_ATTACHMENT_BYTES) {
        return NextResponse.json(
          { error: "File is too big — keep it under about 4 MB" },
          { status: 400 },
        );
      }
      attachment = { name: name.slice(0, 120), contentType, contentBase64 };
    }
  }

  if (!entityId || !subject || !note || !impact || !nextAction || !colleagueTitle) {
    return NextResponse.json(
      { error: "note, impact, nextAction, subject, entityId, and colleague are required" },
      { status: 400 },
    );
  }
  if (!Number.isFinite(colleagueId) || colleagueId <= 0) {
    return NextResponse.json({ error: "colleagueId required" }, { status: 400 });
  }

  try {
    await notifyColleagueDirectedNote({
      kind,
      entityId,
      subject,
      note,
      impact,
      nextAction,
      colleagueId,
      colleagueTitle,
      colleagueEmail,
      linkUrl,
      attachment,
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Note failed";
    console.error("[colleague-notes POST]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
