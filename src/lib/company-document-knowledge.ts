import { smartDocHref } from "@/types/smartdoc";
import type { SmartDocLibraryRecord } from "@/types/smartdoc-library";
import { isPermitSmartDocCategory } from "@/types/smartdoc-library";
import { company360Href } from "@/types/company-360";

export type DocumentKnowledgeConfidence = "high" | "moderate";
export type DocumentKnowledgeKind = "fact" | "unknown";
export type DocumentKnowledgeDecision = "confirmed" | "dismissed";

export type DocumentKnowledgeSource = {
  id: string;
  name: string;
  href: string;
  docType: string;
};

export type DocumentKnowledgeClaim = {
  id: string;
  kind: DocumentKnowledgeKind;
  /** high = classified type; moderate = filename hint only */
  confidence: DocumentKnowledgeConfidence;
  statement: string;
  impact: string;
  sources: DocumentKnowledgeSource[];
};

export type DocumentKnowledgeNextAction = {
  label: string;
  reason: string;
  href: string;
};

export type CompanyDocumentKnowledgeState = {
  confirmed: Record<string, { at: string }>;
  dismissed: Record<string, { at: string }>;
};

export type CompanyDocumentKnowledgeSnapshot = {
  documentCount: number;
  facts: DocumentKnowledgeClaim[];
  unknowns: DocumentKnowledgeClaim[];
  nextAction: DocumentKnowledgeNextAction | null;
  /** Honest limit: identity and classification, not a full-text PDF read. */
  evidenceBasis: "document-identity";
};

export const EMPTY_DOCUMENT_KNOWLEDGE_STATE: CompanyDocumentKnowledgeState = {
  confirmed: {},
  dismissed: {},
};

function isUnclassifiedType(docType: string | null | undefined): boolean {
  const type = (docType ?? "").trim().toLowerCase();
  return type.length === 0 || type === "unclassified document" || type === "unclassified";
}

function haystack(record: SmartDocLibraryRecord): string {
  return `${record.DocumentName ?? ""} ${record.FileLeafRef ?? ""}`.trim();
}

function filenameLooksLikePermit(name: string): boolean {
  return /tillatelse|permit|utslipp|forurensning|konsesjon|licence|license/i.test(
    name,
  );
}

function filenameLooksLikeFlow(name: string): boolean {
  return /flow\s*diagram|flyt.?diagram|prosessflyt|process\s*flow|p&id|pnid/i.test(
    name,
  );
}

function sourceFrom(record: SmartDocLibraryRecord): DocumentKnowledgeSource {
  const name = (record.DocumentName || record.FileLeafRef || record.SmartDocID).trim();
  return {
    id: record.SmartDocID,
    name,
    href: smartDocHref(record.SmartDocID),
    docType: record.DocType || "Unclassified Document",
  };
}

function parseState(raw: unknown): CompanyDocumentKnowledgeState {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { confirmed: {}, dismissed: {} };
  }
  const row = raw as {
    confirmed?: unknown;
    dismissed?: unknown;
  };
  const confirmed: CompanyDocumentKnowledgeState["confirmed"] = {};
  const dismissed: CompanyDocumentKnowledgeState["dismissed"] = {};
  if (row.confirmed && typeof row.confirmed === "object" && !Array.isArray(row.confirmed)) {
    for (const [key, value] of Object.entries(row.confirmed)) {
      const at =
        value && typeof value === "object" && "at" in value && typeof value.at === "string"
          ? value.at
          : "";
      if (key.trim()) confirmed[key] = { at: at || new Date().toISOString() };
    }
  }
  if (row.dismissed && typeof row.dismissed === "object" && !Array.isArray(row.dismissed)) {
    for (const [key, value] of Object.entries(row.dismissed)) {
      const at =
        value && typeof value === "object" && "at" in value && typeof value.at === "string"
          ? value.at
          : "";
      if (key.trim()) dismissed[key] = { at: at || new Date().toISOString() };
    }
  }
  return { confirmed, dismissed };
}

export function parseCompanyDocumentKnowledgeState(
  raw: unknown,
): CompanyDocumentKnowledgeState {
  return parseState(raw);
}

function applyState(
  claims: DocumentKnowledgeClaim[],
  state: CompanyDocumentKnowledgeState,
): DocumentKnowledgeClaim[] {
  return claims.filter((claim) => !state.dismissed[claim.id]);
}

