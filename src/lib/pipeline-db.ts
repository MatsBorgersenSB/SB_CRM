import { promises as fs } from "fs";
import path from "path";
import { defaultAnalytics } from "@/lib/analytics-data";
import { defaultActivities } from "@/lib/activities-data";
import { activitiesNeedMigration, isLegacyInteraction, migrateLegacyInteraction } from "@/lib/activity-migration";
import { activityMatchesContact } from "@/lib/activity-utils";
import type { Interaction } from "@/lib/interactions-data";
import { contactsNeedMigration, migrateLegacyContact } from "@/lib/contact-migration";
import { nextActivityId, nextActivitySharePointId, nextCompanyTrackingId, nextContactId, nextContactSharePointId, nextPipelineId, nextSharePointListId, type NewCompanyInput, type NewContactInput } from "@/lib/entity-id";
import type { CreateOpportunityInput } from "@/types/deal";
import { offeringIdsFromInput } from "@/lib/offering-intelligence";
import { defaultCompanies } from "@/lib/companies-data";
import { defaultInventory } from "@/lib/inventory-data";
import { defaultCommercialPackages } from "@/lib/commercial-packages-data";
import { initialPipelines } from "@/lib/pipelines-data";
import type { AnalyticsDb } from "@/lib/analytics-data";
import type { Company } from "@/lib/companies-data";
import { resolveAccountOwner } from "@/lib/company-owner";
import { normalizeCompanySectors } from "@/lib/company-sectors";
import { buildContactTitle } from "@/types/contact";
import type { Contact } from "@/types/contact";
import type { EmploymentStatus, TransferContactInput } from "@/types/contact-lifecycle";
import {
  buildCurrentCareerEntry,
  countPreservedReferences,
  lifecycleId,
} from "@/lib/contact-lifecycle-engine";
import type { InventoryDb } from "@/lib/inventory-data";
import type { PipelineDatabase } from "@/types/database";
import type { Activity } from "@/types/activity";
import type { CreateActivityInput } from "@/types/activity";

import type { PipelineRow } from "@/types/pipeline";
import type { CommercialPackage } from "@/types/commercial-package";
import type { CreateCommercialPackageInput } from "@/types/commercial-package-input";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";
import { buildDefaultSmartDocsLibrary } from "@/lib/smartdocs-library-data";
import { assignDocumentSetToLibrary, findDocumentSetForFile, generateDocumentSetId } from "@/lib/document-set-engine";
import {
  buildCompanyDocumentContext,
  buildCompanySmartDocLibraryRecord,
  buildSmartDocLibraryRecord,
} from "@/lib/smartdoc-library-engine";
import type { CreateSmartDocInput } from "@/types/smartdoc-library";
import { isCompanyOwnedSmartDoc } from "@/types/smartdoc-library";
import type { DeepResearchBriefing } from "@/types/deep-research";
import type { ResearchReport, StoredResearchReport } from "@/types/research-report";
import {
  buildResearchReportFromBriefing,
  reportSearchableText,
} from "@/lib/research-report-engine";
import { defaultOutlookEvidence } from "@/data/outlook-evidence-data";
import type { OutlookEvidenceRecord } from "@/types/outlook-reconciliation";

/** Bundled seed/source of truth checked into the repo. */
const BUNDLED_DB_PATH = path.join(process.cwd(), "src/data/pipeline-db.json");

/**
 * On Vercel the deployment FS is read-only. Persist mutations under /tmp so
 * local-transport writes do not fail with EROFS. Data is instance-local;
 * Prisma remains the durable registry when available.
 */
const DB_PATH =
  process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME
    ? path.join("/tmp", "pipeline-db.json")
    : BUNDLED_DB_PATH;

const DEPARTURE_EMPLOYMENT_STATUSES = new Set([
  "Former Employee",
  "Left Company",
  "Retired",
]);

function defaultDatabase(): PipelineDatabase {
  return {
    pipelines: initialPipelines,
    inventory: defaultInventory,
    companies: defaultCompanies,
    analytics: defaultAnalytics,
    activities: defaultActivities,
    commercialPackages: defaultCommercialPackages,
    smartDocsLibrary: buildDefaultSmartDocsLibrary(
      initialPipelines,
      defaultCompanies,
      defaultCommercialPackages,
    ),
    outlookEvidence: defaultOutlookEvidence,
  };
}

async function writeDb(database: PipelineDatabase): Promise<void> {
  await fs.writeFile(DB_PATH, JSON.stringify(database, null, 2), "utf-8");
}

async function migrateLegacyArray(parsed: PipelineRow[]): Promise<PipelineDatabase> {
  const database: PipelineDatabase = {
    pipelines: parsed,
    inventory: defaultInventory,
    companies: defaultCompanies,
    analytics: defaultAnalytics,
    activities: defaultActivities,
    commercialPackages: defaultCommercialPackages,
    smartDocsLibrary: buildDefaultSmartDocsLibrary(
      parsed,
      defaultCompanies,
      defaultCommercialPackages,
    ),
  };

  await writeDb(database);
  return database;
}

async function readDbFile(): Promise<string> {
  try {
    return await fs.readFile(DB_PATH, "utf-8");
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    if (code === "ENOENT" && DB_PATH !== BUNDLED_DB_PATH) {
      return fs.readFile(BUNDLED_DB_PATH, "utf-8");
    }
    throw error;
  }
}

