/**
 * Shared ADMIN gate for administration user APIs (FS-013 remediation).
 */
import { NextResponse } from "next/server";
import { getRequestRole } from "@/lib/api-auth";
import { hasRole } from "@/lib/security/rbac";
import type { UserRole } from "@/types/auth";

export function requireAdminRole(
  request: Request,
): { role: UserRole } | { error: NextResponse } {
  const role = getRequestRole(request);
  if (!hasRole({ role }, ["ADMIN"])) {
    return {
      error: NextResponse.json(
        { error: "Forbidden — administration users require ADMIN" },
        { status: 403 },
      ),
    };
  }
  return { role };
}
