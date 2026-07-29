import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  type InfluenceLevel,
  type SentimentStance,
  type AuthorityClass,
  type VerificationState,
  type SentimentGrade,
  type SignalType,
  type SignalStatus,
} from "@src/generated/prisma";
import { Prisma } from "@src/generated/prisma";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL or DATABASE_URL must be set");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const SEED_OWNER_ID = "seed-owner-commercial-01";

async function main() {
  console.log("Seeding SmartCRM core data…");

  // Idempotent cleanup of previous seed markers
  await prisma.workflowExecution.deleteMany({
    where: {
      rule: {
        name: {
          in: [
            "High Churn Risk Mitigation",
            "Post-Meeting Follow-up Auto-Draft",
          ],
        },
      },
    },
  });
  await prisma.workflowRule.deleteMany({
    where: {
      name: {
        in: [
          "High Churn Risk Mitigation",
          "Post-Meeting Follow-up Auto-Draft",
        ],
      },
    },
  });
  await prisma.expansionSignal.deleteMany({
    where: {
      OR: [
        { title: { startsWith: "CAPEX Expansion" } },
        { title: { startsWith: "SmartDocs Maintenance" } },
        { title: { startsWith: "Delayed Contract Renewal" } },
      ],
    },
  });
  await prisma.accountHealthRecord.deleteMany({
    where: {
      company: { name: { in: ["Acme Renewables", "Standard Bio", "Global TechCorp"] } },
    },
  });
  await prisma.emailMessageRecord.deleteMany({
    where: { externalMessageId: { startsWith: "seed-email-" } },
  });
  await prisma.documentRecord.deleteMany({
    where: { externalAttachmentId: { startsWith: "seed-attach-" } },
  });
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
    where: { name: { in: ["Acme Renewables", "Global TechCorp", "Standard Bio"] } },
  });

  const acme = await prisma.company.create({
    data: {
      name: "Acme Renewables",
      industry: "Renewable Energy",
      size: "medium",
      types: ["Customer", "Prospect"],
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
      types: ["Prospect"],
      status: "active",
      website: "https://global-techcorp.example",
      city: "Stockholm",
      country: "Sweden",
      ownerId: SEED_OWNER_ID,
      emails: [{ address: "hello@global-techcorp.example", type: "work", isPrimary: true }],
      phoneNumbers: [{ number: "+46 8 00 00 02", type: "office", isPrimary: true }],
    },
  });

  const standardBio = await prisma.company.create({
    data: {
      name: "Standard Bio",
      industry: "Cleantech Equipment & Services",
      size: "medium",
      types: ["Internal Company"],
      companyType: "Internal Company",
      status: "active",
      website: "https://standardbio.com",
      city: "Oslo",
      country: "Norway",
      ownerId: SEED_OWNER_ID,
      emails: [{ address: "hello@standardbio.com", type: "work", isPrimary: true }],
      phoneNumbers: [{ number: "+47 21 00 00 00", type: "office", isPrimary: true }],
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

  // FS-008 — Meeting Intelligence
  // Explicit opportunityId links to seeded Opportunities by Prisma UUID.
  const circularDiscoveryStart = new Date("2026-07-10T09:00:00.000Z");
  const circularDiscoveryEnd = new Date("2026-07-10T10:00:00.000Z");
  const thermalKickoffStart = new Date("2026-07-14T13:00:00.000Z");
  const thermalKickoffEnd = new Date("2026-07-14T14:00:00.000Z");

  const circularFiberOpportunityId = circularFiber.id;
  const thermalRecoveryOpportunityId = thermalRecovery.id;

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
      // Explicit FS-005 opportunity link
      opportunityId: circularFiberOpportunityId,
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
      // Explicit FS-005 opportunity link
      opportunityId: thermalRecoveryOpportunityId,
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
          {
            email: "clara.lindqvist@global-techcorp.example",
            name: "Clara Lindqvist",
            contactId: clara.id,
            companyId: techcorp.id,
            isExternal: true,
            responseStatus: "accepted",
          },
          {
            email: "guest.engineer@external-partner.example",
            name: "Guest Engineer",
            contactId: null,
            companyId: null,
            isExternal: true,
            responseStatus: "tentative",
          },
        ],
      },
      commitments: {
        create: [
          {
            description: "Share heat recovery P&ID assumptions with David for technical fit.",
            ownerEmail: "david.okoye@global-techcorp.example",
            dueDate: new Date("2026-07-21T17:00:00.000Z"),
            status: "proposed",
          },
          {
            description: "Confirm sustainability KPI framing with Clara before next steering.",
            ownerEmail: "clara.lindqvist@global-techcorp.example",
            dueDate: new Date("2026-07-25T17:00:00.000Z"),
            status: "proposed",
          },
        ],
      },
    },
  });

  // FS-009 — Email & Interaction Intelligence
  // 3-message thread: Mats Borgersen ↔ Anna Berg on Circular Fiber Reactor
  const MATS_EMAIL = "mats.borgersen@standard.bio";
  const ANNA_EMAIL = "anna.berg@acme-renewables.example";
  const circularCapexConversationId = "seed-conv-circular-fiber-capex-2026";

  const circularEmails = await prisma.emailMessageRecord.createMany({
    data: [
      {
        externalMessageId: "seed-email-circular-capex-01",
        conversationId: circularCapexConversationId,
        opportunityId: circularFiberOpportunityId,
        contactId: anna.id,
        subject: "Circular Fiber Reactor — CAPEX payback clarification",
        bodyPreview:
          "Hi Anna — attached is the revised CAPEX payback model (base case 4.2 years). Happy to walk through site power assumptions and feedstock volume inputs before your plant ops review.",
        senderEmail: MATS_EMAIL,
        recipientEmails: [ANNA_EMAIL],
        sentAt: new Date("2026-07-11T08:15:00.000Z"),
        sentiment: "positive" satisfies SentimentGrade,
        isOutbound: true,
        m365CategoryName: "SmartCRM / Circular Fiber Reactor",
      },
      {
        externalMessageId: "seed-email-circular-capex-02",
        conversationId: circularCapexConversationId,
        opportunityId: circularFiberOpportunityId,
        contactId: anna.id,
        subject: "Re: Circular Fiber Reactor — CAPEX payback clarification",
        bodyPreview:
          "Thanks Mats. Payback looks directionally OK, but we still need clarity on peak site power draw during start-up. Until that is confirmed with facilities, I cannot endorse the investment case to Bjorn. Attaching our internal CAPEX payback analysis for reference.",
        senderEmail: ANNA_EMAIL,
        recipientEmails: [MATS_EMAIL],
        sentAt: new Date("2026-07-12T14:40:00.000Z"),
        sentiment: "cautious" satisfies SentimentGrade,
        isOutbound: false,
        m365CategoryName: "SmartCRM / Circular Fiber Reactor",
      },
      {
        externalMessageId: "seed-email-circular-capex-03",
        conversationId: circularCapexConversationId,
        opportunityId: circularFiberOpportunityId,
        contactId: anna.id,
        subject: "Re: Circular Fiber Reactor — CAPEX payback clarification",
        bodyPreview:
          "Understood. We will send the start-up power profile Tuesday and propose a short contract redline review covering warranty limits and acceptance criteria. Please confirm availability mid-week.",
        senderEmail: MATS_EMAIL,
        recipientEmails: [ANNA_EMAIL],
        sentAt: new Date("2026-07-13T09:05:00.000Z"),
        sentiment: "neutral" satisfies SentimentGrade,
        isOutbound: true,
        m365CategoryName: "SmartCRM / Circular Fiber Reactor",
      },
    ],
  });

  const annaEmail = await prisma.emailMessageRecord.findUnique({
    where: { externalMessageId: "seed-email-circular-capex-02" },
  });

  // Minimal valid PDF bytes for preview/download demos (CAPEX_Payback_Analysis_Acme.pdf)
  const samplePdfBase64 = Buffer.from(
    `%PDF-1.4
1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj
2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj
3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources<< /Font<< /F1 5 0 R >> >> >>endobj
4 0 obj<< /Length 68 >>stream
BT /F1 18 Tf 72 720 Td (CAPEX Payback Analysis - Acme) Tj ET
endstream
endobj
5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000266 00000 n 
0000000386 00000 n 
trailer<< /Size 6 /Root 1 0 R >>
startxref
465
%%EOF`,
    "utf8",
  ).toString("base64");

  let seedAttachmentCount = 0;
  if (annaEmail) {
    await prisma.documentRecord.create({
      data: {
        name: "CAPEX_Payback_Analysis_Acme.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1245184,
        source: "m365_email",
        externalAttachmentId: "seed-attach-capex-payback-acme",
        contentBase64: samplePdfBase64,
        opportunityId: circularFiberOpportunityId,
        emailMessageId: annaEmail.id,
      },
    });
    seedAttachmentCount = 1;
  }

  // ==========================================
  // FS-010 Growth & Expansion Intelligence
  // ==========================================

  const acmeHealth = await prisma.accountHealthRecord.create({
    data: {
      companyId: acme.id,
      healthScore: 88,
      engagementScore: 92,
      sentimentScore: 84,
    },
  });

  const expansionSignals = await Promise.all([
    prisma.expansionSignal.create({
      data: {
        companyId: acme.id,
        opportunityId: circularFiberOpportunityId,
        type: "upsell" satisfies SignalType,
        status: "detected" satisfies SignalStatus,
        title: "CAPEX Expansion to Secondary Processing Line",
        observation:
          "Acme Renewables confirmed CAPEX appetite on the Circular Fiber Reactor thread and asked about secondary-line capacity within 18 months.",
        reasoning:
          "High Account Health Index (88) plus positive CAPEX sentiment indicates readiness to expand footprint beyond the primary reactor scope.",
        recommendation:
          "Propose a scoped secondary processing line option and book a technical discovery with Anna Berg and Bjorn Haugen.",
        expectedOutcome:
          "Opens a €0.8–1.2M upsell path without delaying the primary Circular Fiber commitment.",
      },
    }),
    prisma.expansionSignal.create({
      data: {
        companyId: acme.id,
        opportunityId: circularFiberOpportunityId,
        type: "cross_sell" satisfies SignalType,
        status: "reviewing" satisfies SignalStatus,
        title: "SmartDocs Maintenance & Telemetry Module",
        observation:
          "Whitespace Matrix shows Services (maintenance & telemetry) un-pitched on Acme while Systems are in active pursuit.",
        reasoning:
          "Installed-base telemetry locks in recurring revenue and improves renewal defensibility once the reactor is commissioned.",
        recommendation:
          "Present the SmartDocs Maintenance & Telemetry Module as a packaged add-on during the next CAPEX review.",
        expectedOutcome:
          "Converts an un-pitched service category into a paid support contract attached to the reactor deal.",
      },
    }),
    prisma.expansionSignal.create({
      data: {
        companyId: acme.id,
        type: "renewal_risk" satisfies SignalType,
        status: "detected" satisfies SignalStatus,
        title: "Delayed Contract Renewal on Site B",
        observation:
          "Site B renewal milestone slipped two cycles with no confirmed owner response in the last 45 days.",
        reasoning:
          "Renewal delay on an adjacent site can spill into primary-site confidence and free budget for competitors.",
        recommendation:
          "Assign an owner, schedule a renewal checkpoint, and surface Site B risk in the next account review.",
        expectedOutcome:
          "Stabilizes renewal timeline and protects Account Health Index from slipping into at-risk band.",
      },
    }),
  ]);

  // ==========================================
  // FS-011 Autonomous Workflow Engine
  // ==========================================

  const [churnRule, followUpRule] = await Promise.all([
    prisma.workflowRule.create({
      data: {
        name: "High Churn Risk Mitigation",
        triggerType: "expansion_signal_detected",
        conditions: {
          signalTypes: ["churn_risk", "renewal_risk"],
          actionType: "create_task",
        } satisfies Prisma.InputJsonValue,
        status: "active",
      },
    }),
    prisma.workflowRule.create({
      data: {
        name: "Post-Meeting Follow-up Auto-Draft",
        triggerType: "meeting_commitment_confirmed",
        conditions: {
          actionType: "generate_outlook_draft",
        } satisfies Prisma.InputJsonValue,
        status: "active",
      },
    }),
  ]);

  const workflowExecutions = await Promise.all([
    prisma.workflowExecution.create({
      data: {
        ruleId: churnRule.id,
        companyId: acme.id,
        opportunityId: circularFiberOpportunityId,
        actionType: "create_task",
        status: "pending_approval",
        payload: {
          title: "Schedule Executive Review for Acme Renewables Churn Risk",
          observation:
            "Expansion signal 'Delayed Contract Renewal on Site B' is detected while Acme Account Health Index remains expansion-ready overall.",
          reasoning:
            "Site B renewal delay can contaminate Circular Fiber confidence and free budget for competitors if left unowned.",
          recommendation:
            "Create an Executive Review task for the commercial owner with a 5-day due window.",
          expectedOutcome:
            "Renewal risk is triaged in an executive checkpoint before CAPEX momentum stalls.",
          action: {
            subject: "Executive Review — Acme Site B renewal risk",
            activityType: "Meeting",
            dueInDays: 5,
            companyName: "Acme Renewables",
            dealId: circularFiberOpportunityId,
          },
        } satisfies Prisma.InputJsonValue,
      },
    }),
    prisma.workflowExecution.create({
      data: {
        ruleId: followUpRule.id,
        companyId: acme.id,
        opportunityId: circularFiberOpportunityId,
        actionType: "generate_outlook_draft",
        status: "pending_approval",
        payload: {
          title: "Prepare M365 Proposal Draft for Circular Fiber Reactor CAPEX Pack",
          observation:
            "Meeting commitments on Circular Fiber were confirmed; CAPEX payback thread is active with Anna Berg.",
          reasoning:
            "A structured CAPEX pack draft keeps momentum while stakeholders are warm and reduces cycle time to proposal.",
          recommendation:
            "Generate an Outlook draft summarizing CAPEX pack scope, payback assumptions, and next decision checkpoint.",
          expectedOutcome:
            "Commercial owner opens a ready draft in Outlook without composing from scratch.",
          action: {
            toEmail: "bjorn.haugen@acme-renewables.example",
            subject: "Circular Fiber Reactor — CAPEX pack draft",
            bodyHtml:
              "<p>Hi Bjorn,</p><p>Following our confirmed actions, please find the CAPEX pack outline for the Circular Fiber Reactor. Happy to align on payback assumptions and secondary-line scope.</p><p>Best regards</p>",
          },
        } satisfies Prisma.InputJsonValue,
      },
    }),
    prisma.workflowExecution.create({
      data: {
        ruleId: churnRule.id,
        companyId: acme.id,
        opportunityId: circularFiberOpportunityId,
        actionType: "update_stage",
        status: "pending_approval",
        payload: {
          title: "Update Deal Probability to 75% following Commercial Alignment",
          observation:
            "Commercial alignment on CAPEX payback and stakeholder coverage indicates stronger close likelihood than the current 35% probability.",
          reasoning:
            "Probability should reflect confirmed economic-buyer engagement and documented payback analysis — not lag behind evidence.",
          recommendation:
            "Update Circular Fiber Reactor probability to 75% after explicit approval (no silent stage writes).",
          expectedOutcome:
            "Forecast accuracy improves and portfolio reviews show realistic Circular Fiber weighting.",
          action: {
            probability: 75,
            opportunityId: circularFiberOpportunityId,
          },
        } satisfies Prisma.InputJsonValue,
      },
    }),
  ]);

  console.log("Seed complete:", {
    companies: [acme.name, techcorp.name, standardBio.name],
    contacts: [anna.fullName, bjorn.fullName, clara.fullName, david.fullName],
    opportunities: [
      { name: circularFiber.name, id: circularFiberOpportunityId },
      { name: thermalRecovery.name, id: thermalRecoveryOpportunityId },
    ],
    influenceProfiles: 4,
    decisionMakerProfiles: 4,
    meetings: [
      {
        subject: circularMeeting.subject,
        opportunityId: circularMeeting.opportunityId,
      },
      {
        subject: thermalMeeting.subject,
        opportunityId: thermalMeeting.opportunityId,
      },
    ],
    meetingParticipants: 6,
    proposedCommitments: 4,
    emailMessages: circularEmails.count,
    emailConversationId: circularCapexConversationId,
    emailAttachments: seedAttachmentCount,
    accountHealth: {
      company: acme.name,
      healthScore: acmeHealth.healthScore,
      engagementScore: acmeHealth.engagementScore,
      sentimentScore: acmeHealth.sentimentScore,
    },
    expansionSignals: expansionSignals.map((signal) => ({
      title: signal.title,
      type: signal.type,
      status: signal.status,
      companyId: signal.companyId,
    })),
    workflowRules: [churnRule.name, followUpRule.name],
    workflowExecutions: workflowExecutions.map((execution) => ({
      id: execution.id,
      actionType: execution.actionType,
      status: execution.status,
      title: (execution.payload as { title?: string }).title,
    })),
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
