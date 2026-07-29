/**
 * Thought Leadership & Micro-Campaign Generator
 * Reality First: copy is grounded in observed company industry, geography,
 * Decision Journal entries, and known Standard Bio value props — never invents customer facts.
 */

import { findPrismaCompanyByRouteKey } from "@/lib/data/companies";
import { mapPrismaCompanyToApp } from "@/lib/prisma-mappers";
import { withPrismaRetry } from "@/lib/prisma";
import { calculateICPScore, companyToICPInput } from "@/lib/marketing/icp-matcher";
import { evaluateAccountIntentTriggers } from "@/lib/marketing/intent-radar";
import { companyRouteKey } from "@/types/company-360";
import type { Company } from "@/types/company";
import type {
  MicroCampaignAsset,
  MicroCampaignOptions,
  MicroCampaignResult,
  MicroCampaignType,
} from "@/lib/marketing/micro-campaign-types";

export type {
  MicroCampaignAsset,
  MicroCampaignOptions,
  MicroCampaignResult,
  MicroCampaignType,
} from "@/lib/marketing/micro-campaign-types";
export {
  MICRO_CAMPAIGN_ROLES,
  MICRO_CAMPAIGN_TYPES,
} from "@/lib/marketing/micro-campaign-types";

type CampaignContext = {
  company: Company;
  routeKey: string;
  industry: string;
  geography: string;
  decisions: string[];
  triggers: string[];
  icpAngles: string[];
  targetRole: string;
};

function geographyLabel(company: Company): string {
  return (
    company.Country?.Title?.trim() ||
    company.countryCode?.trim() ||
    company.continent?.trim() ||
    "your market"
  );
}

function sectorPain(industry: string): string {
  if (/waste/i.test(industry)) {
    return "rising disposal cost, residual streams, and pressure to prove circular outcomes";
  }
  if (/energy|infra/i.test(industry)) {
    return "energy recovery targets, carbon accounting, and feedstock certainty for new capacity";
  }
  if (/chemical|polymer/i.test(industry)) {
    return "contaminated or mixed polymer streams that mechanical recycling cannot monetize";
  }
  if (/textile/i.test(industry)) {
    return "hard-to-recycle fiber residuals and the need for scalable recovery pathways";
  }
  return "feedstock uncertainty, permitting predictability, and CapEx decisions for advanced thermal conversion";
}

function standardBioOffer(): string {
  return "advanced pyrolysis systems and paid professional services (feasibility, engineering, commissioning, and operator readiness)";
}

