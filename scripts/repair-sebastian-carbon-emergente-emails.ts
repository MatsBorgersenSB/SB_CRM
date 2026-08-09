/**
 * One-shot repair: Sebastian Shrady / Carbon Emergente mail must not stay linked
 * to VEAS Test Pilot (PL-1001) or show that Outlook category in SmartCRM.
 *
 * Usage: npx tsx scripts/repair-sebastian-carbon-emergente-emails.ts
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });

import { getPrisma } from "../src/lib/prisma";

const PROJECT_ID = "PRJ-CARBON-EMERGENTE";
const PROJECT_NAME = "Carbon Emergente";

function contactAddresses(emails: unknown): string[] {
  if (!Array.isArray(emails)) return [];
  return [
    ...new Set(
      emails
        .map((entry) => {
          if (!entry || typeof entry !== "object") return "";
          const address = (entry as { address?: unknown }).address;
          return typeof address === "string" ? address.trim().toLowerCase() : "";
        })
        .filter(Boolean),
    ),
  ];
}

async function main() {
  const prisma = getPrisma();

  try {
    const veas = await prisma.opportunity.findFirst({
      where: {
        OR: [
          { code: "PL-1001" },
          { name: { contains: "VEAS", mode: "insensitive" } },
        ],
      },
      select: { id: true, code: true, name: true },
    });

    const sebastian = await prisma.contact.findFirst({
      where: {
        status: "active",
        OR: [
          { fullName: { contains: "Sebastian Shrady", mode: "insensitive" } },
          { lastName: { contains: "Shrady", mode: "insensitive" } },
        ],
      },
      select: { id: true, fullName: true, emails: true },
    });

    if (!sebastian) {
      throw new Error("Sebastian Shrady contact not found");
    }

    const addresses = contactAddresses(sebastian.emails);
    console.log("Contact:", sebastian.fullName, sebastian.id, addresses);
    console.log("VEAS opportunity:", veas);

    const participantFilter = {
      OR: [
        { contactId: sebastian.id },
        ...(addresses.length > 0
          ? [
              { senderEmail: { in: addresses } },
              { recipientEmails: { hasSome: addresses } },
            ]
          : []),
      ],
    };

    const before = await prisma.emailMessageRecord.count({
      where: participantFilter,
    });
    console.log("Sebastian-related messages:", before);

    const linkedProject = await prisma.emailMessageRecord.updateMany({
      where: participantFilter,
      data: {
        projectId: PROJECT_ID,
        projectName: PROJECT_NAME,
      },
    });
    console.log("Set project Carbon Emergente:", linkedProject.count);

    const clearVeas =
      veas != null
        ? await prisma.emailMessageRecord.updateMany({
            where: {
              AND: [participantFilter, { opportunityId: veas.id }],
            },
            data: {
              opportunityId: null,
              m365CategoryName: null,
            },
          })
        : { count: 0 };
    console.log("Cleared VEAS opportunity links:", clearVeas.count);

    const clearCategory = await prisma.emailMessageRecord.updateMany({
      where: {
        AND: [
          participantFilter,
          {
            OR: [
              { m365CategoryName: { contains: "VEAS", mode: "insensitive" } },
              {
                m365CategoryName: {
                  contains: "Test Pilot",
                  mode: "insensitive",
                },
              },
            ],
          },
        ],
      },
      data: { m365CategoryName: null },
    });
    console.log("Cleared VEAS category labels:", clearCategory.count);

    const projectResidue = await prisma.emailMessageRecord.updateMany({
      where: {
        projectId: PROJECT_ID,
        OR: [
          ...(veas ? [{ opportunityId: veas.id as string }] : []),
          { m365CategoryName: { contains: "VEAS", mode: "insensitive" } },
          {
            m365CategoryName: { contains: "Test Pilot", mode: "insensitive" },
          },
        ],
      },
      data: {
        opportunityId: null,
        m365CategoryName: null,
      },
    });
    console.log("Cleared VEAS residue on project threads:", projectResidue.count);

    const sample = await prisma.emailMessageRecord.findMany({
      where: participantFilter,
      select: {
        subject: true,
        opportunityId: true,
        projectId: true,
        projectName: true,
        m365CategoryName: true,
      },
      take: 5,
      orderBy: { sentAt: "desc" },
    });
    console.log("Sample after repair:", JSON.stringify(sample, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
