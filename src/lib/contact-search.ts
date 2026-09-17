import "server-only";

import { prismaLiveContactWhere } from "@/lib/demo-seed-markers";
import { withPrismaRetry } from "@/lib/prisma";
import { toContactTrackingId } from "@/lib/prisma-mappers";

export type ContactSearchHit = {
  id: string;
  name: string;
  email: string | null;
  companyId: string | null;
  companyName: string;
};

function pickPrimaryEmail(emails: unknown): string | null {
  if (!Array.isArray(emails) || emails.length === 0) return null;
  const typed = emails.filter(
    (entry): entry is { address?: string; isPrimary?: boolean } =>
      Boolean(entry && typeof entry === "object"),
  );
  const primary = typed.find((entry) => entry.isPrimary) ?? typed[0];
  const address = primary?.address?.trim().toLowerCase() || "";
  return address || null;
}

function displayName(row: {
  fullName: string | null;
  firstName: string | null;
  lastName: string | null;
  emails: unknown;
}): string {
  const full = row.fullName?.trim();
  if (full) return full;
  const parts = [row.firstName?.trim(), row.lastName?.trim()].filter(Boolean);
  if (parts.length > 0) return parts.join(" ");
  return pickPrimaryEmail(row.emails) || "Unnamed contact";
}

function rankHit(hit: ContactSearchHit, query: string): number {
  const needle = query.trim().toLowerCase();
  const name = hit.name.toLowerCase();
  const email = (hit.email ?? "").toLowerCase();
  const company = hit.companyName.toLowerCase();
  if (email === needle) return 100;
  if (email.startsWith(needle)) return 90;
  if (name.startsWith(needle)) return 80;
  if (name.includes(needle)) return 65;
  if (email.includes(needle)) return 55;
  if (company.includes(needle)) return 40;
  return 10;
}

async function findContactIdsByEmailFragment(query: string): Promise<string[]> {
  const like = `%${query.toLowerCase().replace(/[%_\\]/g, "\\$&")}%`;
  try {
    const rows = await withPrismaRetry((prisma) =>
      prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id
        FROM contact_registry
        WHERE status = 'active'
          AND EXISTS (
            SELECT 1
            FROM unnest(emails) AS e
            WHERE lower(e->>'address') LIKE ${like}
          )
        LIMIT 20
      `,
    );
    return rows.map((row) => row.id);
  } catch {
    try {
      const rows = await withPrismaRetry((prisma) =>
        prisma.$queryRaw<Array<{ id: string }>>`
          SELECT id
          FROM contact_registry
          WHERE status = 'active'
            AND emails::text ILIKE ${like}
          LIMIT 20
        `,
      );
      return rows.map((row) => row.id);
    } catch {
      return [];
    }
  }
}

/**
 * Live Contact Registry search for Outlook assign — name, email, or company.
 * Reality First: only returns stored contacts; never invents a match.
 */
export async function searchLiveContacts(query: string): Promise<ContactSearchHit[]> {
  const needle = query.trim();
  if (needle.length < 2) return [];

  const emailIds = needle.includes("@") || needle.includes(".")
    ? await findContactIdsByEmailFragment(needle)
    : [];

  const rows = await withPrismaRetry((prisma) =>
    prisma.contact.findMany({
      where: {
        status: "active",
        AND: [
          ...prismaLiveContactWhere.AND,
          {
            OR: [
              { fullName: { contains: needle, mode: "insensitive" } },
              { firstName: { contains: needle, mode: "insensitive" } },
              { lastName: { contains: needle, mode: "insensitive" } },
              { company: { name: { contains: needle, mode: "insensitive" } } },
              ...(emailIds.length > 0 ? [{ id: { in: emailIds } }] : []),
            ],
          },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        fullName: true,
        emails: true,
        companyId: true,
        company: { select: { id: true, name: true } },
      },
      take: 40,
    }),
  );

  const hits: ContactSearchHit[] = rows.map((row) => ({
    id: toContactTrackingId(row.id),
    name: displayName(row),
    email: pickPrimaryEmail(row.emails),
    companyId: row.companyId,
    companyName: row.company?.name?.trim() || "No company yet",
  }));

  return hits
    .sort((a, b) => rankHit(b, needle) - rankHit(a, needle) || a.name.localeCompare(b.name))
    .slice(0, 12);
}
