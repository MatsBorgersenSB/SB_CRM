import { createSourceFinding } from "@/lib/source-findings";
import type { SourceFinding } from "@/lib/source-findings";
import type { OpportunityUnderstandingCapture } from "@/types/opportunity-understanding";
import type { UnderstandingFieldId } from "@/types/opportunity-understanding";
import { isUnderstandingFieldId } from "@/types/opportunity-understanding";
import type {
  QueryPack,
  QueryPackAnswerProposal,
  QueryPackImportResult,
  QueryPackImportRow,
  QueryPackRecipientFile,
  QueryPosition,
  QueryPositionAttachment,
  QueryPositionAttachmentKind,
  QueryPositionType,
} from "@/types/query-pack";

export type { QueryPack, QueryPosition, QueryPackRecipientFile };

const MAX_PICTURE_DATA_URL_CHARS = 700_000; // ~500KB binary-ish cap for pasted screenshots

function isHttpOrDataUrl(value: string): boolean {
  const trimmed = value.trim();
  return (
    /^https?:\/\//i.test(trimmed) ||
    /^data:image\/(png|jpe?g|gif|webp);base64,/i.test(trimmed)
  );
}

export function parseQueryPositionAttachments(raw: unknown): QueryPositionAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: QueryPositionAttachment[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const row = entry as Record<string, unknown>;
    const id = typeof row.id === "string" ? row.id.trim() : "";
    const label = typeof row.label === "string" ? row.label.trim() : "";
    const url = typeof row.url === "string" ? row.url.trim() : "";
    const kind: QueryPositionAttachmentKind | null =
      row.kind === "url" || row.kind === "document" || row.kind === "picture"
        ? row.kind
        : null;
    if (!id || !label || !url || !kind) continue;
    if (kind === "picture") {
      if (!isHttpOrDataUrl(url)) continue;
      if (url.startsWith("data:") && url.length > MAX_PICTURE_DATA_URL_CHARS) continue;
    } else if (!/^https?:\/\//i.test(url)) {
      continue;
    }
    out.push({ id, kind, label, url });
  }
  return out;
}

function newId(prefix: string): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}

export function createQueryPack(input: {
  scope: "opportunity" | "project";
  scopeId: string;
  title: string;
  ownerTitle?: string;
  positions?: QueryPosition[];
}): QueryPack {
  const now = new Date().toISOString();
  return {
    packId: newId("QP"),
    scope: input.scope,
    scopeId: input.scopeId.trim(),
    title: input.title.trim() || "Questions for this deal",
    status: "draft",
    positions: input.positions ?? [],
    recipientFiles: [],
    createdAt: now,
    updatedAt: now,
    ownerTitle: input.ownerTitle?.trim() || undefined,
  };
}

/** FS-005B §4.3 documented unknowns only — caller must assign roster companyIds. */
export function antecHornindalSeedPositions(): QueryPosition[] {
  const seeds: Array<{
    questionId: string;
    type: QueryPositionType;
    fieldId?: UnderstandingFieldId;
    question: string;
  }> = [
    {
      questionId: "ANTEC-SEED-01",
      type: "commercial",
      fieldId: "site_readiness",
      question:
        "Land plot next to Vest Biogas (~80×120 m²): will terms be rent/lease or ownership, and what terms apply?",
    },
    {
      questionId: "ANTEC-SEED-02",
      type: "technical",
      fieldId: "utilities",
      question:
        "Utility capacity and thermal heat exchange tie-in terms with Vest Biogas — what is confirmed and what must still be secured?",
    },
    {
      questionId: "ANTEC-SEED-03",
      type: "commercial",
      fieldId: "offtake_strategy",
      question:
        "Surplus thermal heat offtake (~7–8 GWh/year): energy form (steam / hot water / temperature), volume (MWh/year), and price terms?",
    },
    {
      questionId: "ANTEC-SEED-04",
      type: "commercial",
      fieldId: "offtake_strategy",
      question:
        "Will Vest Biogas also want Standard Bio to pyrolyse/treat dried digestate, or is that still undecided?",
    },
    {
      questionId: "ANTEC-SEED-05",
      type: "commercial",
      fieldId: "end_product",
      question:
        "Biochar product offtake: buyers, specification, volume, pricing, carbon credits — what is known vs open?",
    },
  ];

  return seeds.map((seed) => ({
    questionId: seed.questionId,
    type: seed.type,
    question: seed.question,
    fieldId: seed.fieldId,
    status: "open" as const,
  }));
}

