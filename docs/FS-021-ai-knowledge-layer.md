# FS-021 AI Knowledge Layer

## Document Information

| Property | Value |
|----------|-------|
| Specification ID | FS-021 |
| Name | AI Knowledge Layer |
| Status | Draft |
| Owner | SmartCRM |
| Category | SmartAssist & Integrations |
| Related | FS-012 Relationship Intake · FS-013 Active Operating Loop · FS-014 Post-Meeting Notes · FS-018 Teams Integration · FS-020 Duplicate Management · FS-004 Relationship Intelligence · FS-005 Opportunity Workspace |
| Governing Standards | SmartCRM Constitution · SmartAssist Constitution · SmartCRM North Star · AD-001 Filter Transparency |

---

## Problem Statement

SmartCRM's engines (health, next best action, attention, opportunity, document, briefing, search/ask) are deterministic. They are reliable but cannot read unstructured sources (emails, meeting notes, documents) and cannot write human prose or drafts. Users still re-type what their sources already say, and insight is expressed as field values rather than business understanding.

The only LLM use today is business-card scanning (`/api/crm/intake/card/scan`). There is no shared AI layer, no provenance model, and no common way to propose knowledge for approval.

## Business Goals

1. Users never re-type what a source already says.
2. Every insight is written as business prose with impact, not field dumps.
3. Every AI output is traceable to a source and approvable by the user.
4. AI never replaces the engines; it feeds and explains them.
5. Time to value: insight ≤ 3s, action ≤ 5s.

## User Stories

1. After a meeting, I see proposed commitments, risks, and unknowns and accept or edit them in one pass.
2. I open a company or deal and see **what changed** since my last visit, with why it matters.
3. Before a meeting, I get a briefing written in prose, with one objective.
4. I tap **Prepare Email** and get a draft grounded in prior threads and open commitments.
5. I ask a question about an opportunity and get a cited answer, or an explicit "unknown" with the gap named.
6. My Daily Focus shows at most four items, each with why and what next.

## Architecture Decision

**The engines decide. The LLM reads and writes.**

```
Sources → LLM Extraction → Proposals → (user approves) → Knowledge
Knowledge → Engines (health, NBA, attention) → LLM Narration → User
```

The LLM has exactly two jobs:

| Job | Input | Output | Writes records? |
|-----|-------|--------|-----------------|
| **Extraction** | Unstructured source text | Typed `KnowledgeProposal` items | No — proposals only |
| **Narration / Drafting** | Engine output + retrieved evidence | Prose, briefings, drafts | No — drafts only |

The LLM never scores, ranks, classifies relationship posture as final, or decides what deserves attention.

## Functional Requirements

### FR-001 Shared AI service layer

One module (`src/lib/ai/`) owns: the Anthropic client, model selection per task, schema validation, prompt caching, retries, and cost/latency logging. No route calls the SDK directly (the card scan route migrates onto it).

### FR-002 Knowledge Proposal object

Every extraction yields `KnowledgeProposal`:

| Field | Rule |
|-------|------|
| `type` | `fact` · `decision` · `risk` · `commitment` · `relationship` · `unknown` |
| `statement` | Business prose, one sentence |
| `impact` | Why it matters (mandatory; no impact → not rendered) |
| `source` | Reference to the originating email, meeting, document, or note (mandatory) |
| `evidence` | Short quote supporting the statement |
| `confidence` | `high` · `moderate` · `low` |
| `target` | Existing record it attaches to (Company / Contact / Opportunity / Meeting) by ID, or none |
| `status` | `proposed` · `accepted` · `edited` · `dismissed` |

Proposals without `source` or `evidence` are rejected at validation. Empty output is valid.

### FR-003 Confidence and approval policy

| Confidence | Action type | Behaviour |
|-----------|-------------|-----------|
| High | Low-risk (e.g. log activity, attach note) | May apply automatically; shown in "applied" list with undo |
| Moderate | Any | Suggest; user accepts |
| Any | Create or modify Contact, Company, Relationship, Stakeholder | **Always requires approval** |

Never auto-create entities from speaker labels, signatures, or mentions. Route through Relationship Intake (FS-012) and Duplicate checks (FS-020).

### FR-004 Extraction sources (phased)

1. Meeting transcripts / notes (extends FS-014)
2. Emails (Outlook)
3. Documents / SmartDocs
4. Teams messages (FS-018)

### FR-005 Proposal inbox