async function loadCampaignContext(
  companyId: string,
  targetRole?: string,
): Promise<CampaignContext | null> {
  const prismaCompany = await findPrismaCompanyByRouteKey(companyId);
  if (!prismaCompany) return null;

  const company = mapPrismaCompanyToApp(prismaCompany);
  const routeKey = companyRouteKey(company) || companyId;

  const [decisions, triggers] = await Promise.all([
    withPrismaRetry((prisma) =>
      prisma.decisionJournal.findMany({
        where: { companyId: prismaCompany.id },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ),
    evaluateAccountIntentTriggers(routeKey),
  ]);

  const icp = calculateICPScore(
    companyToICPInput({ ...company, size: prismaCompany.size }),
  );

  return {
    company,
    routeKey,
    industry: company.Industry || "industrial operations",
    geography: geographyLabel(company),
    decisions: decisions.map((row) => row.decisionText.trim()).filter(Boolean),
    triggers: triggers.map((row) => row.title),
    icpAngles: icp.matchingCriteria.slice(0, 4),
    targetRole: targetRole?.trim() || "Economic Buyer",
  };
}

function buildKeyAngles(ctx: CampaignContext): string[] {
  const angles = [
    `${ctx.industry} pain: ${sectorPain(ctx.industry)}`,
    `Geography focus: ${ctx.geography}`,
    `Audience: ${ctx.targetRole}`,
    `Offer: ${standardBioOffer()}`,
  ];
  if (ctx.decisions[0]) {
    angles.push(`Observed decision signal: ${ctx.decisions[0].slice(0, 120)}`);
  }
  if (ctx.triggers[0]) {
    angles.push(`Active intent trigger: ${ctx.triggers[0]}`);
  }
  for (const match of ctx.icpAngles.slice(0, 2)) {
    angles.push(match);
  }
  return angles;
}

function groundedIn(ctx: CampaignContext): string[] {
  const items = [
    `Industry: ${ctx.industry}`,
    `Geography: ${ctx.geography}`,
  ];
  if (ctx.decisions.length > 0) {
    items.push(`${ctx.decisions.length} Decision Journal entr${ctx.decisions.length === 1 ? "y" : "ies"}`);
  }
  if (ctx.triggers.length > 0) {
    items.push(`${ctx.triggers.length} intent trigger(s)`);
  }
  if (ctx.icpAngles.length > 0) {
    items.push("ICP matching criteria");
  }
  return items;
}

function generateLinkedInPost(ctx: CampaignContext): MicroCampaignAsset[] {
  const decisionLine = ctx.decisions[0]
    ? `\n\nIn conversations with operators facing decisions like “${ctx.decisions[0].slice(0, 100)}”, the pattern is the same: technology choice only works when feedstock and permitting are honest.`
    : "";
  const triggerLine = ctx.triggers[0]
    ? `\n\nWhen signals like “${ctx.triggers[0]}” appear, the window to shape the evaluation criteria is short.`
    : "";

  const post = `Most ${ctx.industry.toLowerCase()} teams in ${ctx.geography} are not short on ambition.

They are short on predictability.

${sectorPain(ctx.industry).charAt(0).toUpperCase()}${sectorPain(ctx.industry).slice(1)} is forcing a harder question:

Can we fund it, permit it, build it — and still prove the environmental outcome?

At Standard Bio, we help industrial teams evaluate ${standardBioOffer()} with that question first — not a brochure deck.${decisionLine}${triggerLine}

If you lead ${ctx.targetRole.toLowerCase()} decisions in ${ctx.industry.toLowerCase()}, what is the one constraint that would kill a project in the next 12 months?

#CircularEconomy #Pyrolysis #IndustrialDecarbonization #${ctx.geography.replace(/\s+/g, "")}`;

  return [
    {
      label: "LinkedIn post",
      content: post.trim(),
    },
  ];
}

function generateOutreachSequence(ctx: CampaignContext): MicroCampaignAsset[] {
  const trigger =
    ctx.triggers[0] ||
    `priorities around ${sectorPain(ctx.industry).split(",")[0]}`;
  const decision =
    ctx.decisions[0] ||
    "how to evaluate advanced conversion options without over-committing CapEx";

  const email1 = `Subject: ${ctx.company.Title} — a timing question on ${ctx.industry.toLowerCase()} residuals

Hi {{FirstName}},

I work with ${ctx.industry.toLowerCase()} teams in ${ctx.geography} who are wrestling with ${sectorPain(ctx.industry)}.

A signal that stood out for ${ctx.company.Title}: ${trigger}.

I’m not asking for a pitch meeting. I’m asking whether ${decision.slice(0, 140)} is still open — and who owns that evaluation as ${ctx.targetRole}.

Worth a 15-minute compare-notes call this week?

Best regards
{{SenderName}}
Standard Bio`;

  const email2 = `Subject: Re: evidence from similar ${ctx.industry.toLowerCase()} evaluations

Hi {{FirstName}},

Following up with something concrete.

When operators in ${ctx.geography} evaluate pyrolysis or professional-services pathways, the useful evidence is rarely a generic case study. It is:

1) Feedstock reality (what actually arrives, not the brochure stream)
2) Permitting predictability (who owns the critical permit)
3) A staged path: assess → pilot logic → plant

Standard Bio supports that path with ${standardBioOffer()}.

If helpful, I can share a short one-pager tailored to ${ctx.industry} — no deck dump.

Best regards
{{SenderName}}`;

  const email3 = `Subject: ${ctx.company.Title} — executive briefing offer

Hi {{FirstName}},

Last note from me.

If you (or your ${ctx.targetRole}) want a focused briefing, we can cover:

• What ${ctx.industry.toLowerCase()} constraints typically block projects in ${ctx.geography}
• Where pyrolysis / professional services fit — and where they do not
• A practical next step that does not require a CapEx leap of faith

${ctx.decisions[0] ? `We’d also be happy to react to the decision thread around: “${ctx.decisions[0].slice(0, 120)}”.` : "Happy to react to your current evaluation criteria."}

Open to a 20-minute briefing next week?

Best regards
{{SenderName}}
Standard Bio`;

  return [
    { label: "Email 1 — Problem / Trigger", content: email1.trim() },
    { label: "Email 2 — Case Study / Evidence", content: email2.trim() },
    { label: "Email 3 — Executive Briefing CTA", content: email3.trim() },
  ];
}

function generateSolutionBrief(ctx: CampaignContext): MicroCampaignAsset[] {
  const decisionBlock =
    ctx.decisions.length > 0
      ? ctx.decisions
          .slice(0, 3)
          .map((item, index) => `${index + 1}. ${item}`)
          .join("\n")
      : "1. No Decision Journal entries yet — confirm customer objectives before claiming account-specific outcomes.";

  const brief = `# Solution Brief — ${ctx.company.Title}

**Audience:** ${ctx.targetRole}
**Sector:** ${ctx.industry}
**Geography:** ${ctx.geography}

## Situation
${ctx.company.Title} operates in ${ctx.industry} within ${ctx.geography}. The commercial pressure is ${sectorPain(ctx.industry)}.

## Observed account signals
${ctx.triggers.length > 0 ? ctx.triggers.map((t) => `• ${t}`).join("\n") : "• No active intent triggers recorded — keep discovery open."}

## Decisions already on the record
${decisionBlock}

## Standard Bio value proposition
We help industrial buyers evaluate and deploy ${standardBioOffer()}, with emphasis on:
• Feedstock honesty before technology romance
• Permitting and regulatory predictability
• Staged commitment (services → validation → machinery)

## Why this matters for ${ctx.targetRole}
A weak technology shortlist creates CapEx regret. A clear evaluation frame protects budget, timeline, and ESG evidence quality.

## Recommended next step
Schedule a 20-minute executive briefing to map feedstock, permits, and decision criteria — then decide whether a paid feasibility / engineering step is justified.

---
_Generated from SmartCRM organizational memory. Do not present invented customer facts as confirmed._`;

  return [{ label: "1-page solution brief", content: brief.trim() }];
}

/**
 * Generate a micro-campaign grounded in company + Decision Journal + intent context.
 */
export async function generateMicroCampaign(
  companyId: string,
  options: MicroCampaignOptions,
): Promise<MicroCampaignResult> {
  const ctx = await loadCampaignContext(companyId, options.targetRole);
  if (!ctx) {
    return {
      title: "Company not found",
      campaignType: options.campaignType,
      generatedAssets: [],
      keyAngles: [],
      companyId,
      companyName: companyId,
      groundedIn: [],
    };
  }

  const keyAngles = buildKeyAngles(ctx);
  let generatedAssets: MicroCampaignAsset[] = [];
  let title = "";

  switch (options.campaignType) {
    case "LINKEDIN_POST":
      title = `LinkedIn thought leadership — ${ctx.company.Title}`;
      generatedAssets = generateLinkedInPost(ctx);
      break;
    case "COLD_OUTREACH_SEQUENCE":
      title = `3-touch outreach sequence — ${ctx.company.Title} (${ctx.targetRole})`;
      generatedAssets = generateOutreachSequence(ctx);
      break;
    case "SOLUTION_BRIEF":
      title = `Solution brief — ${ctx.company.Title}`;
      generatedAssets = generateSolutionBrief(ctx);
      break;
    default:
      title = "Unknown campaign type";
      generatedAssets = [];
  }

  return {
    title,
    campaignType: options.campaignType,
    generatedAssets,
    keyAngles,
    companyId: ctx.routeKey,
    companyName: ctx.company.Title,
    groundedIn: groundedIn(ctx),
  };
}

