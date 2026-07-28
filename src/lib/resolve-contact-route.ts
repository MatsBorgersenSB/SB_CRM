import type { Company } from "@/lib/companies-data";
import {
  findContactByContactId,
  getGlobalContactRecords,
  type GlobalContactRecord,
} from "@/lib/contact-utils";
import {
  contactTrackingMatches,
  emailsIncludeAddress,
  isContactTrackingCode,
} from "@/lib/entity-route-utils";
import { withPrismaRetry } from "@/lib/prisma";
import { toContactTrackingId } from "@/lib/prisma-mappers";
import { resolveEntity } from "@/lib/resolvers/entity-resolver";
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

    const byName = await withPrismaRetry((prisma) =>
      prisma.contact.findFirst({
        where: {
          fullName: { equals: key, mode: "insensitive" },
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
 * Resolve contact route via universal entity resolver (Prisma → portfolio/seed).
 */
export async function resolveContactRouteRecord(
  companies: Company[],
  pipelines: PipelineRow[],
  routeKey: string,
  companyHint?: string,
): Promise<GlobalContactRecord | undefined> {
  const fallback = getGlobalContactRecords(companies, pipelines);

  const record = await resolveEntity(
    routeKey,
    async (searchKey) => {
      const prismaContact = await findPrismaContactByIdOrEmail(searchKey);
      if (!prismaContact) return null;
      const trackingId = toContactTrackingId(prismaContact.id);
      return (
        findContactByContactId(companies, pipelines, trackingId, companyHint) ??
        findContactByContactId(companies, pipelines, trackingId) ??
        null
      );
    },
    fallback as Array<GlobalContactRecord & Record<string, unknown>>,
    {
      matchKeys: ["companyId", "companyName"],
      getMatchValues: (row) => [
        row.contact.ContactID,
        row.contact.id,
        String(row.contact.id),
        row.contact.Email,
        row.contact.Title,
        `${row.contact.FirstName} ${row.contact.LastName}`.trim(),
      ],
    },
  );

  if (!record) return undefined;

  if (companyHint && record.companyId !== companyHint) {
    const scoped = findContactByContactId(
      companies,
      pipelines,
      record.contact.ContactID,
      companyHint,
    );
    return scoped ?? record;
  }

  return record;
}