/** Add a user-written question. Optional company from the roster only. */
export function addQueryPosition(
  pack: QueryPack,
  input: {
    question: string;
    type: QueryPositionType;
    company?: { companyId: string; companyTitle: string };
    contact?: { contactId?: string; contactTitle: string };
    responseRequiredBy?: string;
    attachments?: QueryPositionAttachment[];
  },
): QueryPack {
  const question = input.question.trim();
  if (!question) {
    throw new Error("Write the question first.");
  }
  const attachments = input.attachments?.length ? input.attachments : undefined;
  const due = input.responseRequiredBy?.trim() || undefined;
  const position: QueryPosition = {
    questionId: newId("Q"),
    type: input.type,
    question,
    status: "open",
    companyId: input.company?.companyId.trim() || undefined,
    companyTitle: input.company?.companyTitle.trim() || undefined,
    contactId: input.contact?.contactId?.trim() || undefined,
    contactTitle: input.contact?.contactTitle.trim() || undefined,
    responseRequiredBy: due,
    attachments,
  };
  return {
    ...pack,
    updatedAt: new Date().toISOString(),
    positions: [...pack.positions, position],
  };
}

/** Update an existing question from the form card. Keeps answer, attachments, provenance. */
export function updateQueryPosition(
  pack: QueryPack,
  questionId: string,
  input: {
    question: string;
    type: QueryPositionType;
    company?: { companyId: string; companyTitle: string };
    contact?: { contactId?: string; contactTitle: string };
    responseRequiredBy?: string;
  },
): QueryPack {
  const question = input.question.trim();
  if (!question) {
    throw new Error("Write the question first.");
  }
  const due = input.responseRequiredBy?.trim() || undefined;
  let found = false;
  const positions = pack.positions.map((position) => {
    if (position.questionId !== questionId) return position;
    found = true;
    return {
      ...position,
      type: input.type,
      question,
      companyId: input.company?.companyId.trim() || undefined,
      companyTitle: input.company?.companyTitle.trim() || undefined,
      contactId: input.contact?.contactId?.trim() || undefined,
      contactTitle: input.contact?.contactTitle.trim() || undefined,
      responseRequiredBy: due,
    };
  });
  if (!found) {
    throw new Error("Question not found.");
  }
  return {
    ...pack,
    updatedAt: new Date().toISOString(),
    positions,
  };
}

export function addQueryAttachment(
  pack: QueryPack,
  questionId: string,
  input: {
    kind: QueryPositionAttachmentKind;
    label: string;
    url: string;
  },
): QueryPack {
  const label = input.label.trim() || input.kind;
  const url = input.url.trim();
  if (!url) {
    throw new Error("Paste a link (or choose a small picture).");
  }
  if (input.kind === "picture") {
    if (!isHttpOrDataUrl(url)) {
      throw new Error("Picture needs a web/SharePoint link or a small image file.");
    }
    if (url.startsWith("data:") && url.length > MAX_PICTURE_DATA_URL_CHARS) {
      throw new Error("Picture is too large — put it in SharePoint and paste the link.");
    }
  } else if (!/^https?:\/\//i.test(url)) {
    throw new Error("Use a http(s) link — upload in SharePoint first if needed.");
  }

  const attachment: QueryPositionAttachment = {
    id: newId("QA"),
    kind: input.kind,
    label,
    url,
  };

  let found = false;
  const positions = pack.positions.map((position) => {
    if (position.questionId !== questionId) return position;
    found = true;
    return {
      ...position,
      attachments: [...(position.attachments ?? []), attachment],
    };
  });
  if (!found) {
    throw new Error("Question not found.");
  }
  return {
    ...pack,
    updatedAt: new Date().toISOString(),
    positions,
  };
}

