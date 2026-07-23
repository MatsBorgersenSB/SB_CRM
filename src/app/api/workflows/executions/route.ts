import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { readWorkflowApprovalQueue } from "@/lib/fs011-workflow-data";

/** GET /api/workflows/executions — approval queue snapshot */
export async function GET(request: Request) {
  const role = getRequestRole(request);
  if (role === "client_lead") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const queue = await readWorkflowApprovalQueue();
  return NextResponse.json(queue);
}
