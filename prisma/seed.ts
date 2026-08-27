import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma";
import {
  DEMO_SEED_OWNER_ID,
  DEMO_SEED_WORKFLOW_RULE_NAMES,
  prismaDemoSeedCompanyWhere,
  prismaDemoSeedOpportunityWhere,
} from "../src/lib/demo-seed-markers";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL must be set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

/**
 * Reality First: `prisma db seed` only removes invented demo records.
 * It never inserts companies, contacts, opportunities, or meetings.
 */
async function purgeDemoSeed() {
  const seedCompanies = await prisma.company.findMany({
    where: prismaDemoSeedCompanyWhere,
    select: { id: true, name: true, ownerId: true, website: true },
  });
  const seedCompanyIds = seedCompanies.map((row) => row.id);

  const seedOpportunities = await prisma.opportunity.findMany({
    where: prismaDemoSeedOpportunityWhere,
    select: { id: true, name: true },
  });
  const seedOpportunityIds = seedOpportunities.map((row) => row.id);

  const workflowExecutions = await prisma.workflowExecution.deleteMany({
    where: {
      OR: [
        { rule: { name: { in: [...DEMO_SEED_WORKFLOW_RULE_NAMES] } } },
        ...(seedCompanyIds.length > 0 ? [{ companyId: { in: seedCompanyIds } }] : []),
        ...(seedOpportunityIds.length > 0
          ? [{ opportunityId: { in: seedOpportunityIds } }]
          : []),
      ],
    },
  });

  const workflowRules = await prisma.workflowRule.deleteMany({
    where: { name: { in: [...DEMO_SEED_WORKFLOW_RULE_NAMES] } },
  });

  const expansionSignals = await prisma.expansionSignal.deleteMany({
    where: {
      OR: [
        ...(seedCompanyIds.length > 0 ? [{ companyId: { in: seedCompanyIds } }] : []),
        ...(seedOpportunityIds.length > 0
          ? [{ opportunityId: { in: seedOpportunityIds } }]
          : []),
        { title: { startsWith: "CAPEX Expansion" } },
        { title: { startsWith: "SmartDocs Maintenance" } },
        { title: { startsWith: "Delayed Contract Renewal" } },
      ],
    },
  });

  const accountHealth = await prisma.accountHealthRecord.deleteMany({
    where:
      seedCompanyIds.length > 0
        ? { companyId: { in: seedCompanyIds } }
        : { company: prismaDemoSeedCompanyWhere },
  });

  const documents = await prisma.documentRecord.deleteMany({
    where: {
      OR: [
        { externalAttachmentId: { startsWith: "seed-attach-" } },
        ...(seedOpportunityIds.length > 0
          ? [{ opportunityId: { in: seedOpportunityIds } }]
          : []),
      ],
    },
  });

  const emails = await prisma.emailMessageRecord.deleteMany({
    where: {
      OR: [
        { externalMessageId: { startsWith: "seed-email-" } },
        { conversationId: { startsWith: "seed-conv-" } },
        ...(seedOpportunityIds.length > 0
          ? [{ opportunityId: { in: seedOpportunityIds } }]
          : []),
      ],
    },
  });

  const meetings = await prisma.meetingRecord.deleteMany({
    where: {
      OR: [
        { externalEventId: { startsWith: "seed-meeting-" } },
        ...(seedCompanyIds.length > 0 ? [{ companyId: { in: seedCompanyIds } }] : []),
        ...(seedOpportunityIds.length > 0
          ? [{ opportunityId: { in: seedOpportunityIds } }]
          : []),
      ],
    },
  });

  const decisionProfiles = await prisma.decisionMakerProfile.deleteMany({
    where: {
      OR: [
        { contact: { m365GraphId: { startsWith: "seed-m365-" } } },
        ...(seedOpportunityIds.length > 0
          ? [{ opportunityId: { in: seedOpportunityIds } }]
          : []),
      ],
    },
  });

  const influenceProfiles = await prisma.stakeholderInfluenceProfile.deleteMany({
    where: {
      OR: [
        { contact: { m365GraphId: { startsWith: "seed-m365-" } } },
        ...(seedOpportunityIds.length > 0
          ? [{ opportunityId: { in: seedOpportunityIds } }]
          : []),
      ],
    },
  });

  const opportunities = await prisma.opportunity.deleteMany({
    where: prismaDemoSeedOpportunityWhere,
  });

  const contacts = await prisma.contact.deleteMany({
    where: {
      OR: [
        { m365GraphId: { startsWith: "seed-m365-" } },
        { ownerId: DEMO_SEED_OWNER_ID },
        ...(seedCompanyIds.length > 0 ? [{ companyId: { in: seedCompanyIds } }] : []),
      ],
    },
  });

  const companies = await prisma.company.deleteMany({
    where: prismaDemoSeedCompanyWhere,
  });

  return {
    companiesRemoved: seedCompanies.map((row) => row.name),
    counts: {
      workflowExecutions: workflowExecutions.count,
      workflowRules: workflowRules.count,
      expansionSignals: expansionSignals.count,
      accountHealth: accountHealth.count,
      documents: documents.count,
      emails: emails.count,
      meetings: meetings.count,
      decisionProfiles: decisionProfiles.count,
      influenceProfiles: influenceProfiles.count,
      opportunities: opportunities.count,
      contacts: contacts.count,
      companies: companies.count,
    },
  };
}

async function main() {
  console.log("Purging invented Prisma demo seed — no records will be inserted.");
  const result = await purgeDemoSeed();
  console.log("Demo seed purge complete:", result);
}

main()
  .catch((error) => {
    console.error("Demo seed purge failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
