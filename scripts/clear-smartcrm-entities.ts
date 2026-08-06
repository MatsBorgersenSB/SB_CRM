/**
 * Complete SmartCRM entity wipe — companies, contacts, opportunities, activities,
 * projects, and company-linked packages/docs/evidence.
 *
 * Run: npx tsx scripts/clear-smartcrm-entities.ts
 */
import "dotenv/config";
import { promises as fs } from "fs";
import path from "path";
import { withPrismaRetry, resetPrisma } from "../src/lib/prisma";

async function clearPrisma() {
  const before = await withPrismaRetry(async (prisma) => ({
    companies: await prisma.company.count(),
    contacts: await prisma.contact.count(),
    opportunities: await prisma.opportunity.count(),
    relationships: await prisma.relationship.count(),
    meetings: await prisma.meetingRecord.count(),
    emails: await prisma.emailMessageRecord.count(),
    documents: await prisma.documentRecord.count(),
    health: await prisma.accountHealthRecord.count(),
    signals: await prisma.expansionSignal.count(),
    workflows: await prisma.workflowExecution.count(),
  }));
  console.log("Prisma before:", before);

  await withPrismaRetry(async (prisma) => {
    await prisma.opportunityInsight.deleteMany();
    await prisma.stakeholderInfluenceProfile.deleteMany();
    await prisma.decisionMakerProfile.deleteMany();
    await prisma.documentRecord.deleteMany();
    await prisma.emailMessageRecord.deleteMany();
    await prisma.meetingCommitmentRecord.deleteMany();
    await prisma.meetingParticipantRecord.deleteMany();
    await prisma.meetingRecord.deleteMany();
    await prisma.expansionSignal.deleteMany();
    await prisma.accountHealthRecord.deleteMany();
    await prisma.workflowExecution.deleteMany();
    await prisma.opportunity.deleteMany();
    await prisma.relationshipInteraction.deleteMany();
    await prisma.relationship.deleteMany();
    await prisma.companyNote.deleteMany();

    await prisma.contact.updateMany({ data: { reportsToId: null } });
    await prisma.contact.deleteMany();

    await prisma.company.updateMany({ data: { parentCompanyId: null } });
    await prisma.company.deleteMany();
  });

  const after = await withPrismaRetry(async (prisma) => ({
    companies: await prisma.company.count(),
    contacts: await prisma.contact.count(),
    opportunities: await prisma.opportunity.count(),
    relationships: await prisma.relationship.count(),
    meetings: await prisma.meetingRecord.count(),
    emails: await prisma.emailMessageRecord.count(),
    documents: await prisma.documentRecord.count(),
    health: await prisma.accountHealthRecord.count(),
    signals: await prisma.expansionSignal.count(),
    workflows: await prisma.workflowExecution.count(),
  }));
  console.log("Prisma after:", after);
}

async function clearPipelineJson() {
  const dbPath = path.join(process.cwd(), "src/data/pipeline-db.json");
  const raw = await fs.readFile(dbPath, "utf-8");
  const database = JSON.parse(raw) as Record<string, unknown>;

  const companies = (database.companies as unknown[]) ?? [];
  const contactCount = companies.reduce((sum: number, row) => {
    const company = row as { contacts?: unknown[] };
    return sum + (company.contacts?.length ?? 0);
  }, 0);

  console.log("pipeline-db before:", {
    companies: companies.length,
    contacts: contactCount,
    pipelines: ((database.pipelines as unknown[]) ?? []).length,
    activities: ((database.activities as unknown[]) ?? []).length,
    commercialPackages: ((database.commercialPackages as unknown[]) ?? []).length,
    smartDocs: ((database.smartDocsLibrary as unknown[]) ?? []).length,
    outlookEvidence: ((database.outlookEvidence as unknown[]) ?? []).length,
  });

  database.companies = [];
  database.pipelines = [];
  database.activities = [];
  database.commercialPackages = [];
  database.smartDocsLibrary = [];
  database.outlookEvidence = [];
  database.researchReports = [];

  await fs.writeFile(dbPath, `${JSON.stringify(database, null, 2)}\n`, "utf-8");
  console.log("pipeline-db after: CRM entity collections emptied");
}

async function clearProjectsJson() {
  const dbPath = path.join(process.cwd(), "src/data/projects-db.json");
  let before = 0;
  try {
    const raw = await fs.readFile(dbPath, "utf-8");
    const parsed = JSON.parse(raw) as { projects?: unknown[] };
    before = parsed.projects?.length ?? 0;
  } catch {
    before = 0;
  }

  await fs.writeFile(dbPath, `${JSON.stringify({ projects: [] }, null, 2)}\n`, "utf-8");
  console.log(`projects-db: ${before} → 0`);
}

async function main() {
  try {
    await clearPrisma();
  } catch (error) {
    console.error(
      "Prisma clear failed:",
      error instanceof Error ? error.message : error,
    );
    await resetPrisma("clear-failed");
  }

  await clearPipelineJson();
  await clearProjectsJson();
  console.log("SmartCRM entity wipe complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
