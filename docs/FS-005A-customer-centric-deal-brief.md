# FS-005A Customer-Centric Deal Brief

## Document Information

| Property | Value |
|-----------|-----------|
| Specification ID | FS-005A |
| Name | Customer-Centric Deal Brief (addendum to FS-005) |
| Parent | FS-005 Opportunity Workspace |
| Status | Draft for review |
| Owner | SmartCRM |
| Category | Core Capability |

---

## 1. Problem Statement

The Opportunity Overview does not pass the 10-second test. Findings from the review of the Antec Hornindal workspace:

1. The three answers (what the customer wants, what blocks progress, what happens next) sit below about six other blocks. "Next" is at the bottom.
2. No verdict. Nothing says whether the deal is healthy, and nothing says what changed.
3. Two independent "next best action" sources (`DealVelocityCard` and `understanding.nextBestAction`) can disagree.
4. Header duplication (Stage and Offerings shown twice).
5. Each answer is a four-part essay (observation, reasoning, action, outcome).
6. The understanding model has 16 fields, all about the **project** (technical, feedstock, infrastructure, permitting). It holds nothing about the **customer's problem**, so "What the customer wants" is inferred from keywords. That conflicts with Reality First.
7. Drift from the mission-control spec: 8 tabs instead of 5, 7 Action sub-tabs, stakeholders in two places.

## 2. Business Goals

- A seller understands any investigation-type opportunity in 10 seconds.
- The Overview is built on what the **customer** needs and will do, not on what our model is missing.
- SmartCRM never fabricates a customer problem.

## 3. Guiding Principle

> Customer-centric questions are the lens. SmartCRM's knowledge model is the source of truth. If a sales-method element conflicts with the SmartCRM Constitution, the Constitution wins.

The method used as the lens is Solution Selling (Michael Bosworth): confirmed customer pain, a power sponsor, the customer's vision, quantified value, a compelling event, and an agreed next step. It is an internal reference only. **Its terms never appear in the UI.**

| Reference term | UI wording | Source of truth |
|---|---|---|
| Pain | Customer problem | New field `customer_problem` |
| Compelling event | Why now | New field `why_now` |
| Vision | What they picture | New field `customer_vision` |
| Value | What it is worth to them | New field `customer_value` |
| Power | Who decides | Existing `decision_maker`, `economic_buyer` |
| Control | Agreed next step | Derived from Activities and commitments (no new storage) |

## 4. User Stories

- **US-A1** As a seller, I open an opportunity and know within 10 seconds whether it is healthy and what to do next.
- **US-A2** As a seller, I see what the customer actually told us (and who said it), never a guess presented as fact.
- **US-A3** As a seller, I see the single weakest link on the deal, not a list of missing fields.
- **US-A4** As a seller, I approve or reject any problem statement SmartAssist finds in mail, meetings or documents.
- **US-A5** As a manager, I scan a deal and see what changed since I last looked.

## 5. Functional Requirements

### 5.1 Customer layer (new understanding fields)

Add a category **Customer** to the understanding model with four optional fields:

| Field id | Label | Meaning |
|---|---|---|
| `customer_problem` | Customer problem | The business problem in the customer's words, and who feels it |
| `why_now` | Why now | The event, deadline, regulation or funding window that forces a decision |
| `customer_vision` | What they picture | What a good outcome looks like to the customer |
| `customer_value` | What it is worth to them | The customer's own stated value or cost of the problem |

Rules:
- All four are optional. Existing opportunities start as Unknown. **No data migration and no backfill by guessing.**
- Stored with the existing captured understanding (`pipeline.understanding`). No new store. Single source of truth.
- Each captured value keeps its source (user, mail, meeting, document) and the person quoted where known.
- The 16 existing fields remain and are grouped as **Project viability** ("can this be built?"). They are not removed.

### 5.2 Knowledge state

Every customer-layer element shows exactly one state:

| State | Meaning |
|---|---|
| **Confirmed** | Captured by a user, or a SmartAssist proposal the user approved, with a named source |
| **Assumed** | SmartAssist proposed or inferred, not yet approved |
| **Unknown** | Nothing captured |

The keyword inference in `inferClientObjective` may only ever produce **Assumed**, labelled as such, and only as a prompt to confirm. It never counts toward Confirmed and never drives the verdict.

