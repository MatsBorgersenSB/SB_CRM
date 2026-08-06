/**
 * SmartDocs Contract & Compliance Audit
 * Rule-based clause inspection — Reality First: findings cite observed text patterns only.
 */

import { createHash } from "crypto";

export type ContractRiskScore = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type ComplianceChecklistItem = {
  rule: string;
  passed: boolean;
  details: string;
};

export type ContractRemediation = {
  id: string;
  title: string;
  clause: string;
  talkingPoint: string;
};

export type ContractAuditResult = {
  overallRiskScore: ContractRiskScore;
  complianceChecklist: ComplianceChecklistItem[];
  redFlags: string[];
  suggestedRemediations: ContractRemediation[];
  summary: string;
  documentType?: string;
  textHash: string;
};

type RuleDef = {
  id: string;
  rule: string;
  category: "gdpr" | "liability" | "payment" | "termination" | "other";
  passPatterns: RegExp[];
  failPatterns?: RegExp[];
  /** If none of passPatterns match, treat as failed (missing clause). */
  required?: boolean;
  passDetails: string;
  failDetails: string;
  redFlagOnFail?: boolean;
  remediation?: Omit<ContractRemediation, "id">;
};

const RULES: RuleDef[] = [
  {
    id: "gdpr_dpa",
    rule: "GDPR / DPA present",
    category: "gdpr",
    required: true,
    passPatterns: [
      /\b(?:data\s+processing\s+agreement|dpa)\b/i,
      /\bgdpr\b/i,
      /\bpersonal\s+data\b/i,
      /\bdata\s+controller\b|\bdata\s+processor\b/i,
      /\bart(?:icle)?\s*28\b/i,
    ],
    passDetails: "Document references GDPR, DPA, or personal-data processing terms.",
    failDetails:
      "No clear GDPR/DPA language detected. Add a Data Processing Agreement schedule if personal data is processed.",
    redFlagOnFail: true,
    remediation: {
      title: "Add DPA schedule",
      clause:
        "The Parties shall enter into a Data Processing Agreement (DPA) governing any processing of personal data under this Agreement, including purposes, categories of data subjects, security measures, sub-processor controls, and assistance with data-subject rights under applicable data-protection law (including GDPR where applicable).",
      talkingPoint:
        "If we process personal data for the customer, we need an Art. 28-style DPA before go-live — not after signature.",
    },
  },
  {
    id: "gdpr_subprocessors",
    rule: "Sub-processor / transfer controls",
    category: "gdpr",
    passPatterns: [
      /\bsub[- ]?process(?:or|ing)\b/i,
      /\bthird[- ]?country\s+transfer\b/i,
      /\bstandard\s+contractual\s+clauses\b|\bsccs?\b/i,
      /\binternational\s+transfer\b/i,
    ],
    passDetails: "Sub-processor or international-transfer controls are referenced.",
    failDetails:
      "No sub-processor / transfer controls found. If GDPR applies, require approval rights and SCC coverage.",
    remediation: {
      title: "Sub-processor approval clause",
      clause:
        "The Processor shall not engage a sub-processor without prior written authorization of the Controller. The Processor shall impose data-protection obligations on sub-processors no less protective than those in this DPA and remain liable for their performance.",
      talkingPoint:
        "Ask for the current sub-processor list and whether transfers leave the EEA.",
    },
  },
  {
    id: "liability_cap",
    rule: "Liability cap present",
    category: "liability",
    required: true,
    passPatterns: [
      /\bliability\s+(?:cap|limit(?:ation)?)\b/i,
      /\baggregate\s+liability\b/i,
      /\bshall\s+not\s+exceed\b/i,
      /\blimited\s+to\s+(?:the\s+)?(?:fees|amounts?)\s+paid\b/i,
      /\bmaximum\s+(?:aggregate\s+)?liability\b/i,
    ],
    passDetails: "A liability cap or limitation of liability is present.",
    failDetails:
      "No liability cap detected. Uncapped exposure is a critical commercial and legal risk.",
    redFlagOnFail: true,
    remediation: {
      title: "Mutual liability cap",
      clause:
        "Except for uncapped carve-outs expressly listed in this Agreement, each Party’s aggregate liability arising out of or related to this Agreement shall not exceed the total fees paid or payable by Customer to Supplier under this Agreement during the twelve (12) months preceding the claim.",
      talkingPoint:
        "Propose a 12-month fees cap with narrow carve-outs (IP infringement, confidentiality, data breach caused by negligence).",
    },
  },
  {
    id: "liability_unlimited",
    rule: "No unlimited liability on Supplier",
    category: "liability",
    passPatterns: [
      /\bunlimited\s+liability\b/i,
      /\bliability\s+shall\s+not\s+be\s+limited\b/i,
      /\bwithout\s+limitation\s+of\s+liability\b/i,
    ],
    failPatterns: [
      /\bsupplier\b.{0,80}\bunlimited\s+liability\b/i,
      /\bunlimited\s+liability\b.{0,80}\b(?:supplier|vendor|contractor|standard\s+bio)\b/i,
      /\bshall\s+be\s+fully\s+liable\b/i,
    ],
    passDetails:
      "No explicit unlimited-liability obligation on the supplier was detected as a hard fail.",
    failDetails:
      "Language suggests unlimited or uncapped supplier liability — escalate to legal before signing.",
    redFlagOnFail: true,
    remediation: {
      title: "Reject unlimited liability",
      clause:
        "Nothing in this Agreement shall impose unlimited liability on Supplier. Any liability of Supplier shall be subject to the aggregate liability cap and the exclusions set out in the Limitation of Liability clause.",
      talkingPoint:
        "Unlimited liability is a walk-away item unless carve-outs are tightly defined and insured.",
    },
  },
  {
    id: "payment_terms",
    rule: "Payment terms defined",
    category: "payment",
    required: true,
    passPatterns: [
      /\bpayment\s+terms?\b/i,
      /\bnet\s*\d{1,3}\b/i,
      /\bdue\s+within\s+\d+\s+days\b/i,
      /\binvoice(?:s|d)?\b.{0,40}\b(?:due|payable)\b/i,
      /\bmilestone\s+payment\b/i,
    ],
    passDetails: "Payment timing or invoicing terms are present.",
    failDetails:
      "No clear payment terms detected (e.g. Net 30 / milestone schedule).",
    remediation: {
      title: "Net-30 payment clause",
      clause:
        "Customer shall pay undisputed invoices within thirty (30) days of the invoice date (Net 30). Overdue amounts may accrue interest at the lesser of 1.5% per month or the maximum rate permitted by law.",
      talkingPoint:
        "Lock Net 30 (or better) and define milestone triggers for equipment / services.",
    },
  },
  {
    id: "payment_retention",
    rule: "Retention / holdback limits",
    category: "payment",
    passPatterns: [
      /\bretention\b/i,
      /\bholdback\b/i,
      /\bretainage\b/i,
    ],
    failPatterns: [
      /\bretention\b.{0,40}(?:20|25|30)\s*%/i,
      /\bholdback\b.{0,40}(?:20|25|30)\s*%/i,
    ],
    passDetails: "Retention language, if any, does not show an extreme holdback in scanned text.",
    failDetails:
      "High retention (≥20%) detected — negotiate lower retainage and clear release criteria.",
    redFlagOnFail: true,
    remediation: {
      title: "Cap retention",
      clause:
        "Any retention shall not exceed five percent (5%) of the applicable milestone value and shall be released within thirty (30) days of achievement of the corresponding acceptance criteria.",
      talkingPoint:
        "High retainage starves project cash flow — push for ≤5% with objective release tests.",
    },
  },
  {
    id: "termination_for_convenience",
    rule: "Termination rights defined",
    category: "termination",
    required: true,
    passPatterns: [
      /\btermination\b/i,
      /\bterminate\s+(?:this\s+)?(?:agreement|contract)\b/i,
      /\bfor\s+convenience\b/i,
      /\bfor\s+cause\b/i,
    ],
    passDetails: "Termination provisions are present.",
    failDetails:
      "No termination clause detected. Ambiguous exit rights create commercial risk for both parties.",
    remediation: {
      title: "Balanced termination clause",
      clause:
        "Either Party may terminate this Agreement for material breach if the breach remains uncured thirty (30) days after written notice. Customer may terminate for convenience upon sixty (60) days’ written notice, subject to payment for work performed and non-cancellable commitments through the effective termination date.",
      talkingPoint:
        "Accept convenience termination only with wind-down payment for committed CapEx and engineering.",
    },
  },
  {
    id: "termination_immediate",
    rule: "No harsh immediate termination without cure",
    category: "termination",
    passPatterns: [
      /\bimmediate(?:ly)?\s+terminat(?:e|ion)\b/i,
      /\bterminat(?:e|ion)\s+without\s+(?:notice|cure)\b/i,
    ],
    failPatterns: [
      /\bmay\s+terminate\s+immediately\b/i,
      /\bwithout\s+prior\s+notice\b.{0,60}\bterminat/i,
      /\bterminat(?:e|ion).{0,40}\bwithout\s+cure\b/i,
    ],
    passDetails: "No harsh immediate-termination-without-cure pattern flagged as a hard fail.",
    failDetails:
      "Immediate termination without cure/notice detected — high operational risk for project delivery.",
    redFlagOnFail: true,
    remediation: {
      title: "Cure period before termination",
      clause:
        "Except for irreparable harm, insolvency, or wilful misconduct, a Party shall provide written notice and a thirty (30) day cure period before terminating this Agreement for breach.",
      talkingPoint:
        "Immediate termination without cure is unacceptable for plant/project contracts — insist on notice + cure.",
    },
  },
];

