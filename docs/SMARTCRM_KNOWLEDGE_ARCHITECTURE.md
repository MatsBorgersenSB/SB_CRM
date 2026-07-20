# SmartCRM Knowledge & Decision Architecture

**Version:** 1.0  
**Status:** Long-term architectural direction  
**Audience:** Product, engineering, design

---

## Mission Statement

**SmartCRM transforms organizational information into understanding, understanding into priorities, and priorities into action.**

SmartCRM is not a traditional CRM. It is an organizational knowledge and decision system that sits above Microsoft 365 — helping people know what matters, what is at risk, and what to do next, while safely ignoring everything else.

---

## 1. Vision

### Traditional CRM

Traditional CRM systems are built around **records**:

- **Stores records** — companies, contacts, deals, activities, tasks
- **Displays records** — lists, grids, dashboards, reports
- **Users navigate records** — filter, sort, search, paginate

The user is the prioritization engine. The system answers: *"Here is everything. You figure out what matters."*

As data grows, this model breaks. More records mean more screens, more filters, more cognitive load, and more time spent managing the system instead of advancing the business.

### SmartCRM

SmartCRM is built around **knowledge and decisions**:

- **Builds knowledge** — every interaction extracts facts, decisions, risks, commitments, relationships, and unknowns
- **Creates understanding** — synthesizes knowledge into business insights written for humans, not databases
- **Prioritizes attention** — identifies what deserves focus so users can ignore 99% of information safely
- **Recommends actions** — turns insights into executable artifacts (emails, meetings, plans, tasks)

The system is the prioritization engine. SmartCRM answers: *"Here is what we know, what we don't, what changed, what deserves attention, and what you should do next."*

### Role in the Microsoft 365 stack

| System | Role |
|--------|------|
| Outlook | Communication |
| Teams | Collaboration |
| Planner | Execution |
| SharePoint | Document storage |
| Copilot | Conversation (enhances, never replaces SmartCRM engines) |
| **SmartCRM** | **Intelligence** — knowledge, understanding, prioritization, action |

SmartCRM does not compete with M365. It makes M365 work smarter by connecting communication, collaboration, and execution to organizational understanding.

---

## 2. Core Knowledge Flow

All SmartCRM functionality must support a single pipeline:

```
Sources
   ↓
Knowledge
   ↓
Understanding
   ↓
Prioritization
   ↓
Action
```

| Stage | Question answered | Output |
|-------|-------------------|--------|
| **Sources** | What happened? | Raw inputs from the business |
| **Knowledge** | What did we learn? | Structured knowledge objects |
| **Understanding** | What does it mean? | Business insights in prose |
| **Prioritization** | What matters now? | Ranked attention set |
| **Action** | What should we do? | Execution artifacts |

Nothing in SmartCRM should exist outside this flow. If a feature does not advance knowledge, understanding, prioritization, or action — challenge its purpose.

**Fundamental principle:** Every activity, meeting, email, contact, company, opportunity, document, Teams conversation, and Planner task must increase organizational understanding. Records are inputs. Understanding is the product.

---

## 3. Sources

Sources are **inputs**. They are not the product.

Sources feed the knowledge pipeline. Users should rarely need to "manage sources" — they should consume understanding and act on priorities derived from them.

### Knowledge sources

| Source | What it contributes |
|--------|---------------------|
| **Companies** | Account context, industry, relationship history, stakeholder map |
| **Contacts** | People, roles, influence, communication preferences |
| **Opportunities** | Commercial context, stage, value, objectives, blockers |
| **Activities** | Interactions, follow-ups, outcomes, relationship memory |
| **Meetings** | Decisions, commitments, risks surfaced in conversation |
| **Emails** | Written commitments, questions, tone, response patterns |
| **Documents** | Technical specs, commercial terms, assumptions, revisions |
| **SharePoint** | Organizational files, version history, linked knowledge |
| **Teams** | Conversations, channel context, collaborative decisions |
| **Planner** | Tasks, ownership, execution status |
| **Outlook** | Calendar, scheduling, communication threads |

### Design implication

Source browsers (company lists, contact tables, activity grids) are **secondary surfaces**. They exist for lookup and administration — not as the primary daily experience.

The primary experience is **Mission Control**: curated understanding and prioritized action derived from sources.

---

## 4. Knowledge Objects

Knowledge objects are the structured atoms extracted from sources. They are more important than the records they came from.

### Object types

#### Facts

Verified or strongly indicated truths about the business relationship or opportunity.

