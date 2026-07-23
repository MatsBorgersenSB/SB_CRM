# FS-011 Autonomous Workflow Engine

## Document Information

| Property | Value |
| :--- | :--- |
| Specification ID | FS-011 |
| Name | Autonomous Workflow Engine |
| Status | Approved |
| Owner | SmartCRM |
| Category | SmartAssist & Workflow Automation |
| Version | 1.0 |
| Related | FS-005 Opportunity Workspace · FS-008 Meeting Intelligence · FS-009 Email & Interaction Intelligence · FS-010 Growth & Expansion Intelligence |
| Governing Standards | SmartCRM Constitution v6.0 · SmartAssist Constitution · SmartCRM North Star · AD-001 Filter Transparency |

---

## 1. Purpose

Commercial teams lose momentum when signals fire and no one turns them into concrete next steps. Manual triage does not scale across expansion signals, sentiment drops, and meeting commitments.

**Autonomous Workflow Engine** evaluates **event-driven triggers**, matches them against **WorkflowRule** definitions, and creates **proposed actions** as `WorkflowExecution` rows. Automation never silently mutates CRM state — every auto-action enters a **`pending_approval`** queue until a user approves, dismisses, or the run fails after approval.

---

## 2. Core Principles & Guardrails

1. **User Sovereignty (FR-016) — non-negotiable:** All autonomous action proposals are created with `ExecutionStatus = pending_approval`. SmartAssist shall **not** execute CRM writes, Outlook drafts, stage changes, or task creation until the user explicitly **approves**.
2. **Propose, never decide:** Rule evaluation creates executions; users approve. Dismissed executions are retained for auditability and must not be re-executed automatically.
3. **Reality First:** Triggers are grounded in persisted CRM events (expansion signals, email sentiment, meeting commitments). Rules shall not invent entities.
4. **AD-001 Filter Transparency — mandatory:** Pending-approval queues, rule lists, and execution history shall show `Showing {filtered} of {total} {Label}`, active filter chips, per-chip remove, and Clear All when ≥2 filters are active.
5. **Explainability on proposals:** Each execution payload should carry enough context for UI to render Observation / Reasoning / Recommended Action / Expected Outcome (via `ExplainabilityBlock` or equivalent), even when stored inside `payload` JSON.
6. **Fail closed:** If rule conditions are ambiguous or required entity links are missing, do not create an execution — or create one with `failed` only after an approved run errors (never auto-fail into a side effect).

---

## 3. Event-Driven Triggers

Canonical `triggerType` string values (extensible):

| Trigger | `triggerType` | Source event |
| :--- | :--- | :--- |
| **Signal Detected** | `expansion_signal_detected` | FS-010 `ExpansionSignal` created or status → `detected` |
| **Sentiment Drop** | `email_sentiment_drop` | FS-009 sentiment grade moves to `cautious` / `negative` (or aggregate score drop) |
| **Commitment Confirmed** | `meeting_commitment_confirmed` | FS-008 commitment status → `confirmed` |

Additional triggers may be added later (e.g. `account_health_band_drop`) without schema changes — `triggerType` remains a string.

### 3.1 Rule evaluation

When a trigger event occurs:

1. Load `WorkflowRule` rows where `status = active` and `triggerType` matches.
2. Evaluate optional `conditions` JSON against the event context (company, opportunity, signal type, sentiment threshold, etc.).
3. For each matching rule, create a `WorkflowExecution` with:
   - `status = pending_approval`
   - `actionType` from the rule definition (or conditions)
   - `payload` describing the proposed action + explainability fields
   - optional `companyId` / `opportunityId` links

Rules with `status = paused` or `archived` are ignored.

---

## 4. Proposed Actions

Canonical `actionType` examples:

| `actionType` | Meaning | Side effect after approval |
| :--- | :--- | :--- |
| `create_task` | Create follow-up activity / task | Persist activity (user-approved) |
| `generate_outlook_draft` | Draft email in Outlook | Call M365 draft API (user-initiated path) |
| `update_stage` | Propose opportunity stage change | Patch opportunity stage only after approve |

**Before approval:** no side effects.  
**After approval:** executor runs once; on success → `executed` + `executedAt`; on error → `failed` (no silent retry loops without user visibility).

| `ExecutionStatus` | Meaning |
| :--- | :--- |
| `pending_approval` | In approval queue (**default** for all auto-created executions) |
| `approved` | User approved; awaiting or in execution |
| `executed` | Side effect completed successfully |
| `dismissed` | User rejected; no side effect |
| `failed` | Approved run failed; payload may include error detail |

---

## 5. Data Model

### 5.1 Prisma (authoritative)

