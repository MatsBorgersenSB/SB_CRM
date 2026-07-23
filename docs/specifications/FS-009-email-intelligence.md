# FS-009 Email & Interaction Intelligence

## Document Information

| Property | Value |
| :--- | :--- |
| Specification ID | FS-009 |
| Name | Email & Interaction Intelligence |
| Status | Approved |
| Owner | SmartCRM |
| Category | SmartAssist & Integrations |
| Version | 1.0 |
| Related | FS-001 Opportunity Stakeholder Management · FS-002 Contact Registry · FS-003 Company Registry · FS-004 Relationship Intelligence · FS-005 Opportunity Workspace · FS-008 Meeting Intelligence |
| Governing Standards | SmartCRM Constitution v6.0 · SmartAssist Constitution · SmartCRM North Star |

---

## 1. Purpose

Email threads are the continuous signal layer between meetings. Commercial teams lose deal context when inbox activity is disconnected from opportunity workspaces and contact registries.

**Email & Interaction Intelligence** continuously ingests Microsoft 365 mail via Graph API, threads messages into conversations, maps participants to the `ContactRegistry` (`FS-002`), attributes engagement to opportunities (`FS-005`), and surfaces **sentiment-graded** interaction evidence inside the Opportunity Workspace—without storing full message bodies or violating privacy guardrails.

---

## 2. Core Principles & Guardrails

1. **Reality First & Preview-Only Storage:** SmartAssist stores `subject`, `bodyPreview` (truncated Graph preview), headers, and derived metadata. **Full HTML/text body content shall not be persisted** in SmartCRM by default.
2. **Deterministic Contact Resolution:** Senders and recipients are matched against `ContactRegistry` (`FS-002`) by primary or secondary email. Unresolved addresses remain linked by email string until a contact is created or mapped.
3. **Conversation Threading:** Messages are grouped by Microsoft Graph `conversationId`. Threading is deterministic and provider-native—SmartAssist shall not invent alternate thread IDs.
4. **Sentiment as Advisory Signal:** Sentiment grades (`positive` · `neutral` · `cautious` · `negative`) are AI-derived suggestions. They inform Relationship Intelligence (`FS-004`) and workspace cues but **shall not auto-update influence stance or decision-maker verification** without user confirmation.
5. **Privacy & Scope Filtering:** Sync respects OAuth scopes on `ExternalIntegration`. Internal-only mail (all participants share the host tenant domain) is excluded from external deal intelligence by default. Personal / non-commercial folders are out of scope unless explicitly opted in.
6. **Idempotency & Delta Sync:** Ingestion uses Graph message IDs (`externalMessageId`) and delta tokens to prevent duplicates across folder moves, replies, and re-syncs.

---

## 3. Data Model & Architecture

### 3.1 Sentiment Grade

| Grade | Meaning |
| :--- | :--- |
| `positive` | Supportive, progress-oriented, or champion-like tone |
| `neutral` | Informational or transactional with no clear risk/upside signal |
| `cautious` | Hesitation, conditions, delays, or soft pushback |
| `negative` | Explicit objection, conflict, or deal-risk language |

### 3.2 Shared TypeScript Types

```typescript
// Shared Types: src/types/email-intelligence.ts

export type SentimentGrade = "positive" | "neutral" | "cautious" | "negative";

export interface EmailMessageIntelligenceRecord {
  id: string;
  externalMessageId: string; // Microsoft Graph message id
  conversationId: string;    // Graph conversationId (thread key)
  opportunityId?: string;    // Linked Opportunity (FS-005)
  contactId?: string;        // Primary resolved Contact (FS-002)
  subject: string;
  bodyPreview?: string;      // Truncated preview only — never full body
  senderEmail: string;
  recipientEmails: string[];
  sentAt: string;
  sentiment: SentimentGrade;
  isOutbound: boolean;       // true when sent from connected mailbox
  createdAt: string;
}
```

### 3.3 Persistence Model (Prisma)

```prisma
enum SentimentGrade {
  positive
  neutral
  cautious
  negative
}

model EmailMessageRecord {
  id                 String         @id @default(uuid())
  externalMessageId  String         @unique
  conversationId     String
  opportunityId      String?
  contactId          String?
  subject            String
  bodyPreview        String?
  senderEmail        String
  recipientEmails    String[]
  sentAt             DateTime
  sentiment          SentimentGrade @default(neutral)
  isOutbound         Boolean        @default(false)
  createdAt          DateTime       @default(now())

  opportunity Opportunity? @relation(fields: [opportunityId], references: [id], onDelete: SetNull)
  contact     Contact?     @relation(fields: [contactId], references: [id], onDelete: SetNull)
}
```

