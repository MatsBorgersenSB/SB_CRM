import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type CompanyType,
  type InfluenceLevel,
  type SentimentStance,
  type AuthorityClass,
  type VerificationState,
} from "@src/generated/prisma";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL must be set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const SEED_OWNER_ID = "seed-owner-commercial-01";

async function main() {
  console.log("Seeding SmartCRM core data…");

  // Idempotent cleanup of previous seed markers (m365GraphId / seed-meeting- prefix)
  await prisma.meetingRecord.deleteMany({
    where: { externalEventId: { startsWith: "seed-meeting-" } },
  });
  await prisma.decisionMakerProfile.deleteMany({
    where: { contact: { m365GraphId: { startsWith: "seed-m365-" } } },
  });
  await prisma.stakeholderInfluenceProfile.deleteMany({
    where: { contact: { m365GraphId: { startsWith: "seed-m365-" } } },
  });
  await prisma.opportunity.deleteMany({
    where: {
      name: { in: ["Circular Fiber Reactor", "Thermal Recovery System"] },
    },
  });
  await prisma.contact.deleteMany({
    where: { m365GraphId: { startsWith: "seed-m365-" } },
  });
  await prisma.company.deleteMany({
    where: { name: { in: ["Acme Renewables", "Global TechCorp"] } },
  });

  const acme = await prisma.company.create({
    data: {
      name: "Acme Renewables",
      industry: "Renewable Energy",
      size: "medium",
      types: ["customer", "prospect"] satisfies CompanyType[],
      status: "active",
      website: "https://acme-renewables.example",
      city: "Oslo",
      country: "Norway",
      ownerId: SEED_OWNER_ID,
      emails: [{ address: "info@acme-renewables.example", type: "work", isPrimary: true }],
      phoneNumbers: [{ number: "+47 21 00 00 01", type: "office", isPrimary: true }],
    },
  });

  const techcorp = await prisma.company.create({
    data: {
      name: "Global TechCorp",
      industry: "Industrial Technology",
      size: "large",
      types: ["prospect"] satisfies CompanyType[],
      status: "active",
      website: "https://global-techcorp.example",
      city: "Stockholm",
      country: "Sweden",
      ownerId: SEED_OWNER_ID,
      emails: [{ address: "hello@global-techcorp.example", type: "work", isPrimary: true }],
      phoneNumbers: [{ number: "+46 8 00 00 02", type: "office", isPrimary: true }],
    },
  });

  const [anna, bjorn, clara, david] = await Promise.all([
    prisma.contact.create({
      data: {
        firstName: "Anna",
        lastName: "Berg",
        fullName: "Anna Berg",
        jobTitle: "Plant Manager",
        preferredContactMethod: "email",
        status: "active",
        m365GraphId: "seed-m365-anna-berg",
        m365ImmutableId: "seed-imm-anna-berg",
        companyId: acme.id,
        ownerId: SEED_OWNER_ID,
        emails: [{ address: "anna.berg@acme-renewables.example", type: "work", isPrimary: true }],
        phoneNumbers: [{ number: "+47 90 11 22 33", type: "mobile", isPrimary: true }],
        personalNotes: "Met at IFAT — strong interest in circular fiber.",
      },
    }),
    prisma.contact.create({
      data: {
        firstName: "Bjorn",
        lastName: "Haugen",
        fullName: "Bjorn Haugen",
        jobTitle: "CFO",
        preferredContactMethod: "phone",
        status: "active",
        m365GraphId: "seed-m365-bjorn-haugen",
        m365ImmutableId: "seed-imm-bjorn-haugen",
        companyId: acme.id,
        ownerId: SEED_OWNER_ID,
        emails: [{ address: "bjorn.haugen@acme-renewables.example", type: "work", isPrimary: true }],
        phoneNumbers: [{ number: "+47 90 44 55 66", type: "mobile", isPrimary: true }],
        personalNotes: "Economic buyer for CAPEX above €1M.",
      },
    }),
    prisma.contact.create({
      data: {
        firstName: "Clara",
        lastName: "Lindqvist",
        fullName: "Clara Lindqvist",
        jobTitle: "Head of Sustainability",
        preferredContactMethod: "email",
        status: "active",
        m365GraphId: "seed-m365-clara-lindqvist",
        m365ImmutableId: "seed-imm-clara-lindqvist",
        companyId: techcorp.id,
        ownerId: SEED_OWNER_ID,
        emails: [
          { address: "clara.lindqvist@global-techcorp.example", type: "work", isPrimary: true },
        ],
        phoneNumbers: [{ number: "+46 70 111 22 33", type: "mobile", isPrimary: true }],
        personalNotes: "Champion for thermal recovery business case.",
      },
    }),
    prisma.contact.create({
      data: {
        firstName: "David",
        lastName: "Okoye",
        fullName: "David Okoye",
        jobTitle: "CTO",
        preferredContactMethod: "email",
        status: "active",
        m365GraphId: "seed-m365-david-okoye",
        m365ImmutableId: "seed-imm-david-okoye",
        companyId: techcorp.id,
        ownerId: SEED_OWNER_ID,
        emails: [{ address: "david.okoye@global-techcorp.example", type: "work", isPrimary: true }],
        phoneNumbers: [{ number: "+46 70 444 55 66", type: "mobile", isPrimary: true }],
        personalNotes: "Technical decision maker for reactor fit.",
      },
    }),
  ]);

  const circularFiber = await prisma.opportunity.create({
    data: {
      name: "Circular Fiber Reactor",
      companyId: acme.id,
      ownerId: SEED_OWNER_ID,
      stage: "discovery",
      status: "open",
      value: 2_400_000,
      currency: "EUR",
      probability: 35,
      description: "Turnkey pyrolysis system for circular fiber feedstock at Acme Renewables.",
      nextStep: "Confirm Decision Maker and offtake path",
      team: [
        { contactId: anna.id, projectRole: "Decision Maker" },
        { contactId: bjorn.id, projectRole: "Economic Buyer" },
      ],
    },
  });

  const thermalRecovery = await prisma.opportunity.create({
    data: {
      name: "Thermal Recovery System",
      companyId: techcorp.id,
      ownerId: SEED_OWNER_ID,
      stage: "qualification",
      status: "open",
      value: 1_850_000,
      currency: "EUR",
      probability: 25,
      description: "Heat recovery and control package for Global TechCorp industrial site.",
      nextStep: "Validate technical fit with CTO",
      team: [
        { contactId: clara.id, projectRole: "Executive Sponsor" },
        { contactId: david.id, projectRole: "Technical Lead" },
      ],
    },
  });

  // FS-006 — Stakeholder Influence Profiles
  await prisma.stakeholderInfluenceProfile.createMany({
    data: [
      {
        opportunityId: circularFiber.id,
        contactId: anna.id,
        influenceLevel: "high" satisfies InfluenceLevel,
        stance: "champion" satisfies SentimentStance,
        notes: "Operational owner — drives site acceptance.",
      },
      {
        opportunityId: circularFiber.id,
        contactId: bjorn.id,
        influenceLevel: "high" satisfies InfluenceLevel,
        stance: "neutral" satisfies SentimentStance,
        notes: "Budget gatekeeper; needs clear ROI.",
      },
      {
        opportunityId: thermalRecovery.id,
        contactId: clara.id,
        influenceLevel: "medium" satisfies InfluenceLevel,
        stance: "positive" satisfies SentimentStance,
        notes: "Sustainability sponsor; builds internal case.",
      },
      {
        opportunityId: thermalRecovery.id,
        contactId: david.id,
        influenceLevel: "high" satisfies InfluenceLevel,
        stance: "champion" satisfies SentimentStance,
        notes: "Technical authority on system fit.",
      },
    ],
  });

  // FS-007 — Decision Maker Profiles
  await prisma.decisionMakerProfile.createMany({
    data: [
      {
        opportunityId: circularFiber.id,
        contactId: anna.id,
        authorityClass: "technical_decision_maker" satisfies AuthorityClass,
        verificationState: "known" satisfies VerificationState,
        verifiedByUserId: SEED_OWNER_ID,
        verifiedAt: new Date(),
      },
      {
        opportunityId: circularFiber.id,
        contactId: bjorn.id,
        authorityClass: "economic_buyer" satisfies AuthorityClass,
        verificationState: "assumed_unconfirmed" satisfies VerificationState,
        signOffThreshold: 1_000_000,
      },
      {
        opportunityId: thermalRecovery.id,
        contactId: clara.id,
        authorityClass: "executive_sponsor" satisfies AuthorityClass,
        verificationState: "known" satisfies VerificationState,
        verifiedByUserId: SEED_OWNER_ID,
        verifiedAt: new Date(),
      },
      {
        opportunityId: thermalRecovery.id,
        contactId: david.id,
        authorityClass: "technical_decision_maker" satisfies AuthorityClass,
        verificationState: "known" satisfies VerificationState,
        verifiedByUserId: SEED_OWNER_ID,
        verifiedAt: new Date(),
      },
    ],
  });

  // FS-008 — Meeting Intelligence (sample meetings + proposed commitments)
  const circularDiscoveryStart = new Date("2026-07-10T09:00:00.000Z");
  const circularDiscoveryEnd = new Date("2026-07-10T10:00:00.000Z");
  const thermalKickoffStart = new Date("2026-07-14T13:00:00.000Z");
  const thermalKickoffEnd = new Date("2026-07-14T14:00:00.000Z");

  const circularMeeting = await prisma.meetingRecord.create({
    data: {
      externalEventId: "seed-meeting-circular-fiber-discovery",
      provider: "m365_graph",
      subject: "Circular Fiber Reactor — Discovery Review",
      startTime: circularDiscoveryStart,
      endTime: circularDiscoveryEnd,
      location: "Acme Renewables — Oslo Plant",
      webLink: "https://teams.microsoft.com/l/meetup-join/seed-circular-fiber",
      organizerEmail: "anna.berg@acme-renewables.example",
      aiSummary:
        "Discussed feedstock volume assumptions and CAPEX envelope. Anna owns site acceptance; Bjorn requested ROI pack before next gate.",
      syncStatus: "pending_review",
      opportunityId: circularFiber.id,
      companyId: acme.id,
      participants: {
        create: [
          {
            email: "anna.berg@acme-renewables.example",
            name: "Anna Berg",
            contactId: anna.id,
            companyId: acme.id,
            isExternal: true,
            responseStatus: "accepted",
          },
          {
            email: "bjorn.haugen@acme-renewables.example",
            name: "Bjorn Haugen",
            contactId: bjorn.id,
            companyId: acme.id,
            isExternal: true,
            responseStatus: "accepted",
          },
        ],
      },
      commitments: {
        create: [
          {
            description: "Send CAPEX ROI pack to Bjorn ahead of investment committee.",
            ownerEmail: "bjorn.haugen@acme-renewables.example",
            dueDate: new Date("2026-07-24T17:00:00.000Z"),
            status: "proposed",
          },
          {
            description: "Confirm annual feedstock volume and moisture limits with plant ops.",
            ownerEmail: "anna.berg@acme-renewables.example",
            dueDate: new Date("2026-07-22T17:00:00.000Z"),
            status: "proposed",
          },
        ],
      },
    },
  });

  const thermalMeeting = await prisma.meetingRecord.create({
    data: {
      externalEventId: "seed-meeting-thermal-recovery-kickoff",
      provider: "m365_graph",
      subject: "Thermal Recovery System — Qualification Kickoff",
      startTime: thermalKickoffStart,
      endTime: thermalKickoffEnd,
      location: "Microsoft Teams",
      webLink: "https://teams.microsoft.com/l/meetup-join/seed-thermal-recovery",
      organizerEmail: "clara.lindqvist@global-techcorp.example",
      aiSummary:
        "Introduced heat recovery scope. Clara sponsors sustainability case; technical fit to be validated with David. Anna and Bjorn joined as reference stakeholders from Acme.",
      syncStatus: "pending_review",
      opportunityId: thermalRecovery.id,
      companyId: techcorp.id,
      participants: {
        create: [
          {
            email: "anna.berg@acme-renewables.example",
            name: "Anna Berg",
            contactId: anna.id,
            companyId: acme.id,
            isExternal: true,
            responseStatus: "accepted",
          },
          {
            email: "bjorn.haugen@acme-renewables.example",
            name: "Bjorn Haugen",
            contactId: bjorn.id,
            companyId: acme.id,
            isExternal: true,
            responseStatus: "tentative",
          },
        ],
      },
    },
  });

  console.log("Seed complete:", {
    companies: [acme.name, techcorp.name],
    contacts: [anna.fullName, bjorn.fullName, clara.fullName, david.fullName],
    opportunities: [circularFiber.name, thermalRecovery.name],
    influenceProfiles: 4,
    decisionMakerProfiles: 4,
    meetings: [circularMeeting.subject, thermalMeeting.subject],
    meetingParticipants: 4,
    proposedCommitments: 2,
  });
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
