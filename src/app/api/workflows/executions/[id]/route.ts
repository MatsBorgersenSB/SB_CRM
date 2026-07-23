import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import {
  dismissWorkflowExecution,
  executeApprovedWorkflow,
} from "@/lib/workflow-engine";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * PATCH /api/workflows/executions/[id]
 * Body: { action: "approve" | "dismiss" }
 */
export async function PATCH(request: Request, context: RouteContext) {
  const role = getRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ error: "Missing execution id" }, { status: 400 });
  }

  try {
    const body = (await request.json()) as { action?: string };
    const action = body.action?.trim();
    const actor = resolveAuditActor(request, role);

    if (action === "dismiss") {
      const execution = await dismissWorkflowExecution(id);
      await logAuditEvent({
        ...actor,
        action: "WORKFLOW_DISMISSED",
        entityType: "WorkflowExecution",
        entityId: id,
        ipAddress: clientIpFromRequest(request),
        metadata: {
          status: execution.status,
          actionType: execution.actionType,
        },
      });
      return NextResponse.json({ success: true, execution });
    }

    if (action === "approve") {
      const result = await executeApprovedWorkflow(id);
      await logAuditEvent({
        ...actor,
        action: "WORKFLOW_APPROVED",
        entityType: "WorkflowExecution",
        entityId: id,
        ipAddress: clientIpFromRequest(request),
        metadata: {
          status: result.execution.status,
          actionType: result.execution.actionType,
          sideEffect: result.sideEffect ?? null,
        },
      });
      return NextResponse.json({
        success: true,
        execution: result.execution,
        sideEffect: result.sideEffect ?? null,
      });
    }

    return NextResponse.json(
      { error: "action must be approve or dismiss" },
      { status: 400 },
    );
  } catch (error) {
    console.error("[workflows PATCH]", error);
    return NextResponse.json(
      {
        error: "Workflow action failed",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