const RISK_RANK: Record<ContractRiskScore, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3,
};

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex").slice(0, 32);
}

function anyMatch(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => {
    pattern.lastIndex = 0;
    return pattern.test(text);
  });
}

function evaluateRule(text: string, rule: RuleDef): {
  item: ComplianceChecklistItem;
  redFlag?: string;
  remediation?: ContractRemediation;
} {
  const hasPassSignal = anyMatch(text, rule.passPatterns);
  const hasFailSignal = rule.failPatterns
    ? anyMatch(text, rule.failPatterns)
    : false;

  let passed: boolean;

  if (rule.id === "liability_unlimited" || rule.id === "termination_immediate") {
    // passPatterns detect concerning language → fail when present
    passed = !hasPassSignal && !hasFailSignal;
  } else if (rule.id === "payment_retention") {
    // Mentions of retention are fine; extreme % holdbacks fail
    passed = !hasFailSignal;
  } else if (rule.id === "gdpr_subprocessors") {
    const gdprContext = anyMatch(text, [
      /\bgdpr\b/i,
      /\bpersonal\s+data\b/i,
      /\bdpa\b/i,
      /\bdata\s+processing\s+agreement\b/i,
    ]);
    passed = hasPassSignal || !gdprContext;
  } else if (rule.required) {
    passed = hasPassSignal;
  } else {
    passed = hasPassSignal || !hasFailSignal;
  }

  const item: ComplianceChecklistItem = {
    rule: rule.rule,
    passed,
    details: passed ? rule.passDetails : rule.failDetails,
  };

  const redFlag =
    !passed && rule.redFlagOnFail
      ? `${rule.rule}: ${rule.failDetails}`
      : undefined;

  const remediation =
    !passed && rule.remediation
      ? { id: rule.id, ...rule.remediation }
      : undefined;

  return { item, redFlag, remediation };
}