export function removeQueryAttachment(
  pack: QueryPack,
  questionId: string,
  attachmentId: string,
): QueryPack {
  return {
    ...pack,
    updatedAt: new Date().toISOString(),
    positions: pack.positions.map((position) =>
      position.questionId === questionId
        ? {
            ...position,
            attachments: (position.attachments ?? []).filter(
              (row) => row.id !== attachmentId,
            ),
          }
        : position,
    ),
  };
}

export function formatAttachmentsForExcel(
  attachments: QueryPositionAttachment[] | undefined,
): string {
  if (!attachments?.length) return "";
  return attachments
    .map((row) => {
      if (row.url.startsWith("data:")) {
        return `${row.kind}:${row.label} (embedded picture)`;
      }
      return `${row.kind}:${row.label} ${row.url}`;
    })
    .join(" | ");
}

export function assignPositionCompany(
  pack: QueryPack,
  questionId: string,
  company: { companyId: string; companyTitle: string },
  contact?: { contactId: string; contactTitle: string },
): QueryPack {
  const companyId = company.companyId.trim();
  const companyTitle = company.companyTitle.trim();
  if (!companyId || !companyTitle) {
    throw new Error("Company id and title are required (roster only).");
  }

  return {
    ...pack,
    updatedAt: new Date().toISOString(),
    positions: pack.positions.map((position) =>
      position.questionId === questionId
        ? {
            ...position,
            companyId,
            companyTitle,
            contactId: contact?.contactId.trim() || undefined,
            contactTitle: contact?.contactTitle.trim() || undefined,
          }
        : position,
    ),
  };
}

/** Positions for one recipient Excel — isolation by companyId. */
export function rowsForCompanyExport(
  pack: QueryPack,
  companyId: string,
): QueryPosition[] {
  const id = companyId.trim();
  if (!id) return [];
  return pack.positions.filter((row) => row.companyId === id);
}