*Examples:*
- Customer identified mixed plastics as the primary feedstock for the thermal recovery line.
- Formal quotation for PL-1031 was accepted in May 2026.
- Reactor vessel has been delivered; project is in site installation.

#### Risks

Conditions that could block progress, damage the relationship, or invalidate assumptions.

*Examples:*
- Mixed-plastics feedstock variance may delay commissioning.
- Decision maker access has not been confirmed.
- Handover window overlaps with site audit week.

#### Decisions

Choices made by the customer or seller that change the path forward.

*Examples:*
- Elena Lindström assumes Technical Lead across PL-1031.
- Non-conforming batches paused until sampling is complete.
- Weekly sync moved to Tuesdays 14:00 CET.

#### Commitments

Promises made by either party, with implied or explicit timing.

*Examples:*
- Customer will review the proposal by end of week.
- HR to update project roster by Friday.
- Seller to send commissioning timeline draft.

#### Unknowns

Gaps in understanding that block confident decisions.

*Examples:*
- Approval process unclear.
- Procurement requirements not validated.
- Offtaker path not confirmed.

#### Stakeholders

People who influence, decide, or execute — with role and relationship level.

*Examples:*
- Elena Lindström — Plant Manager, strategic relationship, technical lead.
- Jonas Berg — Procurement, operational contact.
- Economic buyer not yet identified.

#### Relationships

The quality and trajectory of engagement with an account or person.

*Examples:*
- Nordic Polymers AB — active engagement, 4 logged interactions, strategic account.
- Last contact 45 days ago — relationship cooling.

#### Actions

Recommended or scheduled work derived from knowledge — not raw CRM tasks.

*Examples:*
- Schedule site sampling visit to resolve feedstock variance.
- Prepare discovery email to clarify budget approval path.
- Confirm commissioning readiness criteria with plant team.

### Storage principle

Knowledge objects may be stored in activity fields, opportunity understanding models, relationship memory, or dedicated knowledge graphs — but they must always be **surfaced as insights**, never as raw field dumps.

---

## 5. Understanding

Understanding is the continuous synthesis of knowledge into business insights.

SmartCRM must always answer:

| Question | Purpose |
|----------|---------|
| **What do we know?** | Confirmed understanding — facts, decisions, validated assumptions |
| **What don't we know?** | Critical gaps, unknowns, unvalidated assumptions |
| **What changed?** | Momentum, new risks, shifted priorities since last visit |
| **What matters?** | What is relevant to the current decision context |

### Writing standard

Understanding is written for humans making decisions — not for databases.

| Bad (CRM field dump) | Good (business insight) |
|----------------------|-------------------------|
| Feedstock = Mixed Plastics | Mixed plastics have been identified as the primary feedstock for the proposed thermal recovery solution. |
| Budget = €4.1M | Investment expectations have been discussed at approximately €4.1M for the recovery reactor scope. |
| Stage = Site Installation | Equipment is on site and the project has moved into installation — commissioning gates are now the primary commercial risk. |
| Gap: offtaker | The end product path and offtaker commitment have not been confirmed — this blocks confident investment in downstream scope. |

### Opportunity examples (PL-1031)

**What we know:**
- Nordic Polymers AB is pursuing a thermal recovery reactor for mixed plastics feedstock.
- Commercial terms were agreed via formal quotation.
- Reactor vessel has been delivered; project status is site installation.

**What we don't know:**
- Whether feedstock variance will persist after supplier batch change.
- Full procurement and approval path for remaining commissioning scope.

**What changed:**
- Compliance audit flagged mixed-plastics variance — new blocker since last review.
- Elena Lindström elevated to cross-site Technical Lead.

**What matters:**
- Resolving feedstock variance before commissioning — highest risk to timeline and customer confidence.
- Maintaining weekly alignment rhythm established in leadership meeting.

Understanding lives in **Mission Control** surfaces (Overview, Gaps, Understanding tabs) — not in qualification scorecards or CRM field grids.

---

## 6. Prioritization

Prioritization is the brain of SmartCRM.

### SmartAssist's role

SmartAssist is not a chatbot. It is the **prioritization and decision partnership layer** that:

- Observes sources before asking questions
- Reuses existing knowledge before creating work
- Ranks what deserves attention across the portfolio
- Recommends the best next action with reasoning and expected impact

SmartAssist continuously identifies:

| Signal | Example |
|--------|---------|
| **What deserves attention** | Overdue follow-up on PL-1031 feedstock audit |
| **What is most important** | Commissioning blocker on highest-value active deal |
| **What creates risk** | Relationship cooling on strategic account |
| **What should happen next** | Schedule site sampling visit with technical lead |

