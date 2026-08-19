import { Buffer } from "buffer";
import { getPrisma } from "@/lib/prisma";
import { ingestEmailAttachmentToCompanySmartDocs } from "@/lib/smartdocs-ingestion";
import { resolveOpportunityRelationId } from "@/lib/smartdocs-resolve-opportunity-relation-id";
import type { M365AttachmentMeta } from "@/lib/m365-client";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function run(): Promise<void> {
  process.env.SHAREPOINT_TRANSPORT = process.env.SHAREPOINT_TRANSPORT ?? "local";

  const prisma = getPrisma();

  const company = await prisma.company.create({
    data: {
      name: "Harness Co (CI)",
      code: `CO-HARNESS-${Date.now()}`,
      types: ["Prospect"],
      status: "active",
    },
  });

  const opportunity = await prisma.opportunity.create({
    data: {
      companyId: company.id,
      ownerId: "harness-owner",
      name: `Harness Opportunity ${Date.now()}`,
      code: `PL-HARNESS-${Date.now()}`,
      stage: "prospecting",
      status: "open",
      value: 100,
      currency: "USD",
    },
  });

  const emailMessage = await prisma.emailMessageRecord.create({
    data: {
      externalMessageId: `harness-ext-${Date.now()}`,
      conversationId: `harness-conv-${Date.now()}`,
      subject: "Harness email",
      senderEmail: "sender@harness.local",
      recipientEmails: [],
      sentAt: new Date(),
      sentiment: "neutral",
      isOutbound: false,
      m365CategoryName: null,
      isDeletedInSource: false,
      bodyPreview: "Harness body",
    },
  });

  const attachment: M365AttachmentMeta = {
    id: `att-${Date.now()}`,
    name: "doc-harness.pdf",
    contentType: "application/pdf",
    size: 123,
    contentBytes: Buffer.from("hello smartdocs").toString("base64"),
  };

  // Case 1: invalid linkedDealId should never become an FK value.
  const resolvedNull = await resolveOpportunityRelationId("NOT-A-REAL-OPPORTUNITY");
  assert(resolvedNull === null, "Expected resolver to return null for invalid opportunity key");

  // Should not throw FK constraint when opportunityId is null.
  const docNull = await ingestEmailAttachmentToCompanySmartDocs({
    companyId: company.id,
    companyName: company.name,
    opportunityId: resolvedNull,
    emailMessageId: emailMessage.id,
    attachment,
  });
  assert(docNull.opportunityId === null, "Expected stored DocumentRecord.opportunityId to be null");

  // Case 2: by id should resolve and store.
  const resolvedById = await resolveOpportunityRelationId(opportunity.id);
  assert(resolvedById === opportunity.id, "Expected resolver to return opportunity.id");

  const docById = await ingestEmailAttachmentToCompanySmartDocs({
    companyId: company.id,
    companyName: company.name,
    opportunityId: resolvedById,
    emailMessageId: emailMessage.id,
    attachment: { ...attachment, id: `att-${Date.now()}-2` },
  });
  assert(
    docById.opportunityId === opportunity.id,
    "Expected stored DocumentRecord.opportunityId to match resolved opportunity.id",
  );

  // Case 3: by code should resolve.
  const resolvedByCode = await resolveOpportunityRelationId(opportunity.code);
  assert(
    resolvedByCode === opportunity.id,
    "Expected resolver to return opportunity.id from code",
  );

  await ingestEmailAttachmentToCompanySmartDocs({
    companyId: company.id,
    companyName: company.name,
    opportunityId: resolvedByCode,
    emailMessageId: emailMessage.id,
    attachment: { ...attachment, id: `att-${Date.now()}-3` },
  });

  console.log("[harness] OK - SmartDocs attachment filing relation safety checks passed");
}

void run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[harness] FAILED", err);
    process.exit(1);
  });