`Opportunity.emailMessages` and `Contact.emailMessages` provide back-relations for workspace and contact timelines.

---

## 4. M365 Email Parsing

### 4.1 Ingestion Source

- Provider: **Microsoft Graph** (`Mail.Read` / delegated scopes via `ExternalIntegration`)
- Primary entities: `message`, `conversationId`, `from`, `toRecipients`, `ccRecipients`, `sentDateTime`, `subject`, `bodyPreview`
- Sync mode: delta query per mailbox; upsert on `externalMessageId`

### 4.2 Mapping Rules

| Graph Field | SmartCRM Field | Notes |
| :--- | :--- | :--- |
| `id` | `externalMessageId` | Unique idempotency key |
| `conversationId` | `conversationId` | Thread grouping |
| `subject` | `subject` | As received |
| `bodyPreview` | `bodyPreview` | Truncated; no full body persist |
| `from.emailAddress.address` | `senderEmail` | Normalized lowercase |
| `toRecipients` + `ccRecipients` | `recipientEmails` | Deduplicated address list |
| `sentDateTime` / `receivedDateTime` | `sentAt` | Prefer sent for outbound |
| Mailbox ownership | `isOutbound` | True when sender matches connected user |

### 4.3 Opportunity Attribution

Messages are linked to an `opportunityId` when:

1. Participants match the opportunity stakeholder roster (`FS-001`), or
2. The conversation was previously attributed to that opportunity, or
3. A user explicitly links the thread in the Opportunity Workspace

Ambiguous attribution remains `opportunityId = null` until resolved—no silent guesswork.

---

## 5. Conversation Threading

1. All messages sharing a Graph `conversationId` form one **interaction thread**.
2. Workspace UI presents threads chronologically by latest `sentAt`, with expandable message lists.
3. Sentiment may be shown per message and as a **thread roll-up** (latest non-neutral signal preferred; otherwise majority / most recent).
4. Threading shall remain stable across folder moves; folder path is not a thread key.

---

## 6. Sentiment Analysis

1. SmartAssist evaluates `subject` + `bodyPreview` (and optional in-memory full body during sync only) to assign `SentimentGrade`.
2. Sentiment is stored on `EmailMessageRecord.sentiment` with default `neutral`.
3. Downstream consumers (`FS-004`, `FS-006`, `FS-007`) treat sentiment as **evidence**, not authoritative stance.
4. Users may dismiss or override displayed sentiment cues in the workspace; overrides do not rewrite historical message grades unless an explicit correction action is defined in a later revision.

---

## 7. Privacy Guardrails

| Guardrail | Requirement |
| :--- | :--- |
| Minimal retention | Persist preview + metadata only; no full body store by default |
| Scope respect | Honor Graph OAuth scopes and tenant admin policies |
| Internal filter | Exclude all-internal tenant mail from external deal intelligence by default |
| Access control | Email records inherit Opportunity / Contact visibility rules |
| Auditability | Ingestion timestamps (`createdAt`) and provider IDs retained for sync audit |
| User control | Connected mailboxes may be disconnected via `ExternalIntegration` revocation |

---

## 8. Functional Requirements

| ID | Requirement |
| :--- | :--- |
| FR-009-01 | System shall ingest M365 messages via Graph delta sync without duplicating `externalMessageId`. |
| FR-009-02 | System shall group messages by `conversationId` for thread views. |
| FR-009-03 | System shall resolve `contactId` when sender/recipient matches `ContactRegistry` emails. |
| FR-009-04 | System shall attribute messages to opportunities when roster or explicit link rules match. |
| FR-009-05 | System shall assign and store a `SentimentGrade` per message. |
| FR-009-06 | System shall expose email threads in Opportunity Workspace (`FS-005`) as interaction evidence. |
| FR-009-07 | System shall not persist full message bodies by default. |
| FR-009-08 | System shall exclude internal-only mail from external deal intelligence by default. |

---

## 9. Acceptance Criteria

- [ ] `EmailMessageRecord` persists with unique `externalMessageId` and non-null `conversationId`
- [ ] Seed or sync samples show threaded messages under Circular Fiber / Thermal Recovery opportunities
- [ ] Resolved contacts (e.g. Anna Berg, Bjorn Haugen) link via `contactId` when emails match
- [ ] Sentiment grades appear in workspace without mutating influence stance automatically
- [ ] Full body content is absent from the database; only `bodyPreview` is stored
- [ ] Prisma Client regenerates with `emailMessageRecord` delegate after migration

---

## 10. Approval

| Role | Status |
| :--- | :--- |
| Product Owner | Approved |
| Solution Architect | Approved |
| Platform Governance | Approved |

Current Status: **Approved**
