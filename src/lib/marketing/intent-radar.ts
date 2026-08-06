/**
 * Intent Trigger Radar — ABM buying-signal detection for Standard Bio.
 * Reality First: only fire triggers from observed contacts, notes, expansion signals,
 * and known public regulatory frameworks applied to the company's geography/sector.
 */

import { findPrismaCompanyByRouteKey } from "@/lib/data/companies";
import { mapPrismaCompanyToApp, toContactTrackingId } from "@/lib/prisma-mappers";
import { withPrismaRetry } from "@/lib/prisma";
import { m365ComposeHref, mailtoHref } from "@/lib/compose-actions";
import { companyRouteKey } from "@/types/company-360";
import { getContactDisplayName } from "@/types/contact";
import type { Company } from "@/types/company";
import { daysBetween } from "@/lib/relative-time";

export type IntentTriggerType =
  | "LEADERSHIP_CHANGE"
  | "REGISTRY_EXPANSION"
  | "REGULATORY_DEADLINE";

export type IntentTriggerUrgency = "HIGH" | "MEDIUM";

export type IntentTrigger = {
  id: string;
  type: IntentTriggerType;
  title: string;
  description: string;
  urgency: IntentTriggerUrgency;
  recommendedAction: string;
  /** Prefill for 1-click outreach */
  outreach?: {
    subject: string;
    body: string;
    href?: string;
    mailtoHref?: string;
  };
};

const LEADERSHIP_WINDOW_DAYS = 90;
const REGISTRY_NOTE_WINDOW_DAYS = 180;

const EXECUTIVE_PATTERN =
  /\b(ceo|cfo|cto|coo|chief|president|managing\s+director|daglig\s+leder|executive\s+sponsor|board\s+member|chairman|chairwoman|vp\b|vice\s+president|head\s+of|direktør|gründer|founder)\b/i;

const REGISTRY_EXPANSION_PATTERN =
  /\b(capital\s+increase|share\s+capital|nytegning|emisjon|branch|filial|new\s+facility|new\s+plant|new\s+site|expansion|åpnet|opened\s+(?:a\s+)?(?:new\s+)?(?:office|facility|plant)|subsidiary|datterselskap|acquired|acquisition)\b/i;

function isNordicOrEu(company: Company): boolean {
  const code = (company.countryCode ?? "").toUpperCase();
  const country = (company.Country?.Title ?? "").toLowerCase();
  const continent = (company.continent ?? "").toLowerCase();
  if (
    ["NO", "SE", "DK", "FI", "IS", "DE", "FR", "NL", "BE", "AT", "IE", "ES", "IT", "PL", "EE", "LV", "LT"].includes(
      code,
    )
  ) {
    return true;
  }
  if (
    /norway|sweden|denmark|finland|iceland|germany|france|netherlands|europe|eu\b/.test(
      country,
    )
  ) {
    return true;
  }
  return continent === "europe";
}

function isRegulatedSector(company: Company): boolean {
  const industry = company.Industry ?? "";
  return /waste|energy|chemical|polymer|textile|infra/i.test(industry);
}

function buildOutreach(
  company: Company,
  trigger: Pick<IntentTrigger, "title" | "recommendedAction" | "description">,
  contactEmail?: string,
  contactName?: string,
): IntentTrigger["outreach"] {
  const greeting = contactName
    ? `Hi ${contactName.split(" ")[0]},`
    : "Hi,";
  const subject = `Re: ${company.Title} — ${trigger.title}`;
  const body = [
    greeting,
    "",
    `I noticed a signal relevant to ${company.Title}: ${trigger.description}`,
    "",
    trigger.recommendedAction,
    "",
    "Would a short conversation next week make sense?",
    "",
    "Best regards",
  ].join("\n");

  if (!contactEmail) {
    return { subject, body };
  }
  return {
    subject,
    body,
    href: m365ComposeHref(contactEmail, subject, body),
    mailtoHref: mailtoHref(contactEmail, subject, body),
  };
}

