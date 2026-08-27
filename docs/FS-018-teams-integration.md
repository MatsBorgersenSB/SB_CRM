# FS-018 – Microsoft Teams Integration

## Document Information

| Property | Value |
|----------|-------|
| Specification ID | FS-018 |
| Title | Microsoft Teams Integration |
| Status | Approved |
| Priority | High |
| Category | SmartAssist & M365 Integrations |
| Version | 1.0 |
| Phase | 6 — Integrations |
| Related | FS-012 Relationship Intake · FS-013 Active Operating Loop · FS-014 Post-Meeting Notes · FS-015 Project Relationships · FS-017 Outlook Integration · AD-001 Filter Transparency |
| Governing standards | SmartCRM Constitution · SmartAssist Constitution · SmartCRM North Star · Michelin / Apple / 3-Second / Reality First |

---

## 1. Purpose

SmartCRM is the **intelligence layer above Microsoft 365**. Teams is where collaboration already happens.

FS-018 defines how SmartCRM embeds **decision intelligence** in Teams — Account Workspace, Meeting Briefing, Daily Focus, message assign, and channel operating loops — **without** turning Teams into a second CRM.

**North Star questions on every Teams surface:**

1. What do we know?
2. What don’t we know?
3. What changed?
4. What deserves attention?
5. What should happen next?

---

## 2. Problem Statement

Sellers and delivery teams collaborate in Teams (channels, chats, meetings) while relationship and project truth lives in SmartCRM. Today:

- Context requires leaving Teams to open the web CRM
- Meeting knowledge dies in transcripts and chat history
- Channel work (e.g. Escalante + Guard) lacks a living account/project surface
- Assigning a Teams message to company / project / opportunity is manual or impossible
- Risk of duplicate companies/contacts if intake is loose

This violates **context before navigation**, **knowledge before questions**, and Michelin information budgets.

---

## 3. Business Goals

1. Put SmartCRM intelligence **where collaboration happens** — not a CRM iframe.
2. Reuse the same engines and registries as Outlook / web (single source of truth).
3. Make meetings produce approved knowledge (decisions, commitments, risks, unknowns).
4. Support **sell-to**, **buy-from**, and **collaborate** postures correctly (no invented opportunities for suppliers).
5. Prevent duplicate Contacts and Companies (resolve → propose → confirm).
6. Pass the 3-second test on every Teams surface.

---

## 4. Non-Goals (explicit)

| Out of scope (v1–v3) | Why |
|----------------------|-----|
| Full Opportunity / Project Mission Control inside Teams | Violates Michelin; web owns depth |
| CRM screens / iframes in Teams | North Star: use `@smartcrm/m365-ui` only |
| Live meeting bot joining calls | Heavy; FS-014 post-meeting path first |
| Replacing Teams Copilot | Copilot explains; SmartCRM decides |
| Competing notification inbox | Activity = only “deserves attention” |

---

## 5. User Stories

| ID | As a… | I want to… | So that… |
|----|-------|------------|----------|
| US-01 | Seller | See Daily Focus in Teams | I know what deserves attention today without opening SmartCRM |
| US-02 | Seller | Open Meeting Briefing before a call | I walk in knowing objective, risks, and next action |
| US-03 | Seller / PM | After a meeting, review SmartAssist notes from transcript | Knowledge is captured without re-typing |
| US-04 | Delivery lead | Pin Account Workspace on a project channel | Escalante-style work has living context |
| US-05 | Anyone | Assign a Teams message to company / project / opportunity | Collaboration links to the right record |
| US-06 | Anyone | Add unknown attendees via Relationship Intake | No invented people; no duplicate emails |
| US-07 | Buyer-side partner channel | Link mail/messages to **project**, not pipeline | Guard-like roles stay posture-correct |

---

## 6. Functional Requirements

### 6.1 Surfaces and information budgets

| Surface | Max blocks | Scroll | Placement |
|---------|------------|--------|-----------|
| Daily Focus (personal app / Activity card) | **4** | None | Personal Teams app + optional Activity |
| Meeting Briefing (meeting side panel) | **7 sections** | Soft | Pre-join / in-meeting side panel |
| Account Workspace (channel tab) | **7** | One screen | Channel tab bound to company or project |
| Message assign (message extension) | Michelin form | None | Message ··· → SmartCRM |

Hard rule: when budget exceeded — prioritize, summarize, collapse — **never add another card**.

### 6.2 Daily Focus (Phase 1)

Exactly four items (order fixed):

1. Who to engage today (external contact preferred)
2. Opportunity or project at risk (+ impact)
3. Open commitment due / overdue (+ impact)
4. One SmartAssist next best action (+ impact)