### Why prioritization scales better than record navigation

| Scale | Record navigation | Prioritization |
|-------|-------------------|----------------|
| 10 opportunities | Manageable lists | Focus on top 2–3 — same UX |
| 100 opportunities | Filter fatigue, missed items | Server ranks top 5 attention items per user |
| 1,000 opportunities | Impossible to scan | User sees 1 focus + 5 attention — ignores 995 safely |
| 10,000 opportunities | CRM becomes shelfware | ML-enhanced ranking on revenue, risk, momentum |

**The objective is not to show everything. The objective is to help users safely ignore 99% of information and focus on the few things that matter.**

### Implementation direction

```
All records (unbounded)
        ↓
Attention / ranking engine (per user, per day, per scope)
        ↓
Mission Control payload (bounded):
  - summary (1 line)
  - focus (1 item)
  - needsAttention (max 5)
  - upcoming (max 5)
  - recommended actions (max 3)
```

Client UIs render curated payloads — never full record sets as the primary experience.

---

## 7. Action

Knowledge without action has no value.

Every important insight should lead to execution. SmartCRM does not only identify problems — it helps solve them.

### Execution artifacts

| Artifact | Purpose |
|----------|---------|
| **Prepare Email** | Customer-ready follow-up or discovery email from opportunity/activity context |
| **Prepare Meeting** | Meeting title, attendees, agenda, questions, desired outcome |
| **Create Validation Plan** | Structured plan to resolve unknowns and validate assumptions |
| **Create Weekly Plan** | Prioritized week ahead — focus items, meetings, follow-ups, risks |
| **Create Opportunity Plan** | Phased win plan — blockers, commercial path, close criteria |
| **Schedule Milestone** | Dated milestone with prep actions and success criteria |

### Action design principles

- Actions are **generated from understanding**, not blank templates
- Actions include **reason** and **expected impact**
- Actions are **copyable and executable** — ready to send, schedule, or assign
- Actions link back to sources — every artifact traceable to the knowledge that produced it

### M365 execution path

| SmartCRM artifact | M365 destination |
|-------------------|------------------|
| Prepare Email | Outlook draft |
| Prepare Meeting | Outlook calendar invite / Teams meeting |
| Weekly / Opportunity Plan | Planner tasks |
| Schedule Milestone | Outlook + Planner |
| Validation Plan | SharePoint document or Planner checklist |

---

## 8. Mission Control Pattern

Mission Control is the primary workspace pattern for every major business object.

It replaces record-centric layouts with **decision-centric surfaces** that answer the five north star questions.

### North star questions (every Mission Control surface)

1. **What do we know?**
2. **What don't we know?**
3. **What changed?**
4. **What deserves attention?**
5. **What should happen next?**

If a screen cannot answer at least one of these, challenge its purpose.

### Opportunity Mission Control (reference implementation)

| Tab | Answers |
|-----|---------|
| **Overview** | What the customer wants · What is blocking · What should happen next |
| **Gaps** | What we don't know — critical knowledge gaps in prose |
| **Understanding** | What we know — confirmed insights |
| **Actions** | Execution workspace — discovery, documents, stakeholders, timeline |
| **Ask** | Opportunity-scoped question against full context |

**Design constraints:**
- One tab visible at a time
- Default tab: Overview
- No AI thinking prompts on screen — answers only
- SmartAssist execution actions at point of need (Questions, Timeline)
- Navigation uses Workspace Mode Nav (Browse | Create | Import pattern) — not CRM tab bars

### Activity Mission Control

| Horizon | Answers |
|---------|---------|
| **Today** | Today's focus · Needs attention · Upcoming |
| **This Week** | Week-scoped priorities |
| **Completed** | Compact history — expand on demand |

Plus SmartAssist: Prepare Follow-Up Email, Prepare Customer Meeting, Summarize Open Risks, Create Weekly Action Plan.

### Future Mission Control surfaces

Every major workspace should adopt the same pattern:

| Workspace | Focus question |
|-----------|----------------|
| Company 360 | What is the state of this relationship and what should we do next? |
| Contact 360 | Who is this person, what do we owe them, what's the next touch? |
| Document 360 | What does this document mean for active opportunities? |
| Portfolio Focus | What across all accounts deserves attention today? |

### Mission Control payload (target contract)