### 5.3 Agreed next step (derived)

"Agreed next step" is **derived** from existing Activities and commitments: an open follow-up or planned meeting linked to this opportunity that involves a customer contact and has a date. If none exists, the state is Unknown. No separate field is created.

### 5.4 Verdict

One word plus one sentence of impact, computed deterministically from the knowledge states and existing engines. No scores or confidence percentages in primary UI.

| Verdict | Rule (first match wins) | Example impact line |
|---|---|---|
| **At risk** | A critical or high fatal-flaw alert from commercial viability, or an urgent open attention item for this deal, or customer silence beyond the configured threshold (only when at least one customer contact exists) | "No customer contact for N days; the deal may be going cold." |
| **Not yet understood** | Customer problem is Unknown or Assumed | "We do not know what the customer is trying to fix, so every next step is a guess." |
| **Needs attention** | Problem Confirmed, but Who decides, Why now, or Agreed next step is Unknown | "We know the problem but not who can approve it." |
| **Clear path** | Problem, Who decides, Why now Confirmed and an Agreed next step exists | "The customer has a reason, a decider and a date." |

Impact is mandatory. If an impact line cannot be written, the verdict is not rendered.

### 5.5 Weakest link and the three rows

The Brief shows three single-line rows. Each has one headline and one impact clause. Reasoning sits behind a "Why" toggle.

1. **What the customer wants.** From Customer problem plus What they picture. Shows state, source and quoted person. Unknown shows "Not confirmed yet" and the question that would settle it.
2. **What is blocking progress.** If the verdict is At risk, the cause of the risk. Otherwise the weakest link, chosen in this order: Customer problem → Who decides → Why now → Agreed next step → What it is worth → What they picture. On a Clear path, What it is worth and What they picture never count as blockers. If nothing blocks, show a real signal first (overdue commitment; unanswered customer mail once mail signals are wired in), otherwise "Nothing is blocking progress".
3. **What should happen next.** One action tied to the weakest link or the agreed process. It is the single next-action source for the page.

Project viability is surfaced in the Brief **only** when it raises a fatal-flaw alert (funding, permitting, buildability). Otherwise it lives under its own tab.

### 5.6 What changed

One line: last customer touch (who, when, channel) and anything new since the user's last visit (new mail, new document, new finding, status change). If nothing changed, say so.

### 5.7 Deal Brief layout (information budget)

Above the fold, in this order, and nothing else:

1. Title line: opportunity, account, stage, value, close date, owner (one metadata line).
2. Verdict plus impact.
3. The three rows.
4. What changed.

Below the fold:
- Stakeholders (one place only: the Overview; removed from Actions).
- "Evidence and inbox", collapsed by default: Add finding, market facts, mail signals, knowledge proposals.

Removed or merged:
- `DealVelocityCard` as a separate card. Its output feeds row 3 (single next-action source).
- Duplicate Stage pill and Offerings pill. The offerings picker moves behind an Edit action.

### 5.8 Tabs

Return to the five specified tabs: **Overview, Gaps, Understanding, Actions, Ask.**

- Influence Map moves under Understanding.
- Meetings and Emails move under Actions.
- Gaps lists customer-layer gaps first, then project viability gaps.
- Actions sub-tabs are reduced; Stakeholders is removed from Actions.

### 5.9 Scope gates

- **Sales motion:** applies to investigation-type deals only. Product sales and consulting keep the lean path (buyer, quantity, date, quote) and are untouched.
- **Relationship posture:** applies only where `isOpportunityEligibleCompany` is true. Buy-from, collaborate, watch/fund and unclassified companies never get customer-problem or sponsor prompts.

## 6. SmartAssist Behaviour

- **Knowledge before questions.** Before asking for a customer problem, search mail, meetings, activities, documents, SmartDocs and findings. Show what was found with its source and ask only for the gap.
- **Proposals, not writes.** Anything found is stored as a proposal (Assumed). It becomes Confirmed only when the user approves it.
- **Explain on demand.** Each row has a "Why" toggle with observation, reasoning and expected outcome. Not shown by default.
- **Recommend, never decide.** The verdict and next action are recommendations. The user can override or dismiss.
- No rule IDs, confidence percentages or engine internals in primary UI.

## 7. UX Design