async function ensureDb(): Promise<PipelineDatabase> {
  try {
    const raw = await readDbFile();
    const parsed: unknown = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return migrateLegacyArray(parsed as PipelineRow[]);
    }

    const database = parsed as Partial<PipelineDatabase>;
    let migrated = false;

    if (!database.pipelines || !database.inventory) {
      const rebuilt = defaultDatabase();
      await writeDb(rebuilt);
      return rebuilt;
    }

    if (!database.companies) {
      database.companies = defaultCompanies;
      migrated = true;
    }

    if (!database.analytics) {
      database.analytics = defaultAnalytics;
      migrated = true;
    }

    if (!database.activities) {
      if (database.interactions?.length) {
        let nextId = 1;
        database.activities = database.interactions.map((raw) => {
          const migrated = isLegacyInteraction(raw)
            ? migrateLegacyInteraction(raw, nextId++)
            : (raw as unknown as Activity);
          return migrated;
        });
      } else {
        database.activities = defaultActivities;
      }
      migrated = true;
    }

    if (database.activities && activitiesNeedMigration(database.activities)) {
      let nextId = nextActivitySharePointId(database.activities as Activity[]);
      database.activities = database.activities.map((raw) => {
        if (!isLegacyInteraction(raw)) return raw as Activity;
        const migrated = migrateLegacyInteraction(raw, nextId);
        nextId += 1;
        return migrated;
      });
      migrated = true;
    }

    if (database.activities?.length) {
      let memoryEnriched = false;
      database.activities = database.activities.map((activity) => {
        const row = activity as Activity;
        const seed = defaultActivities.find((s) => s.ActivityID === row.ActivityID);
        if (!seed || row.Summary) return row;
        memoryEnriched = true;
        return {
          ...row,
          Summary: seed.Summary,
          KeyDecisions: seed.KeyDecisions,
          AgreedActions: seed.AgreedActions,
          Risks: seed.Risks,
          LinkedDocuments: seed.LinkedDocuments,
          LinkedDeals: seed.LinkedDeals,
          LinkedContacts: seed.LinkedContacts,
        };
      });
      if (memoryEnriched) migrated = true;
    }

    if (database.companies?.some((company) => !("CompanyID" in company))) {
      database.companies = defaultCompanies;
      migrated = true;
    }

    if (database.companies?.some((company) => !company.contacts)) {
      database.companies = database.companies.map((company) => {
        if (company.contacts) return company;

        const seed = defaultCompanies.find(
          (item) => item.CompanyID === company.CompanyID,
        );
        return {
          ...company,
          contacts: seed?.contacts ?? [],
        };
      });
      migrated = true;
    }

    if (database.companies?.some((company) => !("Email" in company))) {
      database.companies = database.companies.map((company) => ({
        ...company,
        Email: (company as Company).Email ?? "",
      }));
      migrated = true;
    }

    if (
      database.companies?.some(
        (company) => company.contacts && contactsNeedMigration(company.contacts),
      )
    ) {
      let nextId = nextContactSharePointId(database.companies as Company[]);
      database.companies = database.companies.map((company) => {
        if (!company.contacts?.length || !contactsNeedMigration(company.contacts)) {
          return company;
        }

        const contacts = company.contacts.map((raw) => {
          const migrated = migrateLegacyContact(raw, company, nextId);
          nextId += 1;
          return migrated;
        });

        return { ...company, contacts };
      });
      migrated = true;
    }

    if (!database.commercialPackages) {
      database.commercialPackages = defaultCommercialPackages;
      migrated = true;
    }

    if (!database.smartDocsLibrary) {
      database.smartDocsLibrary = buildDefaultSmartDocsLibrary(
        database.pipelines,
        database.companies ?? defaultCompanies,
        database.commercialPackages ?? defaultCommercialPackages,
      );
      migrated = true;
    }

    if (!database.researchReports) {
      database.researchReports = [];
      migrated = true;
    }

    if (
      database.commercialPackages?.some(
        (record) => !("DocumentSetID" in record) || !record.DocumentSetID,
      )
    ) {
      database.commercialPackages = defaultCommercialPackages;
      database.smartDocsLibrary = buildDefaultSmartDocsLibrary(
        database.pipelines,
        database.companies ?? defaultCompanies,
        defaultCommercialPackages,
      );
      migrated = true;
    }

    if (
      database.smartDocsLibrary?.some((record) => record.SmartDocID.startsWith("SD-"))
    ) {
      database.smartDocsLibrary = buildDefaultSmartDocsLibrary(
        database.pipelines,
        database.companies ?? defaultCompanies,
        database.commercialPackages ?? defaultCommercialPackages,
      );
      migrated = true;
    }

    if (
      database.smartDocsLibrary?.some((record) => !record.DocumentSetID) &&
      database.commercialPackages?.every((record) => record.DocumentSetID)
    ) {
      database.smartDocsLibrary = assignDocumentSetToLibrary(
        database.smartDocsLibrary,
        database.commercialPackages,
      );
      migrated = true;
    }

    if (!database.outlookEvidence?.length) {
      database.outlookEvidence = defaultOutlookEvidence;
      migrated = true;
    }

    if (migrated) {
      await writeDb(database as PipelineDatabase);
    }

    return database as PipelineDatabase;
  } catch {
    const database = defaultDatabase();
    await fs.mkdir(path.dirname(DB_PATH), { recursive: true });
    await writeDb(database);
    return database;
  }
}

export async function readPipelines(): Promise<PipelineRow[]> {
  const database = await ensureDb();
  return database.pipelines;
}

export async function readInventory(): Promise<InventoryDb> {
  const database = await ensureDb();
  return database.inventory;
}

export async function readCompanies(): Promise<Company[]> {
  const database = await ensureDb();
  return database.companies;
}

export async function readAnalytics(): Promise<AnalyticsDb> {
  const database = await ensureDb();
  return database.analytics;
}

export async function readActivities(): Promise<Activity[]> {
  const database = await ensureDb();
  return database.activities;
}

/** @deprecated Use readActivities */
export async function readInteractions(): Promise<Interaction[]> {
  const activities = await readActivities();
  return activities as unknown as Interaction[];
}

export async function getActivityById(activityId: string): Promise<Activity | undefined> {
  const activities = await readActivities();
  return activities.find(
    (a) => a.ActivityID === activityId || String(a.id) === activityId,
  );
}

export async function createActivity(input: CreateActivityInput): Promise<Activity> {
  const database = await ensureDb();
  const companies = database.companies;

  let companyLookup = input.Company ?? null;
  if (companyLookup && "CompanyID" in companyLookup) {
    const companyId = companyLookup.CompanyID;
    const company = companies.find((c) => c.CompanyID === companyId);
    if (company) companyLookup = { Id: company.id, Title: company.Title };
  }

  let contactLookup = input.Contact ?? null;
  if (contactLookup && "ContactID" in contactLookup) {
    const contactId = contactLookup.ContactID;
    for (const company of companies) {
      const contact = company.contacts.find((c) => c.ContactID === contactId);
      if (contact) {
        contactLookup = { Id: contact.id, Title: contact.Title };
        if (!companyLookup) {
          companyLookup = { Id: company.id, Title: company.Title };
        }
        break;
      }
    }
  }

  let dealLookup = input.Deal ?? null;
  if (dealLookup && "DealID" in dealLookup) {
    const dealId = dealLookup.DealID;
    const deal = database.pipelines.find((p) => p.id === dealId);
    if (deal) dealLookup = { Id: 0, Title: deal.id };
  }

  const activity: Activity = {
    id: nextActivitySharePointId(database.activities),
    ActivityID: nextActivityId(database.activities),
    ActivityType: input.ActivityType,
    ActivityDate: input.ActivityDate,
    Subject: input.Subject,
    ActivityDescription: input.ActivityDescription,
    Summary: input.Summary,
    KeyDecisions: input.KeyDecisions ?? [],
    AgreedActions: input.AgreedActions ?? [],
    Risks: input.Risks ?? [],
    LinkedDocuments: input.LinkedDocuments ?? [],
    LinkedDeals: input.LinkedDeals ?? [],
    LinkedContacts: input.LinkedContacts ?? [],
    Stakeholders: input.Stakeholders ?? [],
    SharedWith: input.SharedWith ?? [],
    SmartAssistAssessment: input.SmartAssistAssessment,
    Company: companyLookup as Activity["Company"],
    Contact: contactLookup as Activity["Contact"],
    Deal: dealLookup as Activity["Deal"],
    ProjectId: input.ProjectId?.trim() || null,
    ProjectName: input.ProjectName?.trim() || null,
    ActivityOwner: input.ActivityOwner ?? null,
    ActionRequired: input.ActionRequired,
    NextAction: input.NextAction,
    NextActionDate: input.NextActionDate,
    ActionStatus: input.ActionStatus,
    ActionOutcome: input.ActionOutcome,
    DurationMinutes: input.DurationMinutes,
    Priority: input.Priority,
    M365Targets: input.M365Targets,
    OutlookMessageId: input.OutlookMessageId,
    OutlookConversationId: input.OutlookConversationId,
    ReconciledFromOutlook: input.ReconciledFromOutlook,
  };

  database.activities.push(activity);
  await writeDb(database);
  return activity;
}