```typescript
type MissionControlPayload = {
  summary: string;                    // One-line situational awareness
  known: Insight[];                   // What we know
  unknown: Gap[];                     // What we don't know
  changed: Change[];                  // What changed since last visit
  attention: PrioritizedItem[];       // What deserves attention (capped)
  nextAction: RecommendedAction;      // What should happen next
  executionActions: ExecutionAction[]; // Available SmartAssist artifacts
};
```

---

## 9. Scalability

SmartCRM must work at every scale — not by showing more data, but by prioritizing better.

### Scale model

| Scale | User experience | System behavior |
|-------|-----------------|-----------------|
| **10 opportunities** | Full context visible; Mission Control feels personal | Client-side ranking sufficient |
| **100 opportunities** | User sees top 5 attention items daily | Server-side mission-control API; scoped by owner/team |
| **1,000 opportunities** | User never sees opportunity list as primary UI | Portfolio Focus + per-deal Mission Control on demand |
| **10,000 opportunities** | Team leads see team priorities; reps see personal focus | ML ranking on revenue impact, risk, momentum, relationship health |

### Navigation model at scale

**Wrong:** Navigate records → filter → sort → paginate → read → decide  
**Right:** Open workspace → read summary → act on focus → drill down only when needed

Users navigate by **priorities**, not records:

- "What needs attention today?" (Activities Mission Control)
- "What is blocking this deal?" (Opportunity Overview)
- "What changed at this account?" (Company Mission Control)
- "What should I prepare for this meeting?" (Meeting Briefing)

Record browsers remain available for lookup — they are never the default daily experience.

### Hard limits (information budgets)

| Surface | Max primary items |
|---------|-------------------|
| Overview insights | 3 |
| Needs attention | 5–7 |
| Today's focus | 1 |
| Upcoming | 5 |
| SmartAssist actions visible | 4–6 |
| History (collapsed) | 8–10, paginated beyond |

When limits are exceeded: rank, summarize, collapse — never add another card or column.

---

## 10. Design Principles

### Michelin Test

Every element must earn its place.

Before adding or keeping any UI element, ask: *"Does this help the user make a better decision?"*

If not: **remove it** — do not hide, collapse, or relocate. Less is better. Clarity beats completeness.

### Apple Test

Within 5 seconds the user must understand:

1. What am I looking at?
2. What matters?
3. What should I do next?

If a screen requires explanation, it has failed.

### One Source of Truth

Understanding is computed once and surfaced consistently across Outlook, Teams, web, and Mission Control surfaces. Never duplicate intelligence logic. Never show conflicting scores or recommendations.

Engines produce understanding; UI renders it; Copilot explains it. SmartCRM decides.

### Clarity over Completeness

Show the insight, not the data behind it. Expert detail lives behind progressive disclosure — never on primary surfaces.

Users trust SmartCRM when it is confidently incomplete (showing what matters) rather than exhaustively overwhelming (showing everything).

### Every Interaction Builds Knowledge

Logging an activity, sending an email, uploading a document, or completing a meeting must extract and persist knowledge objects — facts, decisions, risks, commitments, unknowns.

Empty records with no knowledge contribution should not exist. Forms capture understanding, not field values.

### Additional governing principles

| Principle | Rule |
|-----------|------|
| **Knowledge before questions** | Search existing knowledge before asking the user |
| **System thinks, user decides** | SmartAssist recommends; user chooses |
| **Impact mandatory** | Every risk and recommendation includes why it matters |
| **Progressive disclosure** | Must-see first; expert detail on expand |
| **Living records** | Records breathe — last touch, momentum, what changed |
| **Relationship-first navigation** | Navigate relationships, not menus |

---

## Appendix: Current implementation map

| Workspace | Status | Knowledge flow stage |
|-----------|--------|----------------------|
| Opportunity Mission Control | Implemented | Understanding → Prioritization → Action |
| Activity Mission Control | Implemented | Prioritization → Action |
| Opportunity SmartAssist (Email, Meeting, Plan) | Implemented | Action |
| Activity SmartAssist (Email, Meeting, Risks, Plan) | Implemented | Action |
| Relationship memory (activities) | Implemented | Sources → Knowledge |
| Opportunity understanding engine | Implemented | Knowledge → Understanding |
| Company / Contact Mission Control | Planned | — |
| Server-side mission-control APIs | Planned | Prioritization at scale |
| "What changed?" diff intelligence | Planned | Understanding |

---

## SmartCRM Mission Statement

> **SmartCRM transforms organizational information into understanding, understanding into priorities, and priorities into action — so every person in the organization knows what matters and what to do next.**