function primaryOutreachContact(company: Company): {
  email?: string;
  name?: string;
} {
  const ranked = [...company.contacts].sort((a, b) => {
    const score = (contact: (typeof company.contacts)[0]) => {
      let value = 0;
      if (contact.buyingRole === "Economic Buyer") value += 3;
      if (contact.Role === "Executive Sponsor") value += 2;
      if (EXECUTIVE_PATTERN.test(`${contact.JobTitle} ${contact.Title}`)) value += 2;
      if (contact.Email?.trim()) value += 1;
      return value;
    };
    return score(b) - score(a);
  });
  const contact = ranked.find((row) => row.Email?.trim()) ?? ranked[0];
  return {
    email: contact?.Email?.trim(),
    name: contact ? getContactDisplayName(contact) : undefined,
  };
}

/**
 * Scan account signals for active buying / intent triggers.
 */
export async function evaluateAccountIntentTriggers(
  companyId: string,
): Promise<IntentTrigger[]> {
  const prismaCompany = await findPrismaCompanyByRouteKey(companyId);
  if (!prismaCompany) return [];

  const company = mapPrismaCompanyToApp(prismaCompany);
  const routeKey = companyRouteKey(company) || companyId;
  const outreachContact = primaryOutreachContact(company);
  const triggers: IntentTrigger[] = [];

  const [prismaContacts, notes, expansionSignals] = await Promise.all([
    withPrismaRetry((prisma) =>
      prisma.contact.findMany({
        where: { companyId: prismaCompany.id, status: "active" },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ),
    withPrismaRetry((prisma) =>
      prisma.companyNote.findMany({
        where: { companyId: prismaCompany.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ),
    withPrismaRetry((prisma) =>
      prisma.expansionSignal.findMany({
        where: { companyId: prismaCompany.id },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ),
  ]);

  // 1) Leadership Shift — recently added executive contacts
  for (const contact of prismaContacts) {
    const createdAt =
      contact.createdAt instanceof Date
        ? contact.createdAt
        : new Date(contact.createdAt);
    const age = daysBetween(createdAt);
    if (age > LEADERSHIP_WINDOW_DAYS) continue;

    const corpus = `${contact.jobTitle ?? ""} ${contact.fullName ?? ""} ${contact.buyingRole ?? ""}`;
    const isExecutive =
      EXECUTIVE_PATTERN.test(corpus) ||
      /economic\s*buyer|executive/i.test(contact.buyingRole ?? "");
    if (!isExecutive) continue;

    const displayName =
      contact.fullName?.trim() ||
      [contact.firstName, contact.lastName].filter(Boolean).join(" ") ||
      "New executive contact";
    const titleRole = contact.jobTitle?.trim() || contact.buyingRole || "Executive";

    const trigger: IntentTrigger = {
      id: `leadership:${toContactTrackingId(contact.id)}`,
      type: "LEADERSHIP_CHANGE",
      title: "Leadership shift detected",
      description: `${displayName} (${titleRole}) was added to the account within the last ${LEADERSHIP_WINDOW_DAYS} days.`,
      urgency: age <= 30 ? "HIGH" : "MEDIUM",
      recommendedAction:
        "Congratulate the appointment and request a short briefing on waste/energy priorities before the agenda hardens.",
    };
    trigger.outreach = buildOutreach(
      company,
      trigger,
      contact.emails && Array.isArray(contact.emails)
        ? (() => {
            for (const entry of contact.emails) {
              if (entry && typeof entry === "object" && "address" in entry) {
                const address = (entry as { address?: string }).address?.trim();
                if (address) return address;
              }
            }
            return outreachContact.email;
          })()
        : outreachContact.email,
      displayName,
    );
    triggers.push(trigger);
  }

  // 2) Registry Expansion — notes + expansion signals
  for (const note of notes) {
    const createdAt =
      note.createdAt instanceof Date ? note.createdAt : new Date(note.createdAt);
    if (daysBetween(createdAt) > REGISTRY_NOTE_WINDOW_DAYS) continue;
    if (!REGISTRY_EXPANSION_PATTERN.test(note.content)) continue;

    const snippet = note.content.replace(/\s+/g, " ").trim().slice(0, 160);
    const trigger: IntentTrigger = {
      id: `registry-note:${note.id}`,
      type: "REGISTRY_EXPANSION",
      title: "Registry / expansion signal in notes",
      description: `Account note mentions expansion language: “${snippet}”.`,
      urgency: "HIGH",
      recommendedAction:
        "Validate whether a new facility, branch, or capital raise creates feedstock or CapEx timing for pyrolysis / professional services.",
    };
    trigger.outreach = buildOutreach(
      company,
      trigger,
      outreachContact.email,
      outreachContact.name,
    );
    triggers.push(trigger);
  }

  for (const signal of expansionSignals) {
    const createdAt =
      signal.createdAt instanceof Date
        ? signal.createdAt
        : new Date(signal.createdAt);
    if (daysBetween(createdAt) > REGISTRY_NOTE_WINDOW_DAYS) continue;

    const blob = `${signal.title} ${signal.observation} ${signal.reasoning}`.toLowerCase();
    const looksLikeExpansion =
      REGISTRY_EXPANSION_PATTERN.test(blob) ||
      /expansion|facility|branch|capital|growth|capacity/.test(blob);
    if (!looksLikeExpansion) continue;

    const trigger: IntentTrigger = {
      id: `expansion-signal:${signal.id}`,
      type: "REGISTRY_EXPANSION",
      title: signal.title || "Expansion signal on account",
      description: signal.observation.slice(0, 220),
      urgency: signal.status === "detected" ? "HIGH" : "MEDIUM",
      recommendedAction:
        signal.recommendation?.trim() ||
        "Confirm expansion timing and whether Standard Bio can support technology evaluation or feasibility work.",
    };
    trigger.outreach = buildOutreach(
      company,
      trigger,
      outreachContact.email,
      outreachContact.name,
    );
    triggers.push(trigger);
  }

  // 3) Regulatory Deadline — Nordic/EU + regulated sector (public mandate context)
  if (isNordicOrEu(company) && isRegulatedSector(company)) {
    const geography =
      company.Country?.Title ||
      company.countryCode ||
      company.continent ||
      "Europe";
    const trigger: IntentTrigger = {
      id: `regulatory:${routeKey}:esg-csrd`,
      type: "REGULATORY_DEADLINE",
      title: "ESG / CSRD compliance window",
      description: `${company.Title} is in ${geography} with industry “${company.Industry}”. EU/Nordic ESG and sustainability reporting mandates (e.g. CSRD where applicable) increase pressure to document waste, energy, and carbon pathways.`,
      urgency: "MEDIUM",
      recommendedAction:
        "Offer a short compliance-oriented discovery on feedstock, emissions, and whether a pyrolysis pathway supports reporting evidence — without claiming their filing status.",
    };
    trigger.outreach = buildOutreach(
      company,
      trigger,
      outreachContact.email,
      outreachContact.name,
    );
    triggers.push(trigger);
  }

  if (isNordicOrEu(company) && /waste|chemical|energy/i.test(company.Industry)) {
    const trigger: IntentTrigger = {
      id: `regulatory:${routeKey}:iso-env`,
      type: "REGULATORY_DEADLINE",
      title: "Environmental / ISO readiness pressure",
      description: `Sector profile (${company.Industry}) in a Nordic/EU market often faces ISO 14001 / environmental permit scrutiny when capacity expands.`,
      urgency: "MEDIUM",
      recommendedAction:
        "Ask which permits or ISO programs are on this year’s roadmap and whether technology choice is part of that plan.",
    };
    trigger.outreach = buildOutreach(
      company,
      trigger,
      outreachContact.email,
      outreachContact.name,
    );
    triggers.push(trigger);
  }

  const urgencyRank = { HIGH: 0, MEDIUM: 1 } as const;
  return triggers
    .sort((a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency])
    .slice(0, 8);
}
