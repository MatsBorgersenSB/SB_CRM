import "server-only";

import { getPrisma } from "@/lib/prisma";
import { toCompanyTrackingId, toContactTrackingId } from "@/lib/prisma-mappers";
import type { InboundMailAttentionSignal } from "@/lib/inbound-mail-attention";

const LOOKBACK_HOURS = 48;

/**
 * Recent inbound mail already linked to a company — for My Attention.
 * Reality First: skip mail we cannot place on a known company.
 */
export async function loadRecentInboundMailSignals(): Promise<InboundMailAttentionSignal[]> {
  try {
    const prisma = getPrisma();
    const since = new Date(Date.now() - LOOKBACK_HOURS * 60 * 60 * 1000);
    const rows = await prisma.emailMessageRecord.findMany({
      where: {
        isOutbound: false,
        isDeletedInSource: false,
        sentAt: { gte: since },
        OR: [
          { contactId: { not: null } },
          { opportunityId: { not: null } },
          { projectId: { not: null } },
        ],
      },
      select: {
        id: true,
        subject: true,
        senderEmail: true,
        sentAt: true,
        contactId: true,
        projectId: true,
        contact: {
          select: {
            id: true,
            companyId: true,
            company: { select: { id: true, code: true, name: true } },
          },
        },
        opportunity: {
          select: {
            company: { select: { id: true, code: true, name: true } },
          },
        },
      },
      orderBy: { sentAt: "desc" },
      take: 20,
    });

    const projectCompanyById = new Map<string, { companyId: string; companyName: string }>();
    if (rows.some((row) => row.projectId && !row.contact?.company && !row.opportunity?.company)) {
      try {
        const { readProjects } = await import("@/lib/project-db");
        const projects = await readProjects();
        for (const project of projects) {
          const linked =
            project.linkedCompanyId?.trim() ||
            project.relatedOrganizations?.find((org) => org.isPrimary)?.companyId?.trim() ||
            project.relatedOrganizations?.[0]?.companyId?.trim();
          if (!linked) continue;
          projectCompanyById.set(project.id, {
            companyId: linked,
            companyName: project.name,
          });
        }
      } catch (error) {
        console.warn(
          "[inbound-mail] project map skipped",
          error instanceof Error ? error.message : error,
        );
      }
    }

    const signals: InboundMailAttentionSignal[] = [];
    const seenCompany = new Set<string>();

    for (const row of rows) {
      const prismaCompany = row.contact?.company ?? row.opportunity?.company ?? null;
      const fromProject = row.projectId ? projectCompanyById.get(row.projectId) : undefined;
      const companyId = prismaCompany
        ? prismaCompany.code?.trim() || toCompanyTrackingId(prismaCompany.id)
        : fromProject?.companyId;
      const companyName = prismaCompany?.name ?? fromProject?.companyName;
      if (!companyId || !companyName) continue;
      if (seenCompany.has(companyId)) continue;
      seenCompany.add(companyId);

      const sentAt = row.sentAt instanceof Date ? row.sentAt : new Date(row.sentAt);
      if (Number.isNaN(sentAt.getTime())) continue;

      signals.push({
        id: row.id,
        subject: row.subject,
        senderEmail: row.senderEmail,
        sentAt: sentAt.toISOString(),
        companyId,
        companyName,
        contactId: row.contactId ? toContactTrackingId(row.contactId) : null,
      });
    }

    return signals;
  } catch (error) {
    console.warn(
      "[inbound-mail] load failed",
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}