export async function updateActivity(
  activityId: string,
  patch: Partial<Omit<Activity, "id" | "ActivityID">>,
): Promise<Activity> {
  const database = await ensureDb();
  const index = database.activities.findIndex(
    (a) => a.ActivityID === activityId || String(a.id) === activityId,
  );

  if (index === -1) {
    throw new Error(`Activity not found: ${activityId}`);
  }

  const updated: Activity = {
    ...database.activities[index],
    ...patch,
    ActivityID: database.activities[index].ActivityID,
    id: database.activities[index].id,
  };

  database.activities[index] = updated;
  await writeDb(database);
  return updated;
}

export async function readDatabase(): Promise<PipelineDatabase> {
  return ensureDb();
}

export async function updatePipeline(
  id: string,
  patch: Partial<PipelineRow>,
): Promise<PipelineRow> {
  const database = await ensureDb();
  const index = database.pipelines.findIndex((record) => record.id === id);

  if (index === -1) {
    throw new Error(`Pipeline not found: ${id}`);
  }

  const updated: PipelineRow = {
    ...database.pipelines[index],
    ...patch,
    id: database.pipelines[index].id,
  };

  database.pipelines[index] = updated;
  await writeDb(database);

  return updated;
}

/** Attach an existing opportunity to a company (JSON portfolio + Prisma when available). */
export async function linkCompanyToPipeline(
  companyId: string,
  pipelineId: string,
): Promise<Company> {
  const database = await ensureDb();
  const companyIndex = database.companies.findIndex(
    (company) => company.CompanyID === companyId,
  );
  if (companyIndex === -1) {
    throw new Error(`Company not found: ${companyId}`);
  }

  const pipeline = database.pipelines.find((row) => row.id === pipelineId);
  if (!pipeline) {
    // May exist only in Prisma — still try registry link below.
  }

  const company = database.companies[companyIndex];
  if (!company.pipelineIds.includes(pipelineId)) {
    database.companies[companyIndex] = {
      ...company,
      pipelineIds: [...company.pipelineIds, pipelineId],
    };
    await writeDb(database);
  }

  try {
    const { findPrismaCompanyByRouteKey } = await import("@/lib/resolve-company-route");
    const { withPrismaRetry } = await import("@/lib/prisma");
    const prismaCompany = await findPrismaCompanyByRouteKey(companyId);
    if (prismaCompany) {
      await withPrismaRetry((prisma) =>
        prisma.opportunity.updateMany({
          where: {
            OR: [{ id: pipelineId }, { code: pipelineId }],
          },
          data: { companyId: prismaCompany.id },
        }),
      );
    }
  } catch (error) {
    console.warn(
      "[pipeline-db] Prisma company↔opportunity link skipped:",
      error instanceof Error ? error.message : error,
    );
  }

  return database.companies[companyIndex];
}

export async function createPipeline(
  input: CreateOpportunityInput,
): Promise<PipelineRow> {
  const database = await ensureDb();
  const companyIndex = database.companies.findIndex(
    (company) => company.CompanyID === input.companyId,
  );

  if (companyIndex === -1) {
    throw new Error(`Company not found: ${input.companyId}`);
  }

  const assetName = input.assetName.trim();
  if (!assetName) {
    throw new Error("Opportunity name is required");
  }

  const offeringIds = offeringIdsFromInput(input.offeringIds);
  if (offeringIds.length === 0) {
    throw new Error("Select at least one Standard Bio offering");
  }

  const id = nextPipelineId(database.pipelines);
  const salesValue =
    typeof input.salesValue === "number" && Number.isFinite(input.salesValue)
      ? Math.max(0, input.salesValue)
      : 0;
  const expectedCloseDate = input.expectedCloseDate?.trim() || undefined;

  const created: PipelineRow = {
    id,
    assetName,
    companyRole: input.companyRole,
    targetFeedstock: "",
    reactorDesignCapacity: 0,
    currentMilestone: "Opportunity opened",
    status: "Prospecting",
    salesValue,
    currency: input.currency ?? "EUR",
    probability: salesValue > 0 ? 15 : 10,
    offeringIds,
    ...(expectedCloseDate ? { expectedCloseDate } : {}),
    team: [],
  };

  database.pipelines.push(created);

  const company = database.companies[companyIndex];
  if (!company.pipelineIds.includes(id)) {
    database.companies[companyIndex] = {
      ...company,
      pipelineIds: [...company.pipelineIds, id],
    };
  }

  await writeDb(database);
  return created;
}