Actions only: **Execute in Planner** · **Open in SmartCRM** · **Prepare email / meeting**.

No engine IDs, confidence %, or rule dumps in primary UI.

### 6.3 Meeting Briefing (Phase 1)

Must include (North Star):

1. Relationship summary  
2. What changed  
3. Open opportunities **or** projects (posture-aware)  
4. Top risks (+ impact)  
5. Discussion topics  
6. **Meeting objective** (singular)  
7. Next best action (+ impact)  

Resolve meeting attendees against Contact Registry. Unknown → Relationship Intake (FS-012), never auto-create.

### 6.4 Post-meeting capture (Phase 1–2)

Reuse **FS-014**:

- Graph transcript when permitted, else paste VTT / plain text
- Propose summary, decisions, commitments, risks, unknowns
- Persist only after user Approve
- Do not invent speakers as contacts

### 6.5 Account Workspace — channel tab (Phase 2)

Bound a channel to **one** of:

- Company (`companyId`)
- Project (`projectId`)

**Seven blocks (fixed order):**

1. What am I looking at? (name + relationship posture)
2. What changed (≤7 days)
3. Top risk (+ impact)
4. Next best action (+ impact)
5. Open commitments
6. Linked opportunities **or** projects (posture-aware; buy-from → projects / commitments, not Create Opportunity)
7. People who matter (stakeholders — Reality First)

Actions: Prepare email · Prepare meeting · Open in SmartCRM · Assign message.

**Posture rules (hard):**

| Posture | Commercial CTAs |
|---------|-----------------|
| Sell-to | Opportunity eligible |
| Buy-from / collaborate / watch / unclassified | Company + Project only; recommend classify if unclassified |
| Multi-type | Sell-to presence enables opportunity CTAs |

### 6.6 Assign Teams message (Phase 3)

Parity with Outlook compose assign:

| Link target | When allowed |
|-------------|--------------|
| **Company** | Always when company resolved |
| **Project** | Always when options exist |
| **Opportunity** | Only if `isOpportunityEligibleCompany` |

Requirements:

1. Resolve sender / mentioned people by email against Contact Registry.
2. Unknown → FS-012 intake (propose → confirm) before assign completes.
3. **No duplicates:** same email → reuse contact; same org.no. / domain → reuse or block create with link to existing.
4. Store link on conversation / message id (Graph) analogous to Outlook `conversationId` tagging.
5. Optional: create Planner task from approved commitment.

### 6.7 Channel ↔ project operating loop (Phase 4)

1. Explicit binding: Teams `channelId` + `teamId` → `projectId` or `companyId`.
2. Weekly (or on-demand) Adaptive Card: “What deserves attention” for that binding (≤4 items).
3. Silence / missing stakeholder / overdue commitment signals from existing engines — no new scoring theatre.
4. User can unbind; Reality First — no auto-binding by channel name alone without confirm.

### 6.8 Identity, auth, and tenancy

1. Prefer Entra SSO / Teams SSO token → SmartCRM session (align FS-017).
2. Same RBAC as web (fail-closed roles).
3. Tenant Graph permissions documented (minimum viable set per phase).
4. Internal-only threads follow FS-009 privacy defaults (do not leak into external deal intelligence).

### 6.9 Shared UI package

All Teams UI shall use `@smartcrm/m365-ui` (or successor) components:

`RelationshipHeader` · `HealthRing` · `NextBestActionCard` · `MeetingBriefing` · `ImpactContext` · `DailyFocus` · `AccountWorkspace`

Brand colors only. No redesign. No CRM iframes.

### 6.10 Engine rule

Intelligence from existing engines only (health, NBA, opportunity/project, stakeholders, SmartDocs, briefing). Copilot may explain; SmartCRM decides. No parallel AI stack inside Teams.

---

## 7. SmartAssist Behaviour

- Observe channel / meeting / message context before asking
- Search existing company, contact, project, opportunity knowledge before intake questions
- Recommend assign target (company vs project vs opportunity) with posture awareness
- Propose meeting notes; never auto-confirm facts
- Impact mandatory on every risk and recommendation
- System thinks; user decides

---

## 8. UX Design

### 8.1 Apple / 3-second test

Within 3 seconds on any Teams SmartCRM surface:

1. What am I looking at?
2. What matters?
3. What should I do next?

### 8.2 12-Year-Old Rule

Labels: Company · Project · Opportunity · Save · Approve — no CRM jargon (“entity”, “synonym match”, rule IDs).

### 8.3 Message assign flow (Michelin)

1. Recipient / subject context (from message)  
2. Link to: Company | Project | Opportunity (gated)  
3. If unknown contact → intake card  
4. Assign  

