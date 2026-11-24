import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { createPlannerEligibleTask } from "@/lib/m365/planner-create";
import { resolveAuditActor } from "@/lib/security/audit-logger";

export const dynamic = "force-dynamic";

/**
 * POST /api/m365/planner-tasks — create a To Do / Planner-eligible task for the signed-in user.
 * Body: { title, body?, dueDate?, openUrl? }
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

  const title = String(body.title ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  try {
    const created = await createPlannerEligibleTask({
      title,
      body: typeof body.body === "string" ? body.body : undefined,
      dueDate: typeof body.dueDate === "string" ? body.dueDate : null,
      openUrl: typeof body.openUrl === "string" ? body.openUrl : null,
    });
    if (!created) {
      return NextResponse.json(
        {
          error:
            "Could not create Planner task. Sign in to Microsoft 365 and consent to Tasks.ReadWrite.",
        },
        { status: 502 },
      );
    }
    return NextResponse.json({ success: true, ...created });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