function factForType(
  records: SmartDocLibraryRecord[],
  docType: string,
  statement: string,
  impact: string,
): DocumentKnowledgeClaim | null {
  const matches = records.filter(
    (record) =>
      !isUnclassifiedType(record.DocType) &&
      record.DocType.trim().toLowerCase() === docType.toLowerCase(),
  );
  if (matches.length === 0) return null;
  const label =
    matches.length === 1
      ? statement
      : `${statement.replace(/ on file$/i, "")} on file (${matches.length})`;
  return {
    id: `fact:${docType}`,
    kind: "fact",
    confidence: "high",
    statement: label,
    impact,
    sources: matches.slice(0, 3).map(sourceFrom),
  };
}

/**
 * Proposed company knowledge from associated SmartDocs.
 * Reality First: classified types and filename hints only — never invent a client,
 * plant, or opportunity. User must confirm before it becomes company knowledge.
 */
export function buildCompanyDocumentKnowledge(
  companyId: string,
  documents: SmartDocLibraryRecord[],
  state: CompanyDocumentKnowledgeState = EMPTY_DOCUMENT_KNOWLEDGE_STATE,
): CompanyDocumentKnowledgeSnapshot {
  const docs = documents.filter((record) => record.SmartDocID);
  const classified = docs.filter((record) => !isUnclassifiedType(record.DocType));
  const unclassified = docs.filter((record) => isUnclassifiedType(record.DocType));

  const facts: DocumentKnowledgeClaim[] = [];

  const permitFact = factForType(
    classified,
    "Environmental Permit",
    "Environmental permit on file",
    "Whether this site can operate is evidenced by a document — not assumed.",
  );
  const buildingPermit = factForType(
    classified,
    "Building Permit",
    "Building permit on file",
    "Construction approval evidence exists and should be read before next commitments.",
  );
  const planningPermit = factForType(
    classified,
    "Planning Permit",
    "Planning permit on file",
    "Land-use evidence exists — treat permitting as known work, not a blank.",
  );
  const operatingLicence = factForType(
    classified,
    "Operating Licence",
    "Operating licence on file",
    "Operating authority is documented. Confirm it is current before promising delivery.",
  );
  const signedContract = factForType(
    classified,
    "Signed Contract",
    "Signed contract on file",
    "Commercial terms exist as a document. Read it before treating the relationship as informal.",
  );
  const vendorAgreement = factForType(
    classified,
    "Vendor Agreement",
    "Vendor agreement on file",
    "This is buy-from evidence — not a reason to create a sales opportunity.",
  );
  const supplierQuote = factForType(
    classified,
    "Supplier Quotation",
    "Supplier quotation on file",
    "This is buy-from evidence — not a reason to create a sales opportunity.",
  );
  const formalQuote = factForType(
    classified,
    "Formal Quotation",
    "Formal quotation on file",
    "A priced Standard Bio offer exists. Follow-through is a commercial action, not a filing task.",
  );
  const budgetQuote = factForType(
    classified,
    "Budget Quotation",
    "Budget quotation on file",
    "A budgetary offer exists. Confirm whether it is still the live commercial position.",
  );
  const priceIndication = factForType(
    classified,
    "Price Indication",
    "Price indication on file",
    "An early price envelope exists. Do not treat it as a signed commitment.",
  );
  const purchaseOrder = factForType(
    classified,
    "Customer Purchase Order",
    "Customer purchase order on file",
    "The customer has issued a PO. Execution and confirmation matter more than more selling.",
  );
  const processSummary = factForType(
    classified,
    "Process Summary",
    "Process documentation on file",
    "Engineering context exists for this company. Use it before asking what they already sent.",
  );
  const datasheet = factForType(
    classified,
    "Technical Datasheet",
    "Technical datasheet on file",
    "Technical specifications exist as a document — do not re-ask for numbers already filed.",
  );
  const heatBalance = factForType(
    classified,
    "Heat Balance",
    "Heat balance on file",
    "Process design evidence exists. Technical follow-up should start from this file.",
  );

  for (const claim of [
    permitFact,
    buildingPermit,
    planningPermit,
    operatingLicence,
    signedContract,
    purchaseOrder,
    formalQuote,
    budgetQuote,
    priceIndication,
    vendorAgreement,
    supplierQuote,
    processSummary,
    datasheet,
    heatBalance,
  ]) {
    if (claim) facts.push(claim);
  }

  const otherClassified = classified.filter((record) => {
    const type = record.DocType.trim().toLowerCase();
    return ![
      "environmental permit",
      "building permit",
      "planning permit",
      "operating licence",
      "signed contract",
      "customer purchase order",
      "formal quotation",
      "budget quotation",
      "price indication",
      "vendor agreement",
      "supplier quotation",
      "process summary",
      "technical datasheet",
      "heat balance",
    ].includes(type);
  });
  if (otherClassified.length > 0) {
    const byType = new Map<string, SmartDocLibraryRecord[]>();
    for (const record of otherClassified) {
      const key = record.DocType.trim() || "Document";
      const list = byType.get(key) ?? [];
      list.push(record);
      byType.set(key, list);
    }
    for (const [docType, rows] of byType) {
      const permitish = rows.some((row) => isPermitSmartDocCategory(row.DocCategory));
      facts.push({
        id: `fact:${docType}`,
        kind: "fact",
        confidence: "high",
        statement:
          rows.length === 1 ? `${docType} on file` : `${docType} on file (${rows.length})`,
        impact: permitish
          ? "Regulatory evidence exists. Use it before treating approval as unknown."
          : "This document is classified company knowledge — open it instead of asking the company again.",
        sources: rows.slice(0, 3).map(sourceFrom),
      });
    }
  }

  const unknowns: DocumentKnowledgeClaim[] = [];
  if (unclassified.length > 0) {
    const permitHints = unclassified.filter((record) =>
      filenameLooksLikePermit(haystack(record)),
    );
    const flowHints = unclassified.filter((record) =>
      filenameLooksLikeFlow(haystack(record)),
    );
    const rest = unclassified.filter(
      (record) =>
        !permitHints.some((row) => row.SmartDocID === record.SmartDocID) &&
        !flowHints.some((row) => row.SmartDocID === record.SmartDocID),
    );

    if (permitHints.length > 0) {
      unknowns.push({
        id: "unknown:filename-permit",
        kind: "unknown",
        confidence: "moderate",
        statement:
          permitHints.length === 1
            ? `${permitHints[0]!.DocumentName || permitHints[0]!.FileLeafRef} looks like a permit but is unclassified`
            : `${permitHints.length} files look like permits but are unclassified`,
        impact:
          "Until Category and Type are set, SmartAssist cannot treat this as permitting evidence.",
        sources: permitHints.slice(0, 3).map(sourceFrom),
      });
    }
    if (flowHints.length > 0) {
      unknowns.push({
        id: "unknown:filename-flow",
        kind: "unknown",
        confidence: "moderate",
        statement:
          flowHints.length === 1
            ? `${flowHints[0]!.DocumentName || flowHints[0]!.FileLeafRef} looks like process documentation but is unclassified`
            : `${flowHints.length} files look like process documentation but are unclassified`,
        impact:
          "Engineering context is sitting in Knowledge unused until the files are classified.",
        sources: flowHints.slice(0, 3).map(sourceFrom),
      });
    }
    if (rest.length > 0) {
      unknowns.push({
        id: "unknown:unclassified",
        kind: "unknown",
        confidence: "high",
        statement:
          rest.length === 1
            ? `${rest[0]!.DocumentName || rest[0]!.FileLeafRef} is unclassified`
            : `${rest.length} documents are unclassified`,
        impact:
          "Unclassified files cannot become company knowledge. Classify them so they count.",
        sources: rest.slice(0, 3).map(sourceFrom),
      });
    }
  }

  const visibleFacts = applyState(facts, state).slice(0, 5);
  const visibleUnknowns = applyState(unknowns, state).slice(0, 4);
  const proposedFacts = visibleFacts.filter((claim) => !state.confirmed[claim.id]);
  const documentsHref = company360Href(companyId, "documents");

  let nextAction: DocumentKnowledgeNextAction | null = null;
  if (visibleUnknowns.length > 0) {
    nextAction = {
      label: "Classify the unclassified files",
      reason:
        "They are already downloaded. Category and Type turn them into company knowledge.",
      href: documentsHref,
    };
  } else if (proposedFacts.length > 0) {
    nextAction = {
      label: "Confirm what the documents show",
      reason:
        "SmartAssist will not write this onto the company until you accept it.",
      href: "#document-knowledge",
    };
  }

  return {
    documentCount: docs.length,
    facts: visibleFacts,
    unknowns: visibleUnknowns,
    nextAction,
    evidenceBasis: "document-identity",
  };
}

export function applyDocumentKnowledgeDecision(
  state: CompanyDocumentKnowledgeState,
  claimId: string,
  decision: DocumentKnowledgeDecision,
): CompanyDocumentKnowledgeState {
  const id = claimId.trim();
  if (!id) return state;
  const at = new Date().toISOString();
  const confirmed = { ...state.confirmed };
  const dismissed = { ...state.dismissed };
  delete confirmed[id];
  delete dismissed[id];
  if (decision === "confirmed") confirmed[id] = { at };
  else dismissed[id] = { at };
  return { confirmed, dismissed };
}
