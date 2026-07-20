import { NextResponse } from "next/server";
import { analyzeUserOwnership } from "@/lib/user-lifecycle-analysis";
import { loadLifecycleContext } from "@/lib/user-lifecycle-actions";
import {
  archiveUser,
  deleteUser,
  disableUser,
  readUserById,
  updateUser,
} from "@/lib/users-access-db";
import type { UpdateUserInput } from "@/types/user-access";

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const { userId } = await context.params;
  const id = Number.parseInt(userId, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const user = await readUserById(id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function PATCH(request: Request, context: RouteContext) {
  const { userId } = await context.params;
  const id = Number.parseInt(userId, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  let body: UpdateUserInput & { action?: "disable" | "archive" };
  try {
    body = (await request.json()) as UpdateUserInput & { action?: "disable" | "archive" };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action === "disable") {
    const user = await disableUser(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ user });
  }

  if (body.action === "archive") {
    const user = await archiveUser(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    return NextResponse.json({ user });
  }

  const { action: _action, ...patch } = body;
  const user = await updateUser(id, patch);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { userId } = await context.params;
  const id = Number.parseInt(userId, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }

  const user = await readUserById(id);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const lifecycleContext = await loadLifecycleContext();
  const analysis = analyzeUserOwnership(user, lifecycleContext);

  if (analysis.hasOwnership) {
    return NextResponse.json(
      {
        error: "Cannot delete user with active ownership",
        analysis,
        requireTransfer: true,
      },
      { status: 409 },
    );
  }

  const deleted = await deleteUser(id);
  if (!deleted) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
