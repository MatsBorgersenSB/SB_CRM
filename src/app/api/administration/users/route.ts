import { NextResponse } from "next/server";
import { createUser, readUsers } from "@/lib/users-access-db";
import {
  clientIpFromRequest,
  logAuditEvent,
  resolveAuditActor,
} from "@/lib/security/audit-logger";
import { requireAdminRole } from "@/lib/security/require-admin";
import type { CreateUserInput } from "@/types/user-access";

export async function GET(request: Request) {
  const gate = requireAdminRole(request);
  if ("error" in gate) return gate.error;

  const users = await readUsers();
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const gate = requireAdminRole(request);
  if ("error" in gate) return gate.error;
  const { role } = gate;

  let body: CreateUserInput;
  try {
    body = (await request.json()) as CreateUserInput;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body.displayName?.trim() || !body.email?.trim()) {
    return NextResponse.json(
      { error: "displayName and email are required" },
      { status: 400 },
    );
  }

  const user = await createUser(body);

  const actor = resolveAuditActor(request, role);
  await logAuditEvent({
    ...actor,
    action: "USER_CREATED",
    entityType: "User",
    entityId: String(user.id),
    ipAddress: clientIpFromRequest(request),
    metadata: {
      email: user.email,
      displayName: user.displayName,
      accessRole: user.role,
    },
  });

  return NextResponse.json({ user }, { status: 201 });
}