function scoreFromChecklist(
  checklist: ComplianceChecklistItem[],
  redFlags: string[],
): ContractRiskScore {
  const failed = checklist.filter((item) => !item.passed).length;
  const criticalFails = redFlags.length;

  if (criticalFails >= 3 || failed >= 5) return "CRITICAL";
  if (criticalFails >= 2 || failed >= 3) return "HIGH";
  if (criticalFails >= 1 || failed >= 1) return "MEDIUM";
  return "LOW";
}

/**
 * Inspect raw contract / legal document text and return a structured compliance audit.
 */
export function auditContractText(
  documentText: string,
  documentType?: string,
): ContractAuditResult {
  const text = documentText.replace(/\r\n/g, "\n").trim();
  if (!text) {
    return {
      overallRiskScore: "HIGH",
      complianceChecklist: [
        {
          rule: "Document text provided",
          passed: false,
          details: "No document text was supplied for audit.",
        },
      ],
      redFlags: ["Empty document — cannot verify GDPR, liability, payment, or termination terms."],
      suggestedRemediations: [],
      summary: "Audit blocked: paste or provide contract text to evaluate compliance.",
      documentType,
      textHash: hashText(""),
    };
  }

  const checklist: ComplianceChecklistItem[] = [];
  const redFlags: string[] = [];
  const remediations: ContractRemediation[] = [];

  for (const rule of RULES) {
    const result = evaluateRule(text, rule);
    checklist.push(result.item);
    if (result.redFlag) redFlags.push(result.redFlag);
    if (result.remediation) remediations.push(result.remediation);
  }

  // Document-type hint: NDAs still need liability/termination but DPA may be lighter
  if (documentType && /nda|non[- ]disclosure/i.test(documentType)) {
    const gdpr = checklist.find((item) => item.rule.startsWith("GDPR"));
    if (gdpr && !gdpr.passed) {
      gdpr.details +=
        " (NDA context — DPA may be deferred if no personal data is processed; confirm in writing.)";
    }
  }

  const overallRiskScore = scoreFromChecklist(checklist, redFlags);
  const failedCount = checklist.filter((item) => !item.passed).length;

  const summary =
    overallRiskScore === "LOW"
      ? `Compliance scan looks healthy for ${documentType ?? "this document"} — key GDPR/DPA, liability, payment, and termination markers were found.`
      : `Compliance scan found ${failedCount} gap${failedCount === 1 ? "" : "s"} and ${redFlags.length} red flag${redFlags.length === 1 ? "" : "s"} (risk ${overallRiskScore}). Review remediations before signature.`;

  return {
    overallRiskScore,
    complianceChecklist: checklist,
    redFlags,
    suggestedRemediations: remediations,
    summary,
    documentType,
    textHash: hashText(text),
  };
}

export function riskScoreRank(score: ContractRiskScore): number {
  return RISK_RANK[score];
}