One review list per scope (company, opportunity, meeting) showing pending proposals. Accept, Edit, Dismiss. No new dashboard (Michelin). Existing Active Assist may surface "Review proposed knowledge".

### FR-006 What Changed

Per company/deal, a short prose summary of changes since last view, built from diffs in activities, proposals accepted, documents, and engine state changes. Each item includes impact.

### FR-007 Briefing and drafting

- Meeting Briefing: the seven required sections, written in prose, one **Meeting Objective**.
- Prepare Email: draft grounded in prior threads, open commitments, and the NBA. Opens in Outlook; never sends.

### FR-008 Opportunity-scoped Ask

Retrieval-first Q&A restricted to the opportunity's knowledge (and linked company/contacts). Answers cite sources. If evidence is absent, answer "unknown" and name the gap. Search existing knowledge before asking the user anything.

### FR-009 Daily Focus narration

The attention engine selects and ranks (max 4). The LLM only writes the why and the next step for each.

### FR-010 Learning loop (no training)

Record accept / edit / dismiss per proposal type. Use rates to tune prompts and thresholds. Never fine-tune on customer data.

## SmartAssist Behaviour

- Observe sources before asking.
- Search existing knowledge before requesting anything.
- Propose before reporting; recommend before analysing.
- Every output states what is happening, why it matters, and what next.
- The system does the thinking; the user makes the decision.

## UX Design

| Surface | Behaviour |
|---------|-----------|
| Meeting / Opportunity | Import → proposals appear in one review list |
| Company 360 / Deal 360 | "What changed" line + proposal count; no new cards |
| Outlook | Prepare Email, briefing; within existing information budgets |
| Ask tab | Opportunity-scoped; answers and citations only, no thinking prompts |

Never expose model names, confidence percentages, or prompts in primary UI. Source citation is shown as plain language ("from the email on 12 Oct").

## Reality First Principle

- Never invent people, companies, relationships, commitments, or facts.
- Unknown stays unknown; weak sources yield fewer proposals.
- Unclassified companies stay unclassified; AI may suggest posture with evidence but never default to Customer, and never suggests Create Opportunity outside `isOpportunityEligibleCompany`.

## Persistence / Ownership Rules

| Knowledge | Owner |
|-----------|-------|
| Contacts, Companies, Relationships, Stakeholders | Existing registries — single source of truth |
| Meeting commitments | `MeetingCommitmentRecord` (FS-014) |
| Proposals (pending/decided) | New `KnowledgeProposal` store; accepted items materialise into the owning record, not duplicated |
| Raw source text | Not retained long-term; transient processing, store only evidence quotes and source references |
| AI usage logs | Metadata only (task, model, tokens, latency); no content |

## Safety and Privacy

- Minimal context per call; scoped to the user's M365 permissions.
- Internal-only meetings are not synced into external deal intelligence by default (FS-008 / FS-014).
- Structured output via schema-validated tool calls; invalid output is discarded.
- Stable context uses prompt caching; cheap model for extraction, stronger model for drafting; results cached per source version.

## Evaluation

A no-invention test suite runs on every prompt change:

1. Absent evidence returns `unknown`, not a guess.
2. Every proposal has a source and evidence quote that exists in the input.
3. No entity creation without approval.
4. Posture suggestions respect classification rules.

## Phasing

| Phase | Deliverable |
|-------|-------------|
| 1 | AI service layer, `KnowledgeProposal`, proposal inbox, eval harness; meeting extraction (FS-014) on top |
| 2 | Email extraction; briefing and Prepare Email drafting |
| 3 | What Changed; Daily Focus narration |
| 4 | Opportunity-scoped Ask with citations |
| 5 | Document and Teams extraction; learning loop |

## Acceptance Criteria

1. Extraction creates only proposals; no record is created or modified without approval, except FR-003 high-confidence low-risk actions, which are undoable.
2. Every rendered AI statement has an impact and a source.
3. Empty or weak input produces empty or low-confidence output, never filler.
4. Ask answers "unknown" with the gap named when evidence is absent.
5. No UI exposes scores from the LLM; all ranking comes from existing engines.
6. The no-invention eval suite passes before any prompt change ships.
7. The card scan route uses the shared AI layer.

## Out of scope

- Free-form chatbot as a primary interface
- AI-generated health scores or rankings
- Auto-creating Contacts, Companies, Relationships, or Stakeholders
- Live meeting bots
- Model fine-tuning on customer data