export async function updateCompanyContact(
  companyId: string,
  contactId: string,
  patch: Partial<
    Pick<
      Contact,
      | "FirstName"
      | "LastName"
      | "Title"
      | "JobTitle"
      | "Role"
      | "Email"
      | "Phone"
      | "Mobile"
      | "LinkedInURL"
      | "Status"
      | "RelationshipLevel"
      | "IsSuspicious"
      | "EmploymentStatus"
      | "IsArchived"
      | "streetAddress"
      | "postalCode"
      | "stateRegion"
      | "countryCode"
      | "continent"
      | "city"
      | "country"
      | "timezone"
      | "isTimezoneOverridden"
      | "buyingRole"
      | "sentiment"
      | "influenceLevel"
      | "reportsToId"
      | "engagementCadence"
      | "backgroundNotes"
      | "preferredLanguage"
      | "CareerHistory"
      | "CompanyTransfers"
    >
  >,
): Promise<Contact> {
  const database = await ensureDb();
  const companyIndex = database.companies.findIndex(
    (company) => company.CompanyID === companyId,
  );

  if (companyIndex === -1) {
    throw new Error(`Company not found: ${companyId}`);
  }

  const contactIndex = database.companies[companyIndex].contacts.findIndex(
    (contact) => contact.ContactID === contactId,
  );

  if (contactIndex === -1) {
    throw new Error(`Contact not found: ${contactId}`);
  }

  const existing = database.companies[companyIndex].contacts[contactIndex];
  const FirstName = patch.FirstName ?? existing.FirstName;
  const LastName = patch.LastName ?? existing.LastName;
  const company = database.companies[companyIndex];

  let careerHistory = existing.CareerHistory ?? [buildCurrentCareerEntry(existing, company)];

  const roleChanged =
    (patch.Role !== undefined && patch.Role !== existing.Role) ||
    (patch.JobTitle !== undefined && patch.JobTitle !== existing.JobTitle);

  if (roleChanged) {
    const endDate = new Date().toISOString().slice(0, 10);
    careerHistory = closeOpenCareerEntries(careerHistory, company.CompanyID, endDate);
    careerHistory = [
      ...careerHistory,
      buildCurrentCareerEntry(
        {
          ...existing,
          Role: patch.Role ?? existing.Role,
          JobTitle: patch.JobTitle ?? existing.JobTitle,
        },
        company,
        endDate,
      ),
    ];
  }

  const employmentStatus = patch.EmploymentStatus ?? existing.EmploymentStatus;
  if (
    patch.EmploymentStatus &&
    DEPARTURE_EMPLOYMENT_STATUSES.has(patch.EmploymentStatus) &&
    patch.EmploymentStatus !== existing.EmploymentStatus
  ) {
    const endDate = new Date().toISOString().slice(0, 10);
    careerHistory = closeOpenCareerEntries(careerHistory, company.CompanyID, endDate);
  }

  const updatedContact: Contact = {
    ...existing,
    ...patch,
    ContactID: existing.ContactID,
    id: existing.id,
    FirstName,
    LastName,
    Title: patch.Title ?? buildContactTitle(FirstName, LastName),
    Company: existing.Company,
    CareerHistory: patch.CareerHistory ?? careerHistory,
  };

  database.companies[companyIndex].contacts[contactIndex] = updatedContact;
  await writeDb(database);

  return updatedContact;
}

export type UpdateCompanyPatch = Partial<
  Pick<
    Company,
    | "Title"
    | "Domain"
    | "Phone"
    | "Email"
    | "AddressLine1"
    | "AddressLine2"
    | "PostalCode"
    | "City"
    | "Country"
    | "stateRegion"
    | "countryCode"
    | "continent"
    | "organizationNumber"
    | "vatNumber"
    | "Industry"
    | "Sectors"
    | "Status"
    | "ParentCompany"
    | "CompanyTypes"
    | "Notes"
    | "Tags"
    | "AccountOwner"
  >
>;

export async function updateCompany(
  companyId: string,
  patch: UpdateCompanyPatch,
): Promise<Company> {
  const database = await ensureDb();
  const companyIndex = database.companies.findIndex(
    (company) => company.CompanyID === companyId,
  );

  if (companyIndex === -1) {
    throw new Error(`Company not found: ${companyId}`);
  }

  const existing = database.companies[companyIndex];
  const nextTitle = patch.Title ?? existing.Title;

  const updated: Company = {
    ...existing,
    ...patch,
    Title: nextTitle,
    CompanyID: existing.CompanyID,
    id: existing.id,
    contacts: existing.contacts.map((contact) => ({
      ...contact,
      Company: contact.Company
        ? { ...contact.Company, Title: nextTitle }
        : contact.Company,
    })),
  };

  database.companies[companyIndex] = updated;
  await writeDb(database);

  return updated;
}

export async function createCompany(input: NewCompanyInput): Promise<Company> {
  const database = await ensureDb();
  const accountOwner = resolveAccountOwner(input.AccountOwner);

  if (!accountOwner.Title.trim()) {
    throw new Error("Account owner is required");
  }

  const trackingId = nextCompanyTrackingId(database.companies);
  const company: Company = {
    id: nextSharePointListId(database.companies),
    Title: input.Title,
    CompanyID: trackingId,
    code: trackingId,
    ParentCompany: input.ParentCompany ?? null,
    Domain: input.Domain,
    Industry: input.Industry,
    Sectors: normalizeCompanySectors(input.Sectors),
    CompanyTypes: input.CompanyTypes ?? (input.Status === "Prospecting" ? ["Prospect"] : ["Unclassified"]),
    Status: input.Status,
    AccountOwner: accountOwner,
    Phone: input.Phone,
    Email: input.Email ?? "",
    AddressLine1: input.AddressLine1 ?? "",
    AddressLine2: "",
    PostalCode: input.PostalCode ?? "",
    City: input.City,
    Country: input.Country ?? null,
    countryCode: input.countryCode ?? null,
    continent: input.continent ?? null,
    organizationNumber: input.organizationNumber ?? null,
    vatNumber: input.vatNumber ?? null,
    Notes: input.Notes,
    pipelineIds: [],
    contacts: [],
  };

  database.companies.push(company);
  await writeDb(database);

  return company;
}

export async function deleteCompanyContact(
  companyId: string,
  contactId: string,
): Promise<void> {
  const database = await ensureDb();
  const companyIndex = database.companies.findIndex(
    (company) => company.CompanyID === companyId,
  );

  if (companyIndex === -1) {
    throw new Error(`Company not found: ${companyId}`);
  }

  const contactIndex = database.companies[companyIndex].contacts.findIndex(
    (contact) => contact.ContactID === contactId,
  );

  if (contactIndex === -1) {
    throw new Error(`Contact not found: ${contactId}`);
  }

  database.companies[companyIndex].contacts.splice(contactIndex, 1);
  await writeDb(database);
}

export async function moveCompanyContact(
  contactId: string,
  targetCompanyId: string,
): Promise<Contact> {
  const database = await ensureDb();

  let sourceCompanyIndex = -1;
  let contactIndex = -1;

  for (let index = 0; index < database.companies.length; index += 1) {
    const foundIndex = database.companies[index].contacts.findIndex(
      (contact) => contact.ContactID === contactId,
    );
    if (foundIndex !== -1) {
      sourceCompanyIndex = index;
      contactIndex = foundIndex;
      break;
    }
  }

  if (sourceCompanyIndex === -1 || contactIndex === -1) {
    throw new Error(`Contact not found: ${contactId}`);
  }

  const targetCompanyIndex = database.companies.findIndex(
    (company) => company.CompanyID === targetCompanyId,
  );

  if (targetCompanyIndex === -1) {
    throw new Error(`Company not found: ${targetCompanyId}`);
  }

  if (sourceCompanyIndex === targetCompanyIndex) {
    return database.companies[sourceCompanyIndex].contacts[contactIndex];
  }

  const [contact] = database.companies[sourceCompanyIndex].contacts.splice(
    contactIndex,
    1,
  );
  const targetCompany = database.companies[targetCompanyIndex];
  const movedContact: Contact = {
    ...contact,
    Company: { Id: targetCompany.id, Title: targetCompany.Title },
  };

  database.companies[targetCompanyIndex].contacts.push(movedContact);
  await writeDb(database);

  return movedContact;
}