One primary button. No widget sprawl.

### 8.4 Empty / unknown states

| State | Behaviour |
|-------|-----------|
| No binding on channel | “Link this channel to a company or project” (confirm) |
| Unknown email | FS-012 proposal — never silent create |
| Duplicate org.no. / email | Show existing record + Open — block second create |
| Not sell-to | Opportunity hidden/disabled with plain-language reason |

---

## 9. Reality First Principle

- Never invent people, companies, relationships, opportunities, or commitments
- Unknown stays unclassified / unlinked until user confirms
- Company ≠ client — posture before pipeline
- Transcript speakers are not contacts until intake approval
- Empty briefing is valid when knowledge is missing — show gaps, don’t fabricate

---

## 10. Persistence / Ownership Rules

| Object | System of record |
|--------|------------------|
| Company / Contact | Contact & Company registries (FS-002 / FS-003) |
| Opportunity / Project | Existing opportunity / project stores |
| Meeting + commitments | FS-008 / FS-014 |
| Message / conversation links | Same pattern as Outlook mail-tag (`conversationId` / Graph message id) |
| Channel binding | New lightweight binding table (teamId, channelId → companyId \| projectId, boundBy, boundAt) |
| Intelligence scores | Existing engines — never duplicated for Teams |

---

## 11. Phased Delivery

| Phase | Scope | Exit criteria |
|-------|--------|----------------|
| **1 — Presence** | Personal app: Daily Focus (4) + Meeting Briefing side panel | Seller can brief before a call without leaving Teams |
| **1 status** | **In progress in product** — hosts at `/teams/daily-focus` and `/teams/meeting-briefing`; package under `teams/` | Sideload + Entra `webApplicationInfo` still required per tenant |
| **2 — Account room** | Channel tab Account Workspace (7) for company or project | Escalante-style channel shows living context |
| **3 — Capture** | Message extension Assign + FS-014 transcript path from Teams | Message and meeting knowledge land with Approve |
| **4 — Operating loop** | Channel binding + weekly attention Adaptive Card + Planner handoff | Project channel becomes attention cockpit |

Phases are sequential for quality; Phase 3 may reuse Phase 1 Graph permissions.

---

## 12. Acceptance Criteria

1. No Teams surface embeds a SmartCRM web iframe or full Mission Control page.
2. Daily Focus never exceeds 4 primary items; Account Workspace never exceeds 7 blocks.
3. Meeting Briefing always includes a singular meeting objective and impact on top risk / NBA.
4. Opportunity assign is impossible for non–sell-to companies unless also typed sell-to.
5. Assigning a message never creates a duplicate contact email or duplicate organization number / domain company.
6. Unknown attendees/senders go through Relationship Intake before persistence.
7. Post-meeting notes create only **proposed** commitments until Approve (FS-014).
8. Channel binding requires explicit user confirmation; unbinding is supported.
9. All primary risks/recommendations render `ImpactContext` or equivalent impact copy.
10. Same company/contact opened from Teams and web shows the same registry ids (single source of truth).

---

## 13. Compliance Tests (ship gate)

| Test | Pass condition |
|------|----------------|
| Michelin budget | Block counts enforced in UI code / storybook |
| Posture gate | Supplier-only company: Opportunity control disabled |
| Duplicate contact | Second add of same email returns existing / blocks create |
| Duplicate company | Same org.no. surfaces existing company link |
| 3-second copy | Briefing/workspace answers what / matters / next without scrolling past fold on desktop |
| No iframe | Manifest / package review: zero SmartCRM web frame hosts |

---

## 14. Open Decisions

1. Prefer **personal app first** vs **meeting app first** for Phase 1 tenant rollout order (recommend: Meeting Briefing + Daily Focus together).
2. Channel binding UX: admin-only vs any project member (recommend: anyone who can manage project stakeholders).
3. Whether Phase 4 weekly cards are opt-in per channel (recommend: opt-in).

---

## 15. Related Implementation Anchors (code)

| Capability | Existing / planned |
|------------|-------------------|
| M365 payloads | `/api/m365/*` relationship-card, briefing, daily-focus, account-workspace |
| Teams Phase 1 hosts | `/teams/daily-focus`, `/teams/meeting-briefing` + `teams/manifest.json` |
| Outlook assign parity | Compose assign + mail-tag (Company / Project / Opportunity) |
| Intake | FS-012 / Outlook no-contact state |
| Post-meeting | FS-014 |
| UI kit | `src/components/m365` (local `@smartcrm/m365-ui` patterns) |

---

## 16. Success Metric (product)

Users say: **“I’ll check SmartAssist in Teams”** — not **“I need to update the CRM after the meeting.”**
