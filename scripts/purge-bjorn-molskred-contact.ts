/**
 * One-shot: remove the mistaken Contact Registry record for Bjørn Molskred
 * and associated synced emails. Does not touch the internal SmartCRM user.
 *
 * Usage:
 *   npx tsx scripts/purge-bjorn-molskred-contact.ts
 *   npx tsx scripts/purge-bjorn-molskred-contact.ts --apply
 */
import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(process.cwd(), ".env") });

import { getPrisma } from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");
const KNOWN_INTERNAL_EMAIL = "bjorn.moldskred@standard.bio";

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

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function isInternalAddress(email: string): boolean {
  const domain = email.split("@")[1] ?? "";
  return (
    domain === "standard.bio" ||
    domain.endsWith(".standard.bio") ||
    domain === "standardbio.com" ||
    domain === "standardbio.no"
  );
}

async function main() {
  const prisma = getPrisma();

  try {
    const contacts = await prisma.contact.findMany({
      where: {
        OR: [
          { fullName: { contains: "Moldskred", mode: "insensitive" } },
          { lastName: { contains: "Moldskred", mode: "insensitive" } },
          { fullName: { contains: "Molskred", mode: "insensitive" } },
          { lastName: { contains: "Molskred", mode: "insensitive" } },
        ],
      },
      select: {
        id: true,
        fullName: true,
        firstName: true,
        lastName: true,
        status: true,
        emails: true,
        companyId: true,
        m365GraphId: true,
        createdAt: true,
        company: { select: { id: true, name: true } },
      },
    });

    const allContacts = await prisma.contact.findMany({
      select: { id: true, fullName: true, emails: true, status: true },
    });
    const byEmail = allContacts.filter((row) =>
      contactAddresses(row.emails).includes(KNOWN_INTERNAL_EMAIL),
    );

    const unique = new Map<string, (typeof contacts)[number] | (typeof byEmail)[number]>();
    for (const row of [...contacts, ...byEmail]) unique.set(row.id, row);
    const matched = [...unique.values()];

    console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}`);
    console.log(`Matched contacts: ${matched.length}`);
    console.log(JSON.stringify(matched, null, 2));

    if (matched.length === 0) {
      const leftoverMail = await prisma.emailMessageRecord.findMany({
        where: {
          OR: [
            { senderEmail: { equals: KNOWN_INTERNAL_EMAIL, mode: "insensitive" } },
            { recipientEmails: { has: KNOWN_INTERNAL_EMAIL } },
          ],
        },
        select: {
          id: true,
          subject: true,
          senderEmail: true,
          recipientEmails: true,
          contactId: true,
          sentAt: true,
        },
        take: 20,
        orderBy: { sentAt: "desc" },
      });
      const contactCount = await prisma.contact.count();
      const emailCount = await prisma.emailMessageRecord.count();
      const nameHints = allContacts
        .filter((row) => {
          const hay = `${row.fullName ?? ""} ${JSON.stringify(row.emails)}`.toLowerCase();
      return (
            hay.includes("molsk") ||
            hay.includes("moldsk") ||
            hay.includes("bjørn") ||
            hay.includes("bjorn")
          );
        })
        .map((row) => ({ id: row.id, fullName: row.fullName, emails: row.emails, status: row.status }));
      console.log(`Registry size: ${contactCount} contacts, ${emailCount} emails`);
      console.log("Name/email hints:", JSON.stringify(nameHints, null, 2));
      console.log(
        `No contact found. Sample mail mentioning ${KNOWN_INTERNAL_EMAIL}:`,
        leftoverMail.length,
      );
      console.log(JSON.stringify(leftoverMail, null, 2));
      return;
    }

    if (matched.length > 1) {
      throw new Error(
        `Refusing to purge: expected one contact, found ${matched.length}`,
      );
    }

    const contact = matched[0];
    const addresses = [
      ...new Set([
        ...contactAddresses(contact.emails),
        KNOWN_INTERNAL_EMAIL,
        "bjorn.molskred@standard.bio",
      ]),
    ];

    const mailWhere = {
      OR: [
        { contactId: contact.id },
        { senderEmail: { in: addresses } },
        { recipientEmails: { hasSome: addresses } },
      ],
    };

    const messages = await prisma.emailMessageRecord.findMany({
      where: mailWhere,
      select: {
        id: true,
        externalMessageId: true,
        conversationId: true,
        subject: true,
        senderEmail: true,
        recipientEmails: true,
        contactId: true,
        opportunityId: true,
        projectId: true,
        sentAt: true,
      },
      orderBy: { sentAt: "desc" },
    });

    const internalOnly: typeof messages = [];
    const mixed: typeof messages = [];
    for (const message of messages) {
      const participants = [
        normalizeEmail(message.senderEmail),
        ...message.recipientEmails.map(normalizeEmail),
      ].filter(Boolean);
      const allInternal =
        participants.length > 0 && participants.every(isInternalAddress);
      if (allInternal) internalOnly.push(message);
      else mixed.push(message);
    }

    const meetingParticipants = await prisma.meetingParticipantRecord.findMany({
      where: {
        OR: [{ contactId: contact.id }, { email: { in: addresses } }],
      },
      select: { id: true, meetingId: true, email: true, name: true, contactId: true },
    });

    const influence = await prisma.stakeholderInfluenceProfile.count({
      where: { contactId: contact.id },
    });
    const decisionMakers = await prisma.decisionMakerProfile.count({
      where: { contactId: contact.id },
    });
    const sourceRels = await prisma.relationship.count({
      where: { sourceContactId: contact.id },
    });
    const targetRels = await prisma.relationship.count({
      where: { targetContactId: contact.id },
    });
    const documents = await prisma.documentRecord.count({
      where: { emailMessageId: { in: internalOnly.map((row) => row.id) } },
    });

    console.log(
      JSON.stringify(
        {
          contactId: contact.id,
          fullName: "fullName" in contact ? contact.fullName : undefined,
          addresses,
          emailsLinked: messages.length,
          internalOnlyEmails: internalOnly.length,
          mixedExternalEmails: mixed.length,
          documentsOnThoseEmails: documents,
          meetingParticipants: meetingParticipants.length,
          influenceProfiles: influence,
          decisionMakerProfiles: decisionMakers,
          relationships: sourceRels + targetRels,
          sampleInternal: internalOnly.slice(0, 8).map((row) => ({
            subject: row.subject,
            sentAt: row.sentAt,
            from: row.senderEmail,
            to: row.recipientEmails,
          })),
          sampleMixed: mixed.slice(0, 8).map((row) => ({
            subject: row.subject,
            sentAt: row.sentAt,
            from: row.senderEmail,
            to: row.recipientEmails,
            opportunityId: row.opportunityId,
            projectId: row.projectId,
          })),
        },
        null,
        2,
      ),
    );

    if (!APPLY) {
      console.log("Dry run only. Re-run with --apply to delete.");
      return;
    }

    // Purge internal-only mail so Graph delta cannot resurrect it.
    // Do not conversation-exclude threads that also contain customer mail.
    const mixedConversationIds = new Set(mixed.map((row) => row.conversationId));
    for (const row of internalOnly) {
      if (row.externalMessageId) {
        await prisma.emailIngestExclusion.upsert({
          where: { externalMessageId: row.externalMessageId },
          create: {
            externalMessageId: row.externalMessageId,
            conversationId: row.conversationId,
            reason: "user_purge",
          },
          update: {
            conversationId: row.conversationId,
            reason: "user_purge",
          },
        });
      }
    }
    const conversationIds = [
      ...new Set(
        internalOnly
          .map((row) => row.conversationId)
          .filter((id) => id && !mixedConversationIds.has(id)),
      ),
    ];
    for (const conversationId of conversationIds) {
      const existing = await prisma.emailIngestExclusion.findFirst({
        where: { conversationId, externalMessageId: null },
        select: { id: true },
      });
      if (!existing) {
        await prisma.emailIngestExclusion.create({
          data: {
            conversationId,
            externalMessageId: null,
            reason: "user_purge",
          },
        });
      }
    }

    const deletedMail =
      internalOnly.length > 0
        ? await prisma.emailMessageRecord.deleteMany({
            where: { id: { in: internalOnly.map((row) => row.id) } },
          })
        : { count: 0 };

    await prisma.meetingParticipantRecord.updateMany({
      where: { contactId: contact.id },
      data: { contactId: null },
    });

    await prisma.contact.delete({ where: { id: contact.id } });

    console.log(
      JSON.stringify(
        {
          deletedInternalEmails: deletedMail.count,
          ingestExclusions: internalOnly.length,
          conversationExclusions: conversationIds.length,
          keptCustomerEmails: mixed.length,
          deletedContactId: contact.id,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
