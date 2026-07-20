import { NextResponse } from "next/server";
import {
  buildTransferPreview,
  executeOwnershipTransfer,
  loadLifecycleContext,
} from "@/lib/user-lifecycle-engine";
import { readUserById } from "@/lib/users-access-db";

type RouteContext = { params: Promise<{ userId: string }> };

export async function POST(request: Request, context: RouteContext) {
  const { userId } = await context.params;
  const fromId = Number.parseInt(userId, 10);
  if (Number.isNaN(fromId)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  let body: { toUserId?: number; preview?: boolean };
  try {
    body = (await request.json()) as { toUserId?: number; preview?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const lifecycleContext = await loadLifecycleContext();
  const fromUser = await readUserById(fromId);
  if (!fromUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  if (body.preview || !body.toUserId) {
    const preview = buildTransferPreview(fromUser, lifecycleContext, body.toUserId);
    return NextResponse.json({ preview });
  }

  const toUser = await readUserById(body.toUserId);
  if (!toUser) {
    return NextResponse.json({ error: "Successor user not found" }, { status: 404 });
  }

  if (toUser.status !== "active") {
    return NextResponse.json(
      { error: "Successor must be an active user" },
      { status: 400 },
    );
  }

  if (fromUser.id === toUser.id) {
    return NextResponse.json(
      { error: "Cannot transfer ownership to the same user" },
      { status: 400 },
    );
  }

  const result = await executeOwnershipTransfer(fromUser, toUser, lifecycleContext);
  const preview = buildTransferPreview(fromUser, lifecycleContext, toUser.id);

  return NextResponse.json({ result, preview });
}
