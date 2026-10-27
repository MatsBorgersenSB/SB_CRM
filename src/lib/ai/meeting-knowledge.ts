/**
 * FS-021 / FS-014 — LLM extraction of meeting knowledge, as proposals only.
 * Falls back to the heuristic extractor when no model is available.
 * Never confirms, creates, or modifies records.
 */

import {
  KNOWLEDGE_CONFIDENCE,
  KNOWLEDGE_TYPES,
  validateProposals,
  type KnowledgeProposal,
  type KnowledgeSourceRef,
} from "@/lib/ai/knowledge-proposal";
import type { LlmTransport } from "@/lib/ai/llm-client";
import {
  extractMeetingInsights,
  type MeetingInsights,
} from "@/lib/ai/meeting-intelligence";

const MAX_SOURCE_CHARS = 60_000;

const SYSTEM_PROMPT = `You extract business knowledge from a meeting transcript for a business-development team.

Rules (strict):
- Use ONLY what the transcript states. Never invent people, companies, commitments, dates, or facts.
- Every item needs "evidence": a short quote copied EXACTLY from the transcript.
- Every item needs "impact": one sentence on why it matters to the deal or relationship.
- "ownerHint" and "dueHint": only when the transcript names them; otherwise empty string.
- Use type "unknown" for open questions or information the customer has not provided.
- Use type "commitment" only for promises or agreed actions.
- If the transcript has little substance, return few or zero items. An empty list is correct.
- "summary": 1-3 sentences of business prose about what was discussed. No field dumps.
- Write in the language of the transcript.`;

const INPUT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: [...KNOWLEDGE_TYPES] },
          statement: { type: "string" },
          impact: { type: "string" },
          evidence: { type: "string" },
          confidence: { type: "string", enum: [...KNOWLEDGE_CONFIDENCE] },
          ownerHint: { type: "string" },
          dueHint: { type: "string" },
        },
        required: ["type", "statement", "impact", "evidence", "confidence"],
      },
    },
  },
  required: ["summary", "items"],
} as const;

export type MeetingKnowledgeResult = {
  summary: string;
  proposals: KnowledgeProposal[];
  rejectedCount: number;
  origin: "llm" | "heuristic";
};

export type SmartMeetingInsights = MeetingInsights & {
  proposals: KnowledgeProposal[];
  origin: "llm" | "heuristic";
};

async function resolveTransport(
  transport: LlmTransport | null | undefined,
): Promise<LlmTransport | null> {
  if (transport !== undefined) return transport;
  const { getDefaultTransport } = await import("@/lib/ai/llm-client");
  return getDefaultTransport();
}

/** Returns null when the model is unavailable or its output is unusable. */
export async function extractMeetingKnowledge(
  transcript: string,
  source: KnowledgeSourceRef,
  transport?: LlmTransport | null,
): Promise<MeetingKnowledgeResult | null> {
  const text = transcript.trim().slice(0, MAX_SOURCE_CHARS);
  if (!text) return null;

  const run = await resolveTransport(transport);
  if (!run) return null;

  let raw: unknown;
  try {
    raw = await run({
      task: "meeting-knowledge",
      system: SYSTEM_PROMPT,
      user: `Transcript:\n\n${text}`,
      toolName: "record_meeting_knowledge",
      toolDescription: "Record the knowledge found in the transcript.",
      inputSchema: INPUT_SCHEMA as unknown as Record<string, unknown>,
      maxTokens: 3000,
    });
  } catch {
    return null;
  }

  if (!raw || typeof raw !== "object") return null;
  const record = raw as { summary?: unknown; items?: unknown };
  if (!Array.isArray(record.items)) return null;

  const { proposals, rejected } = validateProposals(record.items, text, source);
  const summary = typeof record.summary === "string" ? record.summary.trim() : "";

  return {
    summary,
    proposals,
    rejectedCount: rejected.length,
    origin: "llm",
  };
}

/**
 * Drop-in replacement for extractMeetingInsights():
 * LLM-grounded when available, heuristic otherwise. Same shape + proposals.
 */
export async function extractMeetingInsightsSmart(
  transcript: string,
  source: KnowledgeSourceRef,
  transport?: LlmTransport | null,
): Promise<SmartMeetingInsights> {
  const heuristic = extractMeetingInsights(transcript);
  const knowledge = await extractMeetingKnowledge(transcript, source, transport);

  if (!knowledge) {
    return { ...heuristic, proposals: [], origin: "heuristic" };
  }

  const commitments = knowledge.proposals.filter((p) => p.type === "commitment");

  return {
    ...heuristic,
    summary: knowledge.summary || heuristic.summary,
    keyCommitments: commitments.map((p) => p.statement),
    actionItems: commitments.map((p) => ({
      action: p.statement,
      ownerHint: p.ownerHint,
      dueHint: p.dueHint,
      priority: "Medium" as const,
    })),
    proposals: knowledge.proposals,
    origin: "llm",
  };
}
