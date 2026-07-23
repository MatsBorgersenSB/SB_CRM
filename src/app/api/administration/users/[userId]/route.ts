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
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";
import { requireAdminRole } from "@/lib/security/require-admin";
import type { UpdateUserInput } from "@/types/user-access";

type RouteContext = { params: Promise<{ userId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const gate = requireAdminRole(request);
  if ("error" in gate) return gate.error;

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
  const gate = requireAdminRole(request);
  if ("error" in gate) return gate.error;
  const { role } = gate;

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

  const actor = resolveAuditActor(request, role);

  if (body.action === "disable") {
    const user = await disableUser(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    await logAuditEvent({
      ...actor,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: String(id),
      ipAddress: clientIpFromRequest(request),
      metadata: { action: "disable" },
    });
    return NextResponse.json({ user });
  }

  if (body.action === "archive") {
    const user = await archiveUser(id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    await logAuditEvent({
      ...actor,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: String(id),
      ipAddress: clientIpFromRequest(request),
      metadata: { action: "archive" },
    });
    return NextResponse.json({ user });
  }

  const { action: _action, ...patch } = body;
  const user = await updateUser(id, patch);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  await logAuditEvent({
    ...actor,
    action: "USER_UPDATED",
    entityType: "User",
    entityId: String(id),
    ipAddress: clientIpFromRequest(request),
    metadata: { fields: Object.keys(patch) },
  });

  return NextResponse.json({ user });
}

export async function DELETE(request: Request, context: RouteContext) {
  const gate = requireAdminRole(request);
  if ("error" in gate) return gate.error;
  const { role } = gate;

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

  const actor = resolveAuditActor(request, role);
  await logAuditEvent({
    ...actor,
    action: "USER_UPDATED",
    entityType: "User",
    entityId: String(id),
    ipAddress: clientIpFromRequest(request),
    metadata: { action: "delete" },
  });

  return NextResponse.json({ ok: true });
}
