import "server-only";

import { getPrisma } from "@/lib/prisma";
import { getGraphAccessToken } from "@/lib/m365/get-graph-access-token";
import { downloadSharePointDriveItemBytes } from "@/lib/m365/graph-client";
import { findPrismaOpportunityByRouteKey } from "@/lib/resolve-opportunity-route";
import {
  extractTextFromDocumentBytes,
  imageMediaTypeForLlm,
  looksLikeImage,
  looksLikePdf,
} from "@/lib/document-text-extract";
import { classifyByFileName } from "@/lib/mock-ai-parser";
import {
  createSourceFinding,
  extractDocumentMetadataClaims,
  extractSourceFindingPreview,
  type SourceFinding,
  type SourceFindingClaim,
} from "@/lib/source-findings";
import { parseCompanyDocumentKnowledgeState } from "@/lib/company-document-knowledge";
import {
  readEmailsForOpportunity,
  readEmailsForProject,
} from "@/lib/email-intelligence-data";
import { isInternalEmail } from "@/lib/domain-rules";
import { isUnderstandingFieldId, UNDERSTANDING_FIELDS } from "@/types/opportunity-understanding";
import { smartDocHref } from "@/types/smartdoc";

const MAX_FILE_BYTES = 15_000_000;
const MAX_LLM_ATTACHMENT_BYTES = 4_500_000;

export type DocumentFindingsResult = {
  findings: SourceFinding[];
  unread: Array<{ name: string; reason: string }>;
};

function cleanDocumentTitle(name: string): string {
  return (
    name
      .replace(/\.[^.]+$/, "")
      .replace(/^(?:PL|CO|PRJ)-[A-Z0-9]+(?:-[A-Z0-9]+)*-[A-Z]-[A-Z]{2,4}-\d{4}\s*/i, "")
      .trim() || name
  );
}

function mergeClaims(
  primary: SourceFindingClaim[],
  secondary: SourceFindingClaim[],
): SourceFindingClaim[] {
  const seen = new Set<string>();
  const out: SourceFindingClaim[] = [];
  for (const row of [...primary, ...secondary]) {
    if (row.id === "attached" && secondary.length > 0) continue;
    const key = row.statement.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out.slice(0, 8);
}

async function extractVisualOrDocumentClaimsWithLlm(input: {
  bytes: Buffer;
  name: string;
  mimeType: string | null;
}): Promise<SourceFindingClaim[]> {
  if (input.bytes.length > MAX_LLM_ATTACHMENT_BYTES) return [];
  const { getDefaultTransport } = await import("@/lib/ai/llm-client");
  const transport = getDefaultTransport();
  if (!transport) return [];

  const imageMedia = imageMediaTypeForLlm({
    name: input.name,
    mimeType: input.mimeType,
    bytes: input.bytes,
  });
  const isPdf = looksLikePdf({
    name: input.name,
    mimeType: input.mimeType,
    bytes: input.bytes,
  });
  if (!imageMedia && !isPdf) return [];

  const fieldEnum = UNDERSTANDING_FIELDS.map((f) => f.id);
  try {
    const raw = await transport({
      task: "opportunity-visual-finding",
      system:
        "You extract factual business and engineering knowledge from a document, drawing, or picture attached to an opportunity. Never invent facts, people, or companies. Return concise 1-sentence business statements and why each matters.",
      user: `File name: ${input.name}\nExtract up to 5 concrete facts visible in this file.`,
      toolName: "record_visual_findings",
      toolDescription: "Record factual claims extracted from the file.",
      inputSchema: {
        type: "object",
        properties: {
          claims: {
            type: "array",
            items: {
              type: "object",
              properties: {
                statement: { type: "string" },
                impact: { type: "string" },
                fieldId: { type: "string", enum: fieldEnum },
              },
              required: ["statement", "impact"],
            },
          },
        },
        required: ["claims"],
      },
      maxTokens: 1200,
      attachment: imageMedia
        ? {
            kind: "image",
            mediaType: imageMedia,
            base64: input.bytes.toString("base64"),
          }
        : {
            kind: "document",
            mediaType: "application/pdf",
            base64: input.bytes.toString("base64"),
          },
    });
    if (!raw || typeof raw !== "object") return [];
    const items = (raw as { claims?: unknown }).claims;
    if (!Array.isArray(items)) return [];
    const claims: SourceFindingClaim[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i] as Record<string, unknown> | null;
      if (!item || typeof item !== "object") continue;
      const statement = typeof item.statement === "string" ? item.statement.trim() : "";
      const impact = typeof item.impact === "string" ? item.impact.trim() : "";
      if (!statement || !impact) continue;
      const fieldId =
        typeof item.fieldId === "string" && isUnderstandingFieldId(item.fieldId)
          ? item.fieldId
          : undefined;
      claims.push({
        id: `llm-${i + 1}`,
        statement,
        impact,
        fieldId,
      });
    }
    return claims;
  } catch {
    return [];
  }
}