function findContactLocation(database: PipelineDatabase, contactId: string): {
  companyIndex: number;
  contactIndex: number;
} | null {
  for (let companyIndex = 0; companyIndex < database.companies.length; companyIndex += 1) {
    const contactIndex = database.companies[companyIndex].contacts.findIndex(
      (contact) => contact.ContactID === contactId,
    );
    if (contactIndex !== -1) {
      return { companyIndex, contactIndex };
    }
  }
  return null;
}

function closeOpenCareerEntries(
  history: NonNullable<Contact["CareerHistory"]>,
  companyId: string,
  endDate: string,
): NonNullable<Contact["CareerHistory"]> {
  return history.map((entry) =>
    entry.companyId === companyId && entry.endDate === null
      ? { ...entry, endDate }
      : entry,
  );
}

export async function transferCompanyContactWithHistory(
  contactId: string,
  input: TransferContactInput,
): Promise<Contact> {
  const database = await ensureDb();
  const location = findContactLocation(database, contactId);

  if (!location) {
    throw new Error(`Contact not found: ${contactId}`);
  }

  const sourceCompany = database.companies[location.companyIndex];
  const targetCompanyIndex = database.companies.findIndex(
    (company) => company.CompanyID === input.targetCompanyId,
  );

  if (targetCompanyIndex === -1) {
    throw new Error(`Company not found: ${input.targetCompanyId}`);
  }

  if (location.companyIndex === targetCompanyIndex) {
    return database.companies[location.companyIndex].contacts[location.contactIndex];
  }

  const targetCompany = database.companies[targetCompanyIndex];
  const existing = sourceCompany.contacts[location.contactIndex];
  const transferDate = new Date().toISOString().slice(0, 10);

  const context = {
    companies: database.companies,
    pipelines: database.pipelines,
    activities: database.activities,
  };

  const preservedReferences = countPreservedReferences(existing, sourceCompany, context);

  const transferRecord = {
    id: lifecycleId("transfer"),
    previousCompanyId: sourceCompany.CompanyID,
    previousCompanyName: sourceCompany.Title,
    newCompanyId: targetCompany.CompanyID,
    newCompanyName: targetCompany.Title,
    transferDate,
    preservedReferences,
  };

  let careerHistory = closeOpenCareerEntries(
    existing.CareerHistory ?? buildCareerHistoryForContact(existing, sourceCompany),
    sourceCompany.CompanyID,
    transferDate,
  );

  careerHistory = [
    ...careerHistory,
    buildCurrentCareerEntry(
      {
        ...existing,
        Role: input.newRole ?? existing.Role,
        JobTitle: input.newJobTitle ?? existing.JobTitle,
      },
      targetCompany,
      transferDate,
    ),
  ];

  const [contact] = sourceCompany.contacts.splice(location.contactIndex, 1);

  const movedContact: Contact = {
    ...contact,
    Company: { Id: targetCompany.id, Title: targetCompany.Title },
    Role: input.newRole ?? contact.Role,
    JobTitle: input.newJobTitle ?? contact.JobTitle,
    EmploymentStatus: input.employmentStatus ?? contact.EmploymentStatus ?? "Active",
    CareerHistory: careerHistory,
    CompanyTransfers: [...(contact.CompanyTransfers ?? []), transferRecord],
  };

  database.companies[targetCompanyIndex].contacts.push(movedContact);
  await writeDb(database);

  return movedContact;
}

function buildCareerHistoryForContact(
  contact: Contact,
  company: Pick<Company, "CompanyID" | "Title">,
): NonNullable<Contact["CareerHistory"]> {
  return [buildCurrentCareerEntry(contact, company)];
}

export async function archiveCompanyContact(
  contactId: string,
  archived: boolean,
  employmentStatus?: EmploymentStatus,
): Promise<Contact> {
  const database = await ensureDb();
  const location = findContactLocation(database, contactId);

  if (!location) {
    throw new Error(`Contact not found: ${contactId}`);
  }

  const company = database.companies[location.companyIndex];
  const existing = company.contacts[location.contactIndex];

  const updatedContact: Contact = {
    ...existing,
    IsArchived: archived,
    EmploymentStatus:
      employmentStatus ??
      (archived ? "Former Employee" : existing.EmploymentStatus ?? "Active"),
  };

  database.companies[location.companyIndex].contacts[location.contactIndex] = updatedContact;
  await writeDb(database);

  return updatedContact;
}

export async function mergeCompanyContacts(
  primaryContactId: string,
  secondaryContactId: string,
): Promise<Contact> {
  const database = await ensureDb();

  const primaryLocation = findContactLocation(database, primaryContactId);
  const secondaryLocation = findContactLocation(database, secondaryContactId);

  if (!primaryLocation || !secondaryLocation) {
    throw new Error("Both contacts must exist to merge");
  }

  const primaryCompany = database.companies[primaryLocation.companyIndex];
  const secondaryCompany = database.companies[secondaryLocation.companyIndex];
  const primary = primaryCompany.contacts[primaryLocation.contactIndex];
  const secondary = secondaryCompany.contacts[secondaryLocation.contactIndex];

  const primaryDisplayName = primary.Title || buildContactTitle(primary.FirstName, primary.LastName);
  const secondaryDisplayName =
    secondary.Title || buildContactTitle(secondary.FirstName, secondary.LastName);

  for (const activity of database.activities) {
    if (
      activityMatchesContact(activity, secondaryContactId, secondary) ||
      activityMatchesContact(activity, secondaryContactId, {
        ...secondary,
        Title: secondaryDisplayName,
      })
    ) {
      activity.Contact = activity.Contact
        ? { ...activity.Contact, Title: primaryDisplayName }
        : { Id: primary.id, Title: primaryDisplayName };
    }
  }

  for (const pipeline of database.pipelines) {
    if (!pipeline.team) continue;
    pipeline.team = pipeline.team.map((member) =>
      member.contactId === secondaryContactId
        ? { ...member, contactId: primaryContactId }
        : member,
    );
  }

  const mergedCareer = [
    ...(primary.CareerHistory ?? buildCareerHistoryForContact(primary, primaryCompany)),
    ...(secondary.CareerHistory ?? buildCareerHistoryForContact(secondary, secondaryCompany)),
  ];

  const mergedTransfers = [
    ...(primary.CompanyTransfers ?? []),
    ...(secondary.CompanyTransfers ?? []),
  ];

  const mergedContact: Contact = {
    ...primary,
    Email: primary.Email || secondary.Email,
    Phone: primary.Phone || secondary.Phone,
    Mobile: primary.Mobile || secondary.Mobile,
    LinkedInURL: primary.LinkedInURL || secondary.LinkedInURL,
    CareerHistory: mergedCareer,
    CompanyTransfers: mergedTransfers,
  };

  database.companies[primaryLocation.companyIndex].contacts[primaryLocation.contactIndex] =
    mergedContact;
  database.companies[secondaryLocation.companyIndex].contacts.splice(
    secondaryLocation.contactIndex,
    1,
  );

  await writeDb(database);

  return mergedContact;
}

