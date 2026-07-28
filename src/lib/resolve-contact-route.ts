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
 * Prisma lookup — valid Contact fields only (no scalar `email` / `code`).
 * Never throws.
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
            { fullName: { equals: key, mode: "insensitive" } },
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

    return null;
  } catch (error) {
    console.warn(
      "[resolve-contact-route] DB contact lookup bypassed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Resolve contact: portfolio/seed first (CT-… links), then Prisma bridge.
 */
export async function resolveContactRouteRecord(
  companies: Company[],
  pipelines: PipelineRow[],
  routeKey: string,
  companyHint?: string,
): Promise<GlobalContactRecord | undefined> {
  const key = routeKey.trim();
  if (!key) return undefined;

  // Fast path — same roster the contacts list uses
  const direct = findContactByContactId(companies, pipelines, key, companyHint);
  if (direct) return direct;

  const fallback = getGlobalContactRecords(companies, pipelines);

  const record = await resolveEntity(
    key,
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
      preferFallbackFirst: true,
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

  return record ?? undefined;
}
