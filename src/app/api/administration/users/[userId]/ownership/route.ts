import { NextResponse } from "next/server";
import {
  analyzeUserOwnership,
  loadLifecycleContext,
  recommendSuccessors,
} from "@/lib/user-lifecycle-engine";
import { readUserById } from "@/lib/users-access-db";
import { requireAdminRole } from "@/lib/security/require-admin";

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

  const lifecycleContext = await loadLifecycleContext();
  const analysis = analyzeUserOwnership(user, lifecycleContext);
  const successors = recommendSuccessors(user, lifecycleContext);

  return NextResponse.json({ analysis, successors });
}