export async function deleteCompany(companyId: string): Promise<void> {
  const database = await ensureDb();
  const companyIndex = database.companies.findIndex(
    (company) => company.CompanyID === companyId,
  );

  if (companyIndex === -1) {
    throw new Error(`Company not found: ${companyId}`);
  }

  database.companies.splice(companyIndex, 1);
  await writeDb(database);
}

export async function createCompanyContact(
  companyId: string,
  input: NewContactInput,
): Promise<Contact> {
  const database = await ensureDb();
  const companyIndex = database.companies.findIndex(
    (company) => company.CompanyID === companyId,
  );

  if (companyIndex === -1) {
    throw new Error(`Company not found: ${companyId}`);
  }

  const company = database.companies[companyIndex];
  const contact: Contact = {
    id: nextContactSharePointId(database.companies),
    ContactID: nextContactId(database.companies),
    Title: buildContactTitle(input.FirstName, input.LastName),
    FirstName: input.FirstName,
    LastName: input.LastName,
    Company: { Id: company.id, Title: company.Title },
    JobTitle: input.JobTitle,
    Role: input.Role,
    Email: input.Email,
    Phone: input.Phone,
    Mobile: input.Mobile,
    LinkedInURL: input.LinkedInURL,
    Status: input.Status,
    RelationshipLevel: input.RelationshipLevel,
    buyingRole: input.buyingRole,
    sentiment: input.sentiment,
    influenceLevel: input.influenceLevel,
    reportsToId: input.reportsToId,
    streetAddress: input.streetAddress,
    postalCode: input.postalCode,
    stateRegion: input.stateRegion,
    countryCode: input.countryCode,
    continent: input.continent,
    city: input.city,
    country: input.country,
    timezone: input.timezone,
    isTimezoneOverridden: input.isTimezoneOverridden ?? false,
    engagementCadence: input.engagementCadence,
    backgroundNotes: input.backgroundNotes,
    preferredLanguage: input.preferredLanguage,
    EmploymentStatus: input.EmploymentStatus ?? "Active",
  };

  contact.CareerHistory = [buildCurrentCareerEntry(contact, company)];

  database.companies[companyIndex].contacts.push(contact);
  await writeDb(database);

  return contact;
}

export async function readCommercialPackages(): Promise<CommercialPackage[]> {
  const database = await ensureDb();
  return database.commercialPackages;
}

export async function readCommercialPackagesForDeal(
  dealId: string,
): Promise<CommercialPackage[]> {
  const packages = await readCommercialPackages();
  return packages.filter((record) => record.DealId === dealId);
}

export async function createCommercialPackage(
  input: CreateCommercialPackageInput,
): Promise<CommercialPackage> {
  const database = await ensureDb();
  const nextId =
    database.commercialPackages.reduce((max, record) => Math.max(max, record.id), 0) + 1;
  const nextPackageNumber =
    database.commercialPackages.reduce((max, record) => {
      const numeric = Number(record.PackageID.replace("PKG-", ""));
      return Number.isFinite(numeric) ? Math.max(max, numeric) : max;
    }, 9000) + 1;

  const record: CommercialPackage = {
    ...input,
    id: nextId,
    PackageID: input.PackageID ?? `PKG-${nextPackageNumber}`,
    DocumentSetID:
      input.DocumentSetID ??
      generateDocumentSetId(input.kind, database.commercialPackages),
    CreatedAt: input.CreatedAt ?? new Date().toISOString(),
    CreatedBy: input.CreatedBy ?? "SmartCRM",
  };

  database.commercialPackages.push(record);
  await writeDb(database);
  return record;
}

export async function updateCommercialPackage(
  packageId: string,
  patch: Partial<Omit<CommercialPackage, "id" | "PackageID">>,
): Promise<CommercialPackage> {
  const database = await ensureDb();
  const index = database.commercialPackages.findIndex(
    (record) => record.PackageID === packageId || String(record.id) === packageId,
  );

  if (index === -1) {
    throw new Error(`Commercial package not found: ${packageId}`);
  }

  const updated: CommercialPackage = {
    ...database.commercialPackages[index],
    ...patch,
    id: database.commercialPackages[index].id,
    PackageID: database.commercialPackages[index].PackageID,
    DocumentSetID: database.commercialPackages[index].DocumentSetID,
  };

  database.commercialPackages[index] = updated;
  await writeDb(database);
  return updated;
}

export async function readSmartDocsLibrary(): Promise<SmartDocLibraryRecord[]> {
  const database = await ensureDb();
  return database.smartDocsLibrary;
}

export async function readSmartDocsForDeal(dealId: string): Promise<SmartDocLibraryRecord[]> {
  const library = await readSmartDocsLibrary();
  const key = dealId.trim().toLowerCase();
  return library.filter((record) => {
    if (record.DealId?.toLowerCase() === key) return true;
    if (record.LinkedDealId?.toLowerCase() === key) return true;
    if (record.PlNumber?.toLowerCase() === key && record.Ownership !== "company") {
      return true;
    }
    return false;
  });
}

export async function readSmartDocsForCompany(
  companyId: string,
): Promise<SmartDocLibraryRecord[]> {
  const database = await ensureDb();
  const key = companyId.trim().toLowerCase();
  const company = database.companies.find(
    (row) =>
      row.CompanyID.trim().toLowerCase() === key ||
      row.code?.trim().toLowerCase() === key,
  );
  const pipelineIds = new Set(
    (company?.pipelineIds ?? []).map((id) => id.trim().toLowerCase()),
  );

  return database.smartDocsLibrary.filter((record) => {
    if (record.OwnerCompanyId?.trim().toLowerCase() === key) return true;
    if (
      company?.CompanyID &&
      record.OwnerCompanyId?.trim().toLowerCase() ===
        company.CompanyID.trim().toLowerCase()
    ) {
      return true;
    }
    if (company?.code && record.PlNumber?.toUpperCase() === company.code.toUpperCase()) {
      return true;
    }
    if (record.DealId && pipelineIds.has(record.DealId.trim().toLowerCase())) {
      return true;
    }
    return false;
  });
}

