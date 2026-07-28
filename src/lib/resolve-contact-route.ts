import type { Company } from "@/lib/companies-data";
import {
  findContactByContactId,
  type GlobalContactRecord,
} from "@/lib/contact-utils";
import { withPrismaRetry } from "@/lib/prisma";
import { toContactTrackingId } from "@/lib/prisma-mappers";
import type { PipelineRow } from "@/types/pipeline";

function emailsIncludeAddress(emails: unknown, needle: string): boolean {
  if (!Array.isArray(emails)) return false;
  const target = needle.trim().toLowerCase();
  if (!target) return false;
  return emails.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const address = (entry as { address?: unknown }).address;
    return typeof address === "string" && address.trim().toLowerCase() === target;
  });
}

/**
 * Prisma lookup by primary id OR email (emails Json[] — no scalar `email` field).
 * Never throws: returns null on miss / DB errors so the page can call notFound().
 */
export async function findPrismaContactByIdOrEmail(routeKey: string) {
  const key = routeKey.trim();
  if (!key) return null;

  try {
    // 1) Primary id + external M365 ids (valid Contact fields only — never `email` / `opportunities`)
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

    // 2) Email match against Json[] `emails` ({ address, type, isPrimary })
    //    Schema has no scalar `email` — querying `{ email: key }` causes a 500.
    if (!key.includes("@")) return null;

    const candidates = await withPrismaRetry((client) =>
      client.contact.findMany({
        where: { status: "active" },
        include: { company: true },
      }),
    );

    return (
      candidates.find((row) => emailsIncludeAddress(row.emails, key)) ?? null
    );
  } catch (error) {
    console.warn(
      "[resolve-contact-route] Prisma contact lookup failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * Resolve a Contact 360 route key to a portfolio record.
 * Accepts ContactID (CT-…), numeric id, email, Prisma UUID, or M365 external ids.
 */
export async function resolveContactRouteRecord(
  companies: Company[],
  pipelines: PipelineRow[],
  routeKey: string,
  companyHint?: string,
): Promise<GlobalContactRecord | undefined> {
  const key = routeKey.trim();
  if (!key) return undefined;

  const fromPortfolio = findContactByContactId(
    companies,
    pipelines,
    key,
    companyHint,
  );
  if (fromPortfolio) return fromPortfolio;

  const prismaContact = await findPrismaContactByIdOrEmail(key);
  if (!prismaContact) return undefined;

  return findContactByContactId(
    companies,
    pipelines,
    toContactTrackingId(prismaContact.id),
    companyHint,
  );
}