```prisma
enum WorkflowStatus {
  active
  paused
  archived
}

enum ExecutionStatus {
  pending_approval
  approved
  executed
  dismissed
  failed
}

model WorkflowRule {
  id          String         @id @default(uuid())
  name        String
  triggerType String
  conditions  Json?
  status      WorkflowStatus @default(active)
  createdAt   DateTime       @default(now())
  executions  WorkflowExecution[]
}

model WorkflowExecution {
  id            String          @id @default(uuid())
  ruleId        String
  rule          WorkflowRule    @relation(...)
  opportunityId String?
  opportunity   Opportunity?    @relation(...)
  companyId     String?
  company       Company?        @relation(...)
  actionType    String
  payload       Json
  status        ExecutionStatus @default(pending_approval)
  executedAt    DateTime?
  createdAt     DateTime        @default(now())
}
```

**Back-relations**

- `Company.workflowExecutions` → `WorkflowExecution[]`
- `Opportunity.workflowExecutions` → `WorkflowExecution[]`
- `WorkflowRule.executions` → `WorkflowExecution[]`

### 5.2 Conditions & payload (JSON guidance)

```typescript
// Example conditions on WorkflowRule
{
  "signalTypes": ["upsell", "cross_sell"],
  "minHealthScore": 75,
  "sentimentGrades": ["cautious", "negative"]
}

// Example payload on WorkflowExecution (pending_approval)
{
  "observation": "Expansion signal detected for CAPEX secondary line.",
  "reasoning": "High account health and confirmed CAPEX appetite.",
  "recommendation": "Create a follow-up task for Bjorn Haugen.",
  "expectedOutcome": "Secondary-line discovery is scheduled within 5 days.",
  "action": { "assigneeRole": "owner", "dueInDays": 5 }
}
```

---

## 6. Functional Requirements

### FR-011-01 Trigger Ingress

The platform shall accept trigger events from FS-008 / FS-009 / FS-010 (and future sources) and evaluate matching active rules.

### FR-011-02 Pending Approval Default

Every newly created `WorkflowExecution` from autonomous evaluation **shall** use `status = pending_approval`.

### FR-011-03 User Approval Queue

Users shall approve or dismiss pending executions. Approve transitions to `approved` then executor sets `executed` or `failed`. Dismiss sets `dismissed` with no side effects.

### FR-011-04 AD-001 on Queues

Approval queue and execution history UIs shall use `FilterTransparencyBar` / `FilterToolbar` (e.g. entity label `Executions`, filters for status / trigger / action type).

### FR-011-05 Rule Lifecycle

Users (authorized roles) may set rules to `active`, `paused`, or `archived`. Paused/archived rules produce no new executions.

### FR-011-06 No Silent Stage or Mail Writes

`update_stage` and `generate_outlook_draft` execute only after explicit approval. Draft generation remains user-visible (existing M365 draft patterns).

---

## 7. API Surface (initial)

| Method | Path | Behavior |
| :--- | :--- | :--- |
| `GET` | `/api/workflows/rules` | List rules (AD-001 filters) |
| `POST` | `/api/workflows/rules` | Create / update rule (authorized) |
| `PATCH` | `/api/workflows/rules/[id]` | Pause / activate / archive |
| `GET` | `/api/workflows/executions` | Approval queue + history |
| `PATCH` | `/api/workflows/executions/[id]` | Approve / dismiss |
| `POST` | `/api/workflows/triggers` | Internal/event ingress (service-auth) |

Route wiring lands in a subsequent implementation sprint; this document defines the contract.

---

## 8. UX Placement

| Surface | Content |
| :--- | :--- |
| Intelligence Center / Admin | Pending approval queue (default filter: `Status: Pending approval`) |
| Opportunity Mission Control | Executions linked to current `opportunityId` |
| Company workspace | Executions linked to `companyId` |

Default AD-001 chip on the queue: **`Status: Pending approval`** so users always see why the list is constrained.

---

## 9. Acceptance Criteria

| ID | Criterion |
| :--- | :--- |
| AC-01 | `WorkflowRule` and `WorkflowExecution` exist in Prisma with Company / Opportunity / Rule relations. |
| AC-02 | New autonomous executions default to `pending_approval`. |
| AC-03 | No CRM side effect occurs while status is `pending_approval` or `dismissed`. |
| AC-04 | Approval queue UI satisfies AD-001 Showing X of Y + active filter chips. |
| AC-05 | Triggers cover at least Signal Detected, Sentiment Drop, and Commitment Confirmed (by `triggerType` contract). |
| AC-06 | Failed approved runs set `failed` without retrying invisibly. |

---

## 10. Out of Scope (this version)

- Fully autonomous execution without approval
- Visual no-code rule builder (rules may be seeded / API-managed first)
- Cross-tenant workflow sharing

---

## 11. Related Implementation Notes

- Prisma models: `WorkflowRule`, `WorkflowExecution` in `prisma/schema.prisma`
- Migration name: `add_fs011_autonomous_workflows`
- Filter transparency: `docs/architecture/AD-001-filter-transparency.md`
- Sovereignty: `docs/governance/SMARTCRM_PRINCIPLES.md` — SmartAssist suggests; users approve

---

*End of FS-011.*