/** Resolve company from JSON seed or Prisma company registry. */
export async function resolveCompanyForSmartDocs(
  companyId: string,
): Promise<Company | undefined> {
  const key = companyId.trim();
  if (!key) return undefined;

  const database = await ensureDb();
  const fromJson = database.companies.find(
    (row) =>
      row.CompanyID === key ||
      row.code?.trim().toLowerCase() === key.toLowerCase() ||
      String(row.id) === key,
  );
  if (fromJson) return fromJson;

  try {
    const { findPrismaCompanyByRouteKey } = await import(
      "@/lib/resolve-company-route"
    );
    const { mapPrismaCompanyToApp } = await import("@/lib/prisma-mappers");
    const prismaCompany = await findPrismaCompanyByRouteKey(key);
    if (!prismaCompany) return undefined;
    return mapPrismaCompanyToApp(prismaCompany);
  } catch (error) {
    console.warn(
      "[smartdocs] Prisma company lookup failed:",
      error instanceof Error ? error.message : error,
    );
  }
  return undefined;
}

/** Resolve deal from JSON seed or Prisma opportunity registry. */
export async function resolvePipelineForSmartDocs(
  dealId: string,
): Promise<PipelineRow | undefined> {
  const key = dealId.trim();
  if (!key) return undefined;

  const database = await ensureDb();
  const fromJson = database.pipelines.find(
    (row) =>
      row.id === key ||
      row.code?.trim().toLowerCase() === key.toLowerCase(),
  );
  if (fromJson) return fromJson;

  try {
    const { findPrismaOpportunityByRouteKey } = await import(
      "@/lib/resolve-opportunity-route"
    );
    const { mapPrismaOpportunityToPipelineRow } = await import(
      "@/lib/prisma-mappers"
    );
    const prismaOpportunity = await findPrismaOpportunityByRouteKey(key);
    if (!prismaOpportunity) return undefined;
    return mapPrismaOpportunityToPipelineRow(prismaOpportunity);
  } catch (error) {
    console.warn(
      "[smartdocs] Prisma opportunity lookup failed:",
      error instanceof Error ? error.message : error,
    );
    return undefined;
  }
}

export async function createSmartDocLibraryRecord(
  dealId: string,
  input: CreateSmartDocInput,
): Promise<SmartDocLibraryRecord> {
  const database = await ensureDb();
  const pipelineIndex = database.pipelines.findIndex(
    (row) =>
      row.id === dealId ||
      row.code?.trim().toLowerCase() === dealId.trim().toLowerCase(),
  );

  let pipeline =
    pipelineIndex >= 0 ? database.pipelines[pipelineIndex] : undefined;

  if (!pipeline) {
    pipeline = await resolvePipelineForSmartDocs(dealId);
  }

  if (!pipeline) {
    throw new Error(`Pipeline not found: ${dealId}`);
  }

  const nextId =
    database.smartDocsLibrary.reduce((max, record) => Math.max(max, record.id), 0) + 1;

  const draft = buildSmartDocLibraryRecord(
    pipeline,
    database.companies,
    database.commercialPackages,
    database.smartDocsLibrary,
    input,
  );

  const assignedPackage = input.DocumentSetID
    ? database.commercialPackages.find((pkg) => pkg.DocumentSetID === input.DocumentSetID)
    : findDocumentSetForFile(
        draft.FileLeafRef,
        pipeline.id,
        database.commercialPackages,
        null,
      );

  const record: SmartDocLibraryRecord = {
    ...draft,
    id: nextId,
    DocumentSetID: input.DocumentSetID ?? assignedPackage?.DocumentSetID,
  };

  database.smartDocsLibrary.push(record);

  const packageIndex = assignedPackage
    ? database.commercialPackages.findIndex(
        (pkg) => pkg.PackageID === assignedPackage.PackageID,
      )
    : -1;

  if (packageIndex >= 0) {
    const pkg = database.commercialPackages[packageIndex];
    const alreadyMember = pkg.members.some(
      (member) => member.fileName === record.FileLeafRef,
    );
    if (!alreadyMember) {
      const role =
        record.DocCategory === "Commercial"
          ? "quotation"
          : record.DocCategory === "Technical"
            ? "technical"
            : "attachment";
      database.commercialPackages[packageIndex] = {
        ...pkg,
        members: [
          ...pkg.members,
          {
            role,
            Title: record.FileLeafRef,
            fileName: record.FileLeafRef,
            DocCategory: record.DocCategory,
            Revision: record.Revision,
            DealId: record.DealId ?? pipeline.id,
          },
        ],
      };
    }
  }

  // Only mutate JSON seed pipelines — Prisma opportunities stay in Neon.
  if (pipelineIndex >= 0) {
    database.pipelines[pipelineIndex] = {
      ...pipeline,
      ClientLookup: record.PlNumber,
      DocCategory: record.DocCategory,
      DocType: record.DocType,
      Revision: record.Revision,
      FileLeafRef: record.FileLeafRef,
    };
  }

  await writeDb(database);
  return record;
}

/**
 * Register a company-owned SmartDoc (FS-006). Does not invent a deal.
 * Supplier quotations and other company knowledge use CO-… identity.
 */
export async function createCompanySmartDocLibraryRecord(
  companyId: string,
  input: CreateSmartDocInput,
): Promise<SmartDocLibraryRecord> {
  const database = await ensureDb();
  let company =
    database.companies.find(
      (row) =>
        row.CompanyID === companyId ||
        row.code?.trim().toLowerCase() === companyId.trim().toLowerCase(),
    ) ?? (await resolveCompanyForSmartDocs(companyId));

  if (!company) {
    throw new Error(`Company not found: ${companyId}`);
  }

  // Refuse stuffing company SUQ into commercial package membership.
  if (input.DocumentSetID?.trim()) {
    throw new Error(
      "Company-owned SmartDocs cannot join opportunity Document Sets (PI/BQ/FQ). Leave DocumentSetID empty.",
    );
  }

  const nextId =
    database.smartDocsLibrary.reduce((max, record) => Math.max(max, record.id), 0) + 1;

  const context = buildCompanyDocumentContext(company);
  const draft = buildCompanySmartDocLibraryRecord(
    context,
    database.smartDocsLibrary,
    input,
  );

  if (!draft.OwnerCompanyId) {
    throw new Error("OwnerCompanyId is required for company-owned SmartDocs");
  }

  const record: SmartDocLibraryRecord = {
    ...draft,
    id: nextId,
  };

  if (!isCompanyOwnedSmartDoc(record)) {
    throw new Error("Failed to create company-owned SmartDoc ownership");
  }

  database.smartDocsLibrary.push(record);
  await writeDb(database);
  return record;
}