/**
 * Read ALL opportunity knowledge sources — documents, pictures/drawings,
 * client emails, subsupplier emails, activities/meetings, and company findings —
 * and propose structured findings that flow into the opportunity.
 */
export async function buildOpportunityDocumentFindings(
  routeKey: string,
): Promise<DocumentFindingsResult> {
  const opportunity = await findPrismaOpportunityByRouteKey(routeKey);
  if (!opportunity) {
    throw Object.assign(new Error("Opportunity not found"), { status: 404 });
  }

  const prisma = getPrisma();
  const [records, activities, meetings, companyRow, emails] = await Promise.all([
    prisma.documentRecord.findMany({
      where: {
        OR: [
          { opportunityId: opportunity.id },
          ...(opportunity.companyId ? [{ companyId: opportunity.companyId }] : []),
          { emailMessage: { opportunityId: opportunity.id } },
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 25,
      select: {
        id: true,
        name: true,
        mimeType: true,
        source: true,
        contentBase64: true,
        sharepointItemId: true,
        sharepointWebUrl: true,
      },
    }),
    prisma.activity
      .findMany({
        where: {
          OR: [
            { opportunityId: opportunity.id },
            ...(opportunity.companyId ? [{ companyId: opportunity.companyId }] : []),
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: 15,
        select: {
          id: true,
          seq: true,
          title: true,
          activityType: true,
          details: true,
          opportunityId: true,
        },
      })
      .catch(() => []),
    prisma.meetingRecord
      .findMany({
        where: {
          OR: [
            { opportunityId: opportunity.id },
            ...(opportunity.companyId ? [{ companyId: opportunity.companyId }] : []),
          ],
        },
        include: { commitments: true },
        orderBy: { startTime: "desc" },
        take: 10,
      })
      .catch(() => []),
    opportunity.companyId
      ? prisma.company
          .findUnique({
            where: { id: opportunity.companyId },
            select: { name: true, documentKnowledge: true, contacts: { select: { emails: true } } },
          })
          .catch(() => null)
      : Promise.resolve(null),
    readEmailsForOpportunity(opportunity.id).catch(() => []),
  ]);

  const findings: SourceFinding[] = [];
  const unread: Array<{ name: string; reason: string }> = [];

  // 1. Documents & Pictures (PDFs, PPTX, DOCX, XLSX, Drawings, Certificates, Photos)
  const seenDocNames = new Set<string>();
  for (const record of records) {
    // Skip raw .eml backup wrappers when email messages themselves are processed below
    if (record.source === "m365_eml" || /\.eml$/i.test(record.name)) continue;
    const dedupeKey = record.name.trim().toLowerCase();
    if (seenDocNames.has(dedupeKey)) continue;
    seenDocNames.add(dedupeKey);

    const classified = classifyByFileName(record.name);
    const isImage = looksLikeImage({ name: record.name, mimeType: record.mimeType });
    const cleanTitle = cleanDocumentTitle(record.name);
    const docUrl = record.sharepointWebUrl || smartDocHref(record.id);

    const metadataClaims = extractDocumentMetadataClaims({
      name: record.name,
      mimeType: record.mimeType,
      docCategory: classified.DocCategory,
      docType: classified.DocType,
      origin: classified.Origin,
      counterparty: classified.Counterparty,
    });

    try {
      const bytes = await loadDocumentBytes(record);
      let contentClaims: SourceFindingClaim[] = [];

      if (bytes && bytes.length <= MAX_FILE_BYTES) {
        const extracted = await extractTextFromDocumentBytes({
          bytes,
          name: record.name,
          mimeType: record.mimeType,
        });
        if (extracted.text.length >= 20) {
          const preview = extractSourceFindingPreview(extracted.text, docUrl, cleanTitle);
          contentClaims = preview.claims;
        } else if (extracted.kind === "image" || extracted.kind === "pdf") {
          contentClaims = await extractVisualOrDocumentClaimsWithLlm({
            bytes,
            name: record.name,
            mimeType: record.mimeType,
          });
        }
      }

      const combinedClaims = mergeClaims(contentClaims, metadataClaims);
      if (combinedClaims.length > 0) {
        findings.push(
          createSourceFinding({
            title: cleanTitle,
            url: docUrl,
            note: record.name,
            kind: isImage ? "image" : "document",
            claims: combinedClaims,
          }),
        );
      }
    } catch (error) {
      if (metadataClaims.length > 0) {
        findings.push(
          createSourceFinding({
            title: cleanTitle,
            url: docUrl,
            note: record.name,
            kind: isImage ? "image" : "document",
            claims: metadataClaims,
          }),
        );
      } else {
        unread.push({
          name: record.name,
          reason: error instanceof Error ? error.message : "Could not read this file",
        });
      }
    }
  }

  // 2. Client & Subsupplier Email Correspondence
  const clientDomains = new Set<string>();
  for (const contact of companyRow?.contacts ?? []) {
    if (!Array.isArray(contact.emails)) continue;
    for (const entry of contact.emails as Array<{ address?: unknown } | string>) {
      const addr =
        typeof entry === "string"
          ? entry
          : typeof entry?.address === "string"
            ? entry.address
            : "";
      const domain = addr.split("@")[1]?.trim().toLowerCase();
      if (domain) clientDomains.add(domain);
    }
  }

  const validEmails = emails.filter(
    (msg) =>
      !msg.isDeletedInSource &&
      !/^(automatic reply|autosvar|undeliverable|accepted:|declined:|canceled:|godtatt:)/i.test(
        msg.subject.trim(),
      ),
  );

  const byConversation = new Map<string, typeof validEmails>();
  for (const msg of validEmails) {
    const list = byConversation.get(msg.conversationId) ?? [];
    list.push(msg);
    byConversation.set(msg.conversationId, list);
  }

  for (const [conversationId, threadMessages] of byConversation) {
    const externalParticipants = [
      ...new Set(
        threadMessages
          .flatMap((m) => [m.senderEmail, ...m.recipientEmails])
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.includes("@") && !isInternalEmail(e)),
      ),
    ];

    const externalDomains = [
      ...new Set(externalParticipants.map((e) => e.split("@")[1] ?? "").filter(Boolean)),
    ];
    const isClientThread = externalDomains.some(
      (domain) =>
        clientDomains.has(domain) ||
        (opportunity.company?.name &&
          domain.includes(
            opportunity.company.name
              .toLowerCase()
              .replace(/\b(as|ab|asa|ltd|inc|gmbh|biogas|biogass)\b/g, "")
              .replace(/[^a-z0-9]/g, "")
              .slice(0, 6),
          )),
    );
    const counterpartyLabel =
      externalParticipants.length === 0
        ? "Internal team mail (standard.bio)"
        : isClientThread
          ? `Client mail (${opportunity.company?.name || externalDomains[0]})`
          : `Subsupplier / partner mail (${externalDomains.join(", ")})`;

    const latestSubject =
      threadMessages[threadMessages.length - 1]?.subject ||
      threadMessages[0]?.subject ||
      "Correspondence";
    const combinedText = threadMessages
      .map((m) => `${m.subject}\n${m.bodyPreview ?? ""}`)
      .join("\n\n");
    if (combinedText.trim().length < 20) continue;

    const preview = extractSourceFindingPreview(
      combinedText,
      `/opportunities/${encodeURIComponent(opportunity.id)}?view=actions&action=emails`,
      `${counterpartyLabel}: ${latestSubject}`,
    );
    const meaningfulClaims = preview.claims.filter((c) => c.id !== "attached");
    if (meaningfulClaims.length > 0) {
      findings.push(
        createSourceFinding({
          title: `${counterpartyLabel}: ${latestSubject}`,
          url: `/opportunities/${encodeURIComponent(opportunity.id)}?view=actions&action=emails`,
          note: `mail-thread:${conversationId}`,
          kind: "email",
          claims: meaningfulClaims,
        }),
      );
    }
  }

  // 3. Activities & Meetings (Client & Subsupplier calls, site visits, notes, commitments)
  for (const act of activities) {
    const details = (act.details ?? {}) as Record<string, unknown>;
    const dealRef = (details.Deal as { Title?: string } | null)?.Title;
    const linkedDeals = Array.isArray(details.LinkedDeals)
      ? (details.LinkedDeals as Array<{ Title?: string }>)
      : [];
    const belongsToDeal =
      act.opportunityId === opportunity.id ||
      dealRef === opportunity.id ||
      linkedDeals.some((d) => d?.Title === opportunity.id);
    if (!belongsToDeal) continue;

    const description =
      typeof details.ActivityDescription === "string" ? details.ActivityDescription : "";
    const summary = typeof details.Summary === "string" ? details.Summary : "";
    const decisions = Array.isArray(details.KeyDecisions)
      ? (details.KeyDecisions as unknown[]).filter((d): d is string => typeof d === "string")
      : [];
    const agreedActions = Array.isArray(details.AgreedActions)
      ? (details.AgreedActions as Array<{ text?: string; dueDate?: string }>)
      : [];
    const risks = Array.isArray(details.Risks)
      ? (details.Risks as unknown[]).filter((r): r is string => typeof r === "string")
      : [];

    const textCorpus = [act.title, summary, description, ...decisions, ...risks]
      .filter(Boolean)
      .join("\n");
    if (textCorpus.trim().length < 20) continue;

    const actIdLabel = `ACT-${act.seq}`;
    const actUrl = `/activities/${encodeURIComponent(actIdLabel)}`;
    const preview = extractSourceFindingPreview(
      textCorpus,
      actUrl,
      `${act.title || act.activityType} (${actIdLabel})`,
    );
    const structuredClaims: SourceFindingClaim[] = [];

    for (const dec of decisions) {
      if (!dec.trim()) continue;
      structuredClaims.push({
        id: `decision-${act.id}`,
        statement: `Decision recorded in ${act.title || actIdLabel}: ${dec.trim()}.`,
        impact: "Confirmed meeting/site-visit decisions reduce project uncertainty.",
        fieldId: /footprint|site|plot|layout|plass/i.test(dec) ? "site_readiness" : undefined,
      });
    }
    for (const agreed of agreedActions) {
      if (!agreed?.text?.trim()) continue;
      const due = agreed.dueDate ? ` (due ${agreed.dueDate})` : "";
      structuredClaims.push({
        id: `agreed-${act.id}-${agreed.text.slice(0, 16)}`,
        statement: `Agreed action: ${agreed.text.trim()}${due}.`,
        impact: "Tracks concrete follow-through agreed with the client or subsupplier.",
        fieldId: /utility|utilities|power|water|heat/i.test(agreed.text)
          ? "utilities"
          : /layout|site|drawing/i.test(agreed.text)
            ? "site_readiness"
            : undefined,
      });
    }

    const combined = mergeClaims(
      structuredClaims,
      preview.claims.filter((c) => c.id !== "attached"),
    );
    if (combined.length > 0) {
      findings.push(
        createSourceFinding({
          title: `${act.title || act.activityType} (${actIdLabel})`,
          url: actUrl,
          note: `activity:${act.id}`,
          kind: "activity",
          claims: combined,
        }),
      );
    }
  }

  for (const meeting of meetings) {
    const summaryText = [
      meeting.subject,
      meeting.aiSummary ?? "",
      ...meeting.commitments.map((c) => c.description),
    ]
      .filter(Boolean)
      .join("\n");
    if (summaryText.trim().length < 20) continue;

    const preview = extractSourceFindingPreview(
      summaryText,
      `/opportunities/${encodeURIComponent(opportunity.id)}?view=actions&action=meetings`,
      `Meeting: ${meeting.subject}`,
    );
    const claims = preview.claims.filter((c) => c.id !== "attached");
    if (claims.length > 0) {
      findings.push(
        createSourceFinding({
          title: `Meeting: ${meeting.subject}`,
          url: `/opportunities/${encodeURIComponent(opportunity.id)}?view=actions&action=meetings`,
          note: `meeting:${meeting.id}`,
          kind: "activity",
          claims,
        }),
      );
    }
  }

  // 4. Company-level findings (so account knowledge flows into the opportunity)
  if (companyRow?.documentKnowledge) {
    const companyState = parseCompanyDocumentKnowledgeState(companyRow.documentKnowledge);
    for (const companyFinding of companyState.findings ?? []) {
      if (companyFinding.claims.length > 0) {
        findings.push(companyFinding);
      }
    }
  }

  if (findings.length === 0 && unread.length === 0) {
    return {
      findings,
      unread: [
        {
          name: "Sources",
          reason:
            "No documents, pictures, emails, or activities are linked on this opportunity yet.",
        },
      ],
    };
  }

  return { findings, unread };
}

/**
 * Read ALL project knowledge sources — documents, pictures/drawings, external
 * partner/supplier/offtaker emails, internal (@standard.bio) team emails,
 * activities/meetings, and related company findings — and propose structured
 * findings that flow into the project's FEL 1 → Realisation understanding.
 */
export async function buildProjectDocumentFindings(
  projectId: string,
): Promise<DocumentFindingsResult> {
  const { readProjectById } = await import("@/lib/project-db");
  const { resolveOpportunityId } = await import("@/lib/meeting-intelligence-data");
  const project = await readProjectById(projectId);
  if (!project) {
    throw Object.assign(new Error("Project not found"), { status: 404 });
  }

  const prisma = getPrisma();
  const linkedOppUuid = project.linkedDealId?.trim()
    ? await resolveOpportunityId(project.linkedDealId.trim())
    : null;

  const companyRefs = [
    ...new Set(
      [
        project.linkedCompanyId,
        ...(project.relatedOrganizations ?? []).map((o) => o.companyId),
      ]
        .map((c) => c?.trim())
        .filter((c): c is string => Boolean(c)),
    ),
  ];
  const companyCodes = companyRefs.filter((ref) => /^CO-\d+/i.test(ref));
  const companyUuids = companyRefs.filter((ref) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(ref),
  );

  const relatedCompanies =
    companyCodes.length > 0 || companyUuids.length > 0
      ? await prisma.company
          .findMany({
            where: {
              OR: [
                ...(companyCodes.length > 0 ? [{ code: { in: companyCodes } }] : []),
                ...(companyUuids.length > 0 ? [{ id: { in: companyUuids } }] : []),
              ],
            },
            select: {
              id: true,
              name: true,
              documentKnowledge: true,
              contacts: { select: { emails: true } },
            },
          })
          .catch(() => [])
      : [];

  const relatedCompanyUuids = relatedCompanies.map((c) => c.id);

  const [records, activities, meetings, emails] = await Promise.all([
    prisma.documentRecord.findMany({
      where: {
        OR: [
          { name: { startsWith: `${project.id}-`, mode: "insensitive" } },
          ...(linkedOppUuid ? [{ opportunityId: linkedOppUuid }] : []),
          ...(relatedCompanyUuids.length > 0
            ? [{ companyId: { in: relatedCompanyUuids } }]
            : []),
          { emailMessage: { projectId: project.id } },
          ...(linkedOppUuid
            ? [{ emailMessage: { opportunityId: linkedOppUuid } }]
            : []),
        ],
      },
      orderBy: { updatedAt: "desc" },
      take: 30,
      select: {
        id: true,
        name: true,
        mimeType: true,
        source: true,
        contentBase64: true,
        sharepointItemId: true,
        sharepointWebUrl: true,
      },
    }),
    prisma.activity
      .findMany({
        where: {
          OR: [
            ...(linkedOppUuid ? [{ opportunityId: linkedOppUuid }] : []),
            ...(relatedCompanyUuids.length > 0
              ? [{ companyId: { in: relatedCompanyUuids } }]
              : []),
          ],
        },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          seq: true,
          title: true,
          activityType: true,
          details: true,
          opportunityId: true,
        },
      })
      .catch(() => []),
    prisma.meetingRecord
      .findMany({
        where: {
          OR: [
            ...(linkedOppUuid ? [{ opportunityId: linkedOppUuid }] : []),
            ...(relatedCompanyUuids.length > 0
              ? [{ companyId: { in: relatedCompanyUuids } }]
              : []),
          ],
        },
        include: { commitments: true },
        orderBy: { startTime: "desc" },
        take: 10,
      })
      .catch(() => []),
    readEmailsForProject(project.id).catch(() => []),
  ]);

  const findings: SourceFinding[] = [];
  const unread: Array<{ name: string; reason: string }> = [];

  // 1. Documents & Pictures
  const seenDocNames = new Set<string>();
  for (const record of records) {
    if (record.source === "m365_eml" || /\.eml$/i.test(record.name)) continue;
    const dedupeKey = record.name.trim().toLowerCase();
    if (seenDocNames.has(dedupeKey)) continue;
    seenDocNames.add(dedupeKey);

    const classified = classifyByFileName(record.name);
    const isImage = looksLikeImage({ name: record.name, mimeType: record.mimeType });
    const cleanTitle = cleanDocumentTitle(record.name);
    const docUrl = record.sharepointWebUrl || smartDocHref(record.id);

    const metadataClaims = extractDocumentMetadataClaims({
      name: record.name,
      mimeType: record.mimeType,
      docCategory: classified.DocCategory,
      docType: classified.DocType,
      origin: classified.Origin,
      counterparty: classified.Counterparty,
    });

    try {
      const bytes = await loadDocumentBytes(record);
      let contentClaims: SourceFindingClaim[] = [];

      if (bytes && bytes.length <= MAX_FILE_BYTES) {
        const extracted = await extractTextFromDocumentBytes({
          bytes,
          name: record.name,
          mimeType: record.mimeType,
        });
        if (extracted.text.length >= 20) {
          const preview = extractSourceFindingPreview(extracted.text, docUrl, cleanTitle);
          contentClaims = preview.claims;
        } else if (extracted.kind === "image" || extracted.kind === "pdf") {
          contentClaims = await extractVisualOrDocumentClaimsWithLlm({
            bytes,
            name: record.name,
            mimeType: record.mimeType,
          });
        }
      }

      const combinedClaims = mergeClaims(contentClaims, metadataClaims);
      if (combinedClaims.length > 0) {
        findings.push(
          createSourceFinding({
            title: cleanTitle,
            url: docUrl,
            note: record.name,
            kind: isImage ? "image" : "document",
            claims: combinedClaims,
          }),
        );
      }
    } catch (error) {
      if (metadataClaims.length > 0) {
        findings.push(
          createSourceFinding({
            title: cleanTitle,
            url: docUrl,
            note: record.name,
            kind: isImage ? "image" : "document",
            claims: metadataClaims,
          }),
        );
      } else {
        unread.push({
          name: record.name,
          reason: error instanceof Error ? error.message : "Could not read this file",
        });
      }
    }
  }

  // 2. External (Partner / Offtaker / Supplier) & Internal (@standard.bio) Correspondence
  const validEmails = emails.filter(
    (msg) =>
      !msg.isDeletedInSource &&
      !/^(automatic reply|autosvar|undeliverable|accepted:|declined:|canceled:|godtatt:)/i.test(
        msg.subject.trim(),
      ),
  );

  const byConversation = new Map<string, typeof validEmails>();
  for (const msg of validEmails) {
    const list = byConversation.get(msg.conversationId) ?? [];
    list.push(msg);
    byConversation.set(msg.conversationId, list);
  }

  for (const [conversationId, threadMessages] of byConversation) {
    const externalParticipants = [
      ...new Set(
        threadMessages
          .flatMap((m) => [m.senderEmail, ...m.recipientEmails])
          .map((e) => e.trim().toLowerCase())
          .filter((e) => e.includes("@") && !isInternalEmail(e)),
      ),
    ];
    const externalDomains = [
      ...new Set(externalParticipants.map((e) => e.split("@")[1] ?? "").filter(Boolean)),
    ];
    const counterpartyLabel =
      externalParticipants.length === 0
        ? "Internal team mail (standard.bio)"
        : `Partner / supplier mail (${externalDomains.join(", ")})`;

    const latestSubject =
      threadMessages[threadMessages.length - 1]?.subject ||
      threadMessages[0]?.subject ||
      "Correspondence";
    const combinedText = threadMessages
      .map((m) => `${m.subject}\n${m.bodyPreview ?? ""}`)
      .join("\n\n");
    if (combinedText.trim().length < 20) continue;

    const mailUrl = `/projects/${encodeURIComponent(project.id)}?view=emails`;
    const preview = extractSourceFindingPreview(
      combinedText,
      mailUrl,
      `${counterpartyLabel}: ${latestSubject}`,
    );
    const meaningfulClaims = preview.claims.filter((c) => c.id !== "attached");
    if (meaningfulClaims.length > 0) {
      findings.push(
        createSourceFinding({
          title: `${counterpartyLabel}: ${latestSubject}`,
          url: mailUrl,
          note: `mail-thread:${conversationId}`,
          kind: "email",
          claims: meaningfulClaims,
        }),
      );
    }
  }

  // 3. Activities & Meetings
  for (const act of activities) {
    const details = (act.details ?? {}) as Record<string, unknown>;
    const description =
      typeof details.ActivityDescription === "string" ? details.ActivityDescription : "";
    const summary = typeof details.Summary === "string" ? details.Summary : "";
    const decisions = Array.isArray(details.KeyDecisions)
      ? (details.KeyDecisions as unknown[]).filter((d): d is string => typeof d === "string")
      : [];
    const agreedActions = Array.isArray(details.AgreedActions)
      ? (details.AgreedActions as Array<{ text?: string; dueDate?: string }>)
      : [];
    const risks = Array.isArray(details.Risks)
      ? (details.Risks as unknown[]).filter((r): r is string => typeof r === "string")
      : [];

    const textCorpus = [act.title, summary, description, ...decisions, ...risks]
      .filter(Boolean)
      .join("\n");
    if (textCorpus.trim().length < 20) continue;

    const actIdLabel = `ACT-${act.seq}`;
    const actUrl = `/activities/${encodeURIComponent(actIdLabel)}`;
    const preview = extractSourceFindingPreview(
      textCorpus,
      actUrl,
      `${act.title || act.activityType} (${actIdLabel})`,
    );
    const structuredClaims: SourceFindingClaim[] = [];

    for (const dec of decisions) {
      if (!dec.trim()) continue;
      structuredClaims.push({
        id: `decision-${act.id}`,
        statement: `Decision recorded in ${act.title || actIdLabel}: ${dec.trim()}.`,
        impact: "Confirmed meeting/site-visit decisions reduce project uncertainty.",
        fieldId: /footprint|site|plot|layout|plass/i.test(dec) ? "site_readiness" : undefined,
      });
    }
    for (const agreed of agreedActions) {
      if (!agreed?.text?.trim()) continue;
      const due = agreed.dueDate ? ` (due ${agreed.dueDate})` : "";
      structuredClaims.push({
        id: `agreed-${act.id}-${agreed.text.slice(0, 16)}`,
        statement: `Agreed action: ${agreed.text.trim()}${due}.`,
        impact: "Tracks concrete follow-through agreed with the partner or subsupplier.",
        fieldId: /utility|utilities|power|water|heat/i.test(agreed.text)
          ? "utilities"
          : /layout|site|drawing/i.test(agreed.text)
            ? "site_readiness"
            : undefined,
      });
    }

    const combined = mergeClaims(
      structuredClaims,
      preview.claims.filter((c) => c.id !== "attached"),
    );
    if (combined.length > 0) {
      findings.push(
        createSourceFinding({
          title: `${act.title || act.activityType} (${actIdLabel})`,
          url: actUrl,
          note: `activity:${act.id}`,
          kind: "activity",
          claims: combined,
        }),
      );
    }
  }

  for (const meeting of meetings) {
    const summaryText = [
      meeting.subject,
      meeting.aiSummary ?? "",
      ...meeting.commitments.map((c) => c.description),
    ]
      .filter(Boolean)
      .join("\n");
    if (summaryText.trim().length < 20) continue;

    const preview = extractSourceFindingPreview(
      summaryText,
      `/projects/${encodeURIComponent(project.id)}?view=actions&action=activities`,
      `Meeting: ${meeting.subject}`,
    );
    const claims = preview.claims.filter((c) => c.id !== "attached");
    if (claims.length > 0) {
      findings.push(
        createSourceFinding({
          title: `Meeting: ${meeting.subject}`,
          url: `/projects/${encodeURIComponent(project.id)}?view=actions&action=activities`,
          note: `meeting:${meeting.id}`,
          kind: "activity",
          claims,
        }),
      );
    }
  }

  // 4. Related company findings
  for (const companyRow of relatedCompanies) {
    if (!companyRow.documentKnowledge) continue;
    const companyState = parseCompanyDocumentKnowledgeState(companyRow.documentKnowledge);
    for (const companyFinding of companyState.findings ?? []) {
      if (companyFinding.claims.length > 0) {
        findings.push(companyFinding);
      }
    }
  }

  return { findings, unread };
}

async function resolveSharePointSiteIdFromWebUrl(
  accessToken: string,
  webUrl: string | null | undefined,
): Promise<string | null> {
  const envSiteId = process.env.SHAREPOINT_SITE_ID?.trim();
  if (envSiteId) return envSiteId;
  if (!webUrl?.trim()) return null;
  try {
    const parsed = new URL(webUrl);
    const match = parsed.pathname.match(/^\/(sites|teams)\/([^/]+)/i);
    if (!match) return null;
    const sitePath = `/${match[1]}/${match[2]}`;
    const response = await fetch(
      `https://graph.microsoft.com/v1.0/sites/${parsed.hostname}:${sitePath}?$select=id`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { id?: string };
    return data.id?.trim() || null;
  } catch {
    return null;
  }
}

async function loadDocumentBytes(record: {
  contentBase64: string | null;
  sharepointItemId: string | null;
  sharepointWebUrl?: string | null;
}): Promise<Buffer | null> {
  if (record.contentBase64?.trim()) {
    return Buffer.from(record.contentBase64, "base64");
  }
  if (!record.sharepointItemId?.trim()) return null;
  try {
    const accessToken = await getGraphAccessToken();
    const siteId = await resolveSharePointSiteIdFromWebUrl(
      accessToken,
      record.sharepointWebUrl,
    );
    if (!siteId) return null;
    return await downloadSharePointDriveItemBytes({
      accessToken,
      siteId,
      itemId: record.sharepointItemId,
    });
  } catch (error) {
    console.warn(
      "[document-findings] SharePoint download skipped:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}