- 3-second test: *What am I looking at?* (title line) *What matters?* (verdict) *What next?* (row 3).
- 10-second test: a first-time reader can state the customer problem, the main blocker and the next action without scrolling.
- Plain language only. No "pain", "power", "vision" or "control" labels.
- Wide layouts: on large displays the three rows sit beside What changed and Stakeholders, not in a narrow column.

## 8. Reality First Principle

- Unknown stays Unknown. No fabricated customer problems, sponsors, dates or values.
- Inferred text is always labelled Assumed and never drives the verdict.
- Every Confirmed statement carries a source. A statement with no source cannot be Confirmed.

## 9. Persistence / Ownership Rules

- Customer-layer fields live in `pipeline.understanding` alongside existing captured fields, using the existing patch path. No parallel store.
- Who decides continues to reference the Contact Registry and opportunity roster. No contacts are created or duplicated.
- Agreed next step is derived from Activities. Nothing is written for it.
- Approval of SmartAssist proposals follows FS-021 (AI knowledge layer). No auto-modification of Contacts, Companies, Relationships or Stakeholders.

## 10. Constitution Compliance

| Principle | How this spec complies |
|---|---|
| System thinks, user decides | Verdict and next action are recommendations; proposals need approval |
| Knowledge before questions | Search all sources first; ask only for the gap |
| Reality First | Unknown / Assumed / Confirmed; no invention |
| Relationship posture | Gated to sell-to companies only |
| Michelin | One hero, three rows, one line of change; clutter collapsed or removed |
| 12-Year-Old Rule | Plain wording, no sales jargon |
| Impact mandatory | Verdict and every row carry an impact clause |
| Single source of truth | No new stores; derived values are computed |
| Project qualification | Funding, permitting and buildability kept as a separate viability assessment |

## 11. Acceptance Criteria

- **AC-A1** The Overview above the fold contains only the title line, verdict, three rows and What changed.
- **AC-A2** A seller can state the customer problem, main blocker and next action within 10 seconds on Antec Hornindal.
- **AC-A3** There is exactly one source of "next action" on the page.
- **AC-A4** With no captured customer problem the page shows "Not confirmed yet", never an inferred sentence as fact.
- **AC-A5** Inferred or proposed values display as Assumed and do not change the verdict until approved.
- **AC-A6** Every Confirmed value shows its source.
- **AC-A7** The verdict follows the rule table in 5.4 and is not rendered without an impact line.
- **AC-A8** Stage and Offerings each appear once in the header area.
- **AC-A9** Mission control has five tabs; stakeholders appear in one place.
- **AC-A10** Product-sale and non-sell-to opportunities are unchanged and show no customer-layer prompts.
- **AC-A11** No sales-method terminology appears in the UI.
- **AC-A12** Existing opportunities load without migration, with customer fields Unknown.

## 12. Out of Scope

- Autonomous capture of customer statements without approval.
- Forecasting, scoring or percentage-based probability changes.
- Changes to company, contact or stakeholder management (FS-002, FS-003, FS-001).
- Redesign of the opportunity list or kanban.

## 13. Open Questions (decisions needed before build)

1. **Silence threshold.** After how many days without customer contact does the verdict become At risk? Proposal: 21 days for investigation deals.
2. **Source requirement.** Is a user-typed answer with no document or conversation reference acceptable as Confirmed? Proposal: yes, with source "Stated by {user}".
3. **Why now vs Timeline.** Keep the existing `timeline` field as a date and treat `why_now` as the reason, or merge them? Proposal: keep both.
4. **Tab relocation.** Confirm Influence Map under Understanding and Meetings/Emails under Actions.
5. **Value field.** Should `customer_value` accept a currency amount, free text, or both? Proposal: free text, with an optional amount.

## 14. Suggested Delivery Phases

1. **Model.** Add the Customer category and four fields, knowledge states and source tracking. No UI change.
2. **Engine.** Verdict, weakest link, derived agreed next step, What changed. Unit tests for the rule table.
3. **Deal Brief UI.** New hero, collapse evidence and inbox, remove duplicates, merge `DealVelocityCard` into row 3.
4. **Tab consolidation.** Five tabs, relocate Influence, Meetings, Emails, stakeholders.
5. **SmartAssist proposals.** Extract problem, why now, vision and value statements from mail, meetings and documents as Assumed proposals.
