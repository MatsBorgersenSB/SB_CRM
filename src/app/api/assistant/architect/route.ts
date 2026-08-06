import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  executeWorkspaceCommand,
  type WorkspaceArchitectContext,
} from "@/lib/assistant/workspace-architect";

type ExecuteBody = {
  commandText?: string;
  context?: WorkspaceArchitectContext;
};

async function handleArchitectExecute(request: Request) {
  let body: ExecuteBody;
  try {
    body = (await request.json()) as ExecuteBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const commandText = body.commandText?.trim() ?? "";
  if (!commandText) {
    return NextResponse.json(
      { error: "commandText is required" },
      { status: 400 },
    );
  }

  try {
    const result = await executeWorkspaceCommand(commandText, body.context);

    if (result.executed && result.command.action === "CREATE_TASK") {
      revalidatePath("/activities");
    }

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Architect execute failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * POST /api/assistant/architect
 * Alias for conversational workspace command execution.
 */
export async function POST(request: Request) {
  return handleArchitectExecute(request);
}
