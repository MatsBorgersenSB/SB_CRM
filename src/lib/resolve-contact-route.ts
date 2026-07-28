import type { Company } from "@/lib/companies-data";
import {
  findContactByContactId,
  type GlobalContactRecord,
} from "@/lib/contact-utils";
import {
  contactTrackingMatches,
  emailsIncludeAddress,
  isContactTrackingCode,
} from "@/lib/entity-route-utils";
import { withPrismaRetry } from "@/lib/prisma";
import { toContactTrackingId } from "@/lib/prisma-mappers";
import type { PipelineRow } from "@/types/pipeline";

/**
 * Prisma lookup by primary id, M365 ids, CT- code, or email (emails Json[]).
 * Never throws — returns null on miss / DB errors.
 */
export async function findPrismaContactByIdOrEmail(routeKey: string) {
  const key = routeKey.trim();
  if (!key) return null;

  try {
    const byId = await withPrismaRetry((prisma) =>
      prisma.contact.findFirst({
        where: {
          OR: [
            { id: key },
            { m365GraphId: key },
            { m365ImmutableId: key },
          ],
        },
        include: { company: true },
      }),
    );
    if (byId) return byId;

    if (key.includes("@")) {
      const candidates = await withPrismaRetry((client) =>
        client.contact.findMany({
          where: { status: "active" },
          include: { company: true },
        }),
      );
      return (
        candidates.find((row) => emailsIncludeAddress(row.emails, key)) ?? null
      );
    }

    if (isContactTrackingCode(key)) {
      const candidates = await withPrismaRetry((client) =>
        client.contact.findMany({
          where: { status: { in: ["active", "archived"] } },
          include: { company: true },
        }),
      );
      return (
        candidates.find((row) => contactTrackingMatches(row.id, key)) ?? null
      );
    }

    // Full-name match (Reality First — exact, case-insensitive)
    const byName = await withPrismaRetry((prisma) =>
      prisma.contact.findFirst({
        where: {
          OR: [
            { fullName: { equals: key, mode: "insensitive" } },
          ],
        },
        include: { company: true },
      }),
    );
    return byName;
  } catch (error) {
    console.warn(
      "[resolve-contact-route] Prisma contact lookup failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Resolve contact route: Prisma first (try/catch), then portfolio/JSON dual-store.
 */
export async function resolveContactRouteRecord(
  companies: Company[],
  pipelines: PipelineRow[],
  routeKey: string,
  companyHint?: string,
): Promise<GlobalContactRecord | undefined> {
  const key = routeKey.trim();
  if (!key) return undefined;

  try {
    const prismaContact = await findPrismaContactByIdOrEmail(key);
    if (prismaContact) {
      const trackingId = toContactTrackingId(prismaContact.id);
      const fromLive =
        findContactByContactId(companies, pipelines, trackingId, companyHint) ??
        findContactByContactId(companies, pipelines, trackingId);
      if (fromLive) return fromLive;
    }
  } catch (error) {
    console.warn(
      "[resolve-contact-route] Falling back to portfolio:",
      error instanceof Error ? error.message : error,
    );
  }

  return findContactByContactId(companies, pipelines, key, companyHint);
}
