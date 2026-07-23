import type { Prisma, Role } from "@/generated/prisma";
import { getPrisma, withPrismaRetry } from "@/lib/prisma";
import { toEnterpriseRole } from "@/lib/security/rbac";
import type { UserRole } from "@/types/auth";

export type AuditAction =
  | "DEAL_UPDATED"
  | "STAGE_CHANGED"
  | "DEAL_DELETED"
  | "COMPANY_DELETED"
  | "CONTACT_DELETED"
  | "EXPORT_DATA"
  | "WORKFLOW_APPROVED"
  | "WORKFLOW_DISMISSED"
  | "AI_DRAFT_GENERATED"
  | "MEETING_ANALYZED"
  | "DEAL_INSIGHTS_VIEWED"
  | "ANALYTICS_VIEWED"
  | "ANALYTICS_REPORT_EXPORTED"
  | (string & {});

export type LogAuditEventInput = {
  userId: string;
  userEmail: string;
  userName?: string | null;
  /** Existing SmartCRM access tier — used to upsert enterprise Role on User */
  accessRole?: UserRole;
  action: AuditAction;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
};

/**
 * Ensure a FS-013 User row exists for audit FK, then write AuditLog.
 * Never throws to callers for logging failures — logs a warning instead.
 */
export async function logAuditEvent(input: LogAuditEventInput): Promise<void> {
  try {
    await withPrismaRetry(async (prisma) => {
      const enterpriseRole: Role = input.accessRole
        ? toEnterpriseRole(input.accessRole)
        : "REP";

      const user = await prisma.user.upsert({
        where: { email: input.userEmail },
        create: {
          id: input.userId,
          email: input.userEmail,
          name: input.userName ?? null,
          role: enterpriseRole,
        },
        update: {
          ...(input.userName != null ? { name: input.userName } : {}),
          role: enterpriseRole,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          userEmail: input.userEmail,
          action: input.action,
          entityType: input.entityType,
          entityId: input.entityId,
          metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
          ipAddress: input.ipAddress ?? null,
        },
      });
    });
  } catch (error) {
    console.warn(
      "[audit] Failed to write audit log:",
      error instanceof Error ? error.message : error,
    );
  }
}

export function clientIpFromRequest(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

/** Convenience: resolve actor identity from request headers + role. */
export function resolveAuditActor(
  request: Request,
  role: UserRole,
): Pick<LogAuditEventInput, "userId" | "userEmail" | "userName" | "accessRole"> {
  const userId =
    request.headers.get("x-sb-user-id")?.trim() ||
    `role:${role}`;
  const userEmail =
    request.headers.get("x-sb-user-email")?.trim() ||
    `${role}@smartcrm.local`;
  const userName = request.headers.get("x-sb-user-name")?.trim() || null;

  return {
    userId,
    userEmail,
    userName,
    accessRole: role,
  };
}

/** Direct Prisma accessor for tests / admin readers. */
export async function listRecentAuditLogs(limit = 50) {
  const prisma = getPrisma();
  return prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { id: true, email: true, role: true, name: true } } },
  });
}