export function markRecipientSent(
  pack: QueryPack,
  recipient: QueryPackRecipientFile,
): QueryPack {
  const others = pack.recipientFiles.filter((row) => row.companyId !== recipient.companyId);
  const nextFiles = [...others, { ...recipient, sentAt: recipient.sentAt ?? new Date().toISOString() }];
  const anySent = nextFiles.some((row) => row.sentAt);
  return {
    ...pack,
    recipientFiles: nextFiles,
    status: anySent ? (pack.status === "draft" ? "sent" : pack.status) : pack.status,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Match import rows by QuestionId only. Rows without QuestionId → unmatched.
 * Never invent field mappings.
 */
export function diffImportAnswers(
  pack: QueryPack,
  rows: QueryPackImportRow[],
): QueryPackImportResult {
  const byId = new Map(pack.positions.map((row) => [row.questionId, row]));
  const proposals: QueryPackAnswerProposal[] = [];
  const unmatched: QueryPackImportResult["unmatched"] = [];

  for (const row of rows) {
    const questionId = row.questionId.trim();
    if (!questionId) {
      unmatched.push({
        reason: "Missing QuestionId — cannot auto-match",
        raw: {
          answer: row.answer,
          comment: row.comment,
          companyId: row.companyId ?? "",
        },
      });
      continue;
    }

    const position = byId.get(questionId);
    if (!position) {
      unmatched.push({
        reason: `Unknown QuestionId: ${questionId}`,
        raw: {
          questionId,
          answer: row.answer,
          comment: row.comment,
        },
      });
      continue;
    }

    const nextAnswer = row.answer.trim();
    const nextComment = row.comment.trim();
    if (!nextAnswer && !nextComment) continue;

    const prevAnswer = (position.answer ?? "").trim();
    const prevComment = (position.comment ?? "").trim();
    if (nextAnswer === prevAnswer && nextComment === prevComment) continue;

    proposals.push({
      questionId,
      previousAnswer: prevAnswer || undefined,
      nextAnswer,
      previousComment: prevComment || undefined,
      nextComment,
      fieldId: position.fieldId,
      companyId: position.companyId,
      companyTitle: position.companyTitle,
      question: position.question,
      type: position.type,
    });
  }

  return { proposals, unmatched };
}

export function acceptAnswerProposals(
  pack: QueryPack,
  proposals: QueryPackAnswerProposal[],
  meta?: {
    sharePointItemId?: string;
    sharePointVersionId?: string;
    sourceFileName?: string;
    companyId?: string;
  },
): { pack: QueryPack; finding: SourceFinding } {
  const acceptedIds = new Set(proposals.map((row) => row.questionId));
  const importedAt = new Date().toISOString();

  const positions = pack.positions.map((position) => {
    const proposal = proposals.find((row) => row.questionId === position.questionId);
    if (!proposal) return position;
    return {
      ...position,
      status: "answered" as const,
      answer: proposal.nextAnswer,
      comment: proposal.nextComment || undefined,
      provenance: {
        packId: pack.packId,
        companyId: meta?.companyId ?? position.companyId,
        sharePointItemId: meta?.sharePointItemId,
        sharePointVersionId: meta?.sharePointVersionId,
        importedAt,
        sourceFileName: meta?.sourceFileName,
      },
    };
  });

  const answeredCount = positions.filter((row) => row.status === "answered").length;
  const openAssigned = positions.filter((row) => row.companyId && row.status === "open").length;
  let status = pack.status;
  if (answeredCount > 0 && openAssigned === 0) status = "imported";
  else if (answeredCount > 0) status = "partially_returned";

  const nextPack: QueryPack = {
    ...pack,
    positions,
    status,
    updatedAt: importedAt,
  };

  const companyLabel =
    proposals[0]?.companyTitle ??
    meta?.companyId ??
    "recipient";

  const claims = proposals.map((proposal, index) => {
    const fieldId =
      proposal.fieldId && isUnderstandingFieldId(proposal.fieldId)
        ? proposal.fieldId
        : undefined;
    const impact = fieldId
      ? `Updates deal understanding (${fieldId}) from Query Pack answers.`
      : "Adds confirmed commercial/technical knowledge from Query Pack answers.";
    return {
      id: `${pack.packId}-claim-${proposal.questionId}-${index + 1}`,
      statement: proposal.nextAnswer || proposal.nextComment,
      impact,
      fieldId,
    };
  });

  const finding = createSourceFinding({
    title: `Query Pack ${pack.title} — ${companyLabel}`,
    note: [
      `packId=${pack.packId}`,
      meta?.sharePointItemId ? `sharePointItemId=${meta.sharePointItemId}` : null,
      meta?.sharePointVersionId ? `sharePointVersionId=${meta.sharePointVersionId}` : null,
      meta?.sourceFileName ? `file=${meta.sourceFileName}` : null,
      `questions=${[...acceptedIds].join(",")}`,
    ]
      .filter(Boolean)
      .join(" · "),
    kind: "document",
    claims,
  });

  return { pack: nextPack, finding };
}

export function mergeAcceptedQueryPackFinding(
  understanding: OpportunityUnderstandingCapture | undefined,
  pack: QueryPack,
  finding: SourceFinding,
): OpportunityUnderstandingCapture {
  const findings = [...(understanding?.findings ?? []), finding];
  return {
    fields: understanding?.fields ?? {},
    discoveryNotes: understanding?.discoveryNotes,
    findings,
    queryPack: pack,
    updatedAt: new Date().toISOString(),
  };
}

export function waitingOnCompanies(pack: QueryPack): string[] {
  const waiting = new Set<string>();
  for (const position of pack.positions) {
    if (position.companyId && position.status === "open") {
      waiting.add(position.companyTitle || position.companyId);
    }
  }
  return [...waiting].sort((a, b) => a.localeCompare(b));
}

/** Defensive parse for understanding JSON (Reality First — drop invalid shapes). */
export function parseQueryPack(raw: unknown): QueryPack | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const row = raw as Record<string, unknown>;
  const packId = typeof row.packId === "string" ? row.packId.trim() : "";
  const scopeId = typeof row.scopeId === "string" ? row.scopeId.trim() : "";
  const title = typeof row.title === "string" ? row.title.trim() : "";
  if (!packId || !scopeId || !title) return undefined;
  const scope = row.scope === "project" ? "project" : "opportunity";
  const status =
    row.status === "sent" ||
    row.status === "partially_returned" ||
    row.status === "returned" ||
    row.status === "imported" ||
    row.status === "closed"
      ? row.status
      : "draft";
  const positions = Array.isArray(row.positions)
    ? row.positions.flatMap((entry): QueryPosition[] => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
        const pos = entry as Record<string, unknown>;
        const questionId = typeof pos.questionId === "string" ? pos.questionId.trim() : "";
        const question = typeof pos.question === "string" ? pos.question.trim() : "";
        if (!questionId || !question) return [];
        const type: QueryPositionType = pos.type === "technical" ? "technical" : "commercial";
        const positionStatus =
          pos.status === "answered" || pos.status === "waived" ? pos.status : "open";
        const fieldId =
          typeof pos.fieldId === "string" && isUnderstandingFieldId(pos.fieldId)
            ? pos.fieldId
            : undefined;
        return [
          {
            questionId,
            type,
            question,
            fieldId,
            companyId: typeof pos.companyId === "string" ? pos.companyId : undefined,
            companyTitle: typeof pos.companyTitle === "string" ? pos.companyTitle : undefined,
            contactId: typeof pos.contactId === "string" ? pos.contactId : undefined,
            contactTitle: typeof pos.contactTitle === "string" ? pos.contactTitle : undefined,
            status: positionStatus,
            answer: typeof pos.answer === "string" ? pos.answer : undefined,
            comment: typeof pos.comment === "string" ? pos.comment : undefined,
            responseRequiredBy:
              typeof pos.responseRequiredBy === "string" && pos.responseRequiredBy.trim()
                ? pos.responseRequiredBy.trim().slice(0, 10)
                : undefined,
            attachments: (() => {
              const attachments = parseQueryPositionAttachments(pos.attachments);
              return attachments.length > 0 ? attachments : undefined;
            })(),
          },
        ];
      })
    : [];
  const recipientFiles = Array.isArray(row.recipientFiles)
    ? row.recipientFiles.flatMap((entry): QueryPackRecipientFile[] => {
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
        const file = entry as Record<string, unknown>;
        const companyId = typeof file.companyId === "string" ? file.companyId.trim() : "";
        const companyTitle = typeof file.companyTitle === "string" ? file.companyTitle.trim() : "";
        if (!companyId || !companyTitle) return [];
        return [
          {
            companyId,
            companyTitle,
            fileUrl: typeof file.fileUrl === "string" ? file.fileUrl : undefined,
            sharePointItemId:
              typeof file.sharePointItemId === "string" ? file.sharePointItemId : undefined,
            sharePointVersionId:
              typeof file.sharePointVersionId === "string" ? file.sharePointVersionId : undefined,
            sentAt: typeof file.sentAt === "string" ? file.sentAt : undefined,
            returnedAt: typeof file.returnedAt === "string" ? file.returnedAt : undefined,
          },
        ];
      })
    : [];

  return {
    packId,
    scope,
    scopeId,
    title,
    status,
    positions,
    recipientFiles,
    masterFileUrl: typeof row.masterFileUrl === "string" ? row.masterFileUrl : undefined,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : new Date().toISOString(),
    updatedAt: typeof row.updatedAt === "string" ? row.updatedAt : new Date().toISOString(),
    ownerTitle: typeof row.ownerTitle === "string" ? row.ownerTitle : undefined,
  };
}