/**
 * Register a project-owned SmartDoc. Does not invent a deal/pipeline.
 * Files target /Projects/{Name} (or /Projects/{Company}/{Name}) when Graph is on.
 */
export async function createProjectSmartDocLibraryRecord(
  projectId: string,
  input: CreateSmartDocInput,
): Promise<SmartDocLibraryRecord> {
  const database = await ensureDb();
  const { readProjectById } = await import("@/lib/project-db");
  const project = await readProjectById(projectId);
  if (!project) {
    throw new Error(`Project not found: ${projectId}`);
  }

  if (input.DocumentSetID?.trim()) {
    throw new Error(
      "Project-owned SmartDocs cannot join opportunity Document Sets (PI/BQ/FQ). Leave DocumentSetID empty.",
    );
  }

  let company: Company | undefined;
  if (project.linkedCompanyId?.trim()) {
    company = await resolveCompanyForSmartDocs(project.linkedCompanyId);
  }

  const { buildProjectDocumentContext, buildProjectSmartDocLibraryRecord } =
    await import("@/lib/smartdoc-library-engine");

  const nextId =
    database.smartDocsLibrary.reduce((max, record) => Math.max(max, record.id), 0) + 1;

  const context = buildProjectDocumentContext(project, company);
  const draft = buildProjectSmartDocLibraryRecord(
    context,
    database.smartDocsLibrary,
    {
      ...input,
      LinkedProjectId: project.id,
      LinkedDealId: input.LinkedDealId ?? project.linkedDealId,
    },
  );

  const record: SmartDocLibraryRecord = {
    ...draft,
    id: nextId,
  };

  database.smartDocsLibrary.push(record);
  await writeDb(database);
  return record;
}

export async function readSmartDocsForProject(
  projectId: string,
): Promise<SmartDocLibraryRecord[]> {
  const library = await readSmartDocsLibrary();
  const key = projectId.trim().toLowerCase();
  return library.filter((record) => {
    if (record.LinkedProjectId?.trim().toLowerCase() === key) return true;
    if (
      record.Ownership === "project" &&
      record.PlNumber?.trim().toLowerCase() === key
    ) {
      return true;
    }
    return false;
  });
}

export async function updateSmartDocLibraryRecord(
  smartDocId: string,
  patch: Partial<Omit<SmartDocLibraryRecord, "id" | "SmartDocID">>,
): Promise<SmartDocLibraryRecord> {
  const database = await ensureDb();
  const index = database.smartDocsLibrary.findIndex(
    (record) => record.SmartDocID === smartDocId,
  );

  if (index === -1) {
    throw new Error(`SmartDoc not found: ${smartDocId}`);
  }

  const updated: SmartDocLibraryRecord = {
    ...database.smartDocsLibrary[index],
    ...patch,
    id: database.smartDocsLibrary[index].id,
    SmartDocID: database.smartDocsLibrary[index].SmartDocID,
  };

  database.smartDocsLibrary[index] = updated;
  await writeDb(database);
  return updated;
}

export async function readResearchReports(): Promise<StoredResearchReport[]> {
  const database = await ensureDb();
  return database.researchReports ?? [];
}

export async function getResearchReportById(
  reportId: string,
): Promise<StoredResearchReport | undefined> {
  const reports = await readResearchReports();
  return reports.find((r) => r.reportId === reportId || r.id === reportId);
}

export async function createResearchReport(
  briefing: DeepResearchBriefing,
  options: {
    generatedBy?: string;
    companyId?: string;
    dealId?: string;
    contactId?: string;
  } = {},
): Promise<StoredResearchReport> {
  const database = await ensureDb();
  const existing = database.researchReports ?? [];
  const report = buildResearchReportFromBriefing(briefing, {
    ...options,
    existingReportCount: existing.length,
  });

  const stored: StoredResearchReport = {
    ...report,
    fileLeafRef: `${report.reportId}_${report.docType.replace(/\s+/g, "-")}_${report.subject.replace(/\s+/g, "-")}.docx`,
    storedAt: new Date().toISOString(),
    searchableText: reportSearchableText(report),
  };

  const libraryRecord: SmartDocLibraryRecord = {
    id: database.smartDocsLibrary.length + 1,
    SmartDocID: report.reportId,
    DealId: options.dealId ?? null,
    OwnerCompanyId: options.companyId,
    Ownership: options.dealId ? "opportunity" : options.companyId ? "company" : undefined,
    PlNumber: options.dealId ?? options.companyId ?? report.reportId,
    ClientName: report.metadata.companyName ?? report.subject,
    DealName: options.dealId ?? report.subject,
    CommercialStage: report.typeLabel,
    CreatedAt: report.generatedAt,
    DocCategory: report.docCategory,
    DocType: report.docType,
    DocumentName: report.title,
    Revision: report.revision,
    FileLeafRef: stored.fileLeafRef,
  };

  database.researchReports = [...existing, stored];
  database.smartDocsLibrary.push(libraryRecord);
  await writeDb(database);
  return stored;
}

export async function storeResearchReport(report: ResearchReport): Promise<StoredResearchReport> {
  const database = await ensureDb();
  const existing = database.researchReports ?? [];
  const stored: StoredResearchReport = {
    ...report,
    fileLeafRef: `${report.reportId}_${report.docType.replace(/\s+/g, "-")}.docx`,
    storedAt: new Date().toISOString(),
    searchableText: reportSearchableText(report),
  };
  database.researchReports = [...existing, stored];
  await writeDb(database);
  return stored;
}

export async function readOutlookEvidence(): Promise<OutlookEvidenceRecord[]> {
  const database = await ensureDb();
  return database.outlookEvidence ?? defaultOutlookEvidence;
}

export async function updateOutlookEvidence(
  evidenceId: string,
  patch: Partial<Pick<OutlookEvidenceRecord, "reconciledAt">>,
): Promise<OutlookEvidenceRecord> {
  const database = await ensureDb();
  const index = (database.outlookEvidence ?? []).findIndex((row) => row.id === evidenceId);

  if (index === -1) {
    throw new Error(`Outlook evidence not found: ${evidenceId}`);
  }

  const updated: OutlookEvidenceRecord = {
    ...database.outlookEvidence![index],
    ...patch,
  };

  database.outlookEvidence![index] = updated;
  await writeDb(database);
  return updated;
}

export async function isM365Connected(): Promise<boolean> {
  const evidence = await readOutlookEvidence();
  return evidence.length > 0;
}
