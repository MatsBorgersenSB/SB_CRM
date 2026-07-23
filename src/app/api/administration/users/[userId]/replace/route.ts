import { NextResponse } from "next/server";
import {
  analyzeUserOwnership,
  executeOwnershipTransfer,
  loadLifecycleContext,
} from "@/lib/user-lifecycle-engine";
import { archiveUser, disableUser, readUserById } from "@/lib/users-access-db";
import { requireAdminRole } from "@/lib/security/require-admin";
import type { ReplaceUserInput } from "@/types/user-access";

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const gate = requireAdminRole(request);
  if ("error" in gate) return gate.error;

  const { userId } = await context.params;
  const fromId = Number.parseInt(userId, 10);
  if (Number.isNaN(fromId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  let body: ReplaceUserInput;
  try {
    body = (await request.json()) as ReplaceUserInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.toUserId) {
    return NextResponse.json({ error: "toUserId is required" }, { status: 400 });
  }

  const lifecycleContext = await loadLifecycleContext();
  const fromUser = await readUserById(fromId);
  const toUser = await readUserById(body.toUserId);

  if (!fromUser || !toUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (toUser.status !== "active") {
    return NextResponse.json(
      { error: "Replacement user must be active" },
      { status: 400 },
    );
  }

  const analysis = analyzeUserOwnership(fromUser, lifecycleContext);
  let transferResult = null;

  if (analysis.hasOwnership) {
    transferResult = await executeOwnershipTransfer(fromUser, toUser, lifecycleContext);
  }

  const departingUser = body.archiveDeparting
    ? await archiveUser(fromId)
    : await disableUser(fromId);

  return NextResponse.json({
    replaced: true,
    transferResult,
    departingUser,
    successor: toUser,
  });
}
