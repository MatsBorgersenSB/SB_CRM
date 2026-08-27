# FS-001 – Opportunity Stakeholder Management

## Document Information


| Property            | Value                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------- |
| ID                  | FS-001                                                                                 |
| Title               | Opportunity Stakeholder Management                                                     |
| Status              | Approved                                                                                  |
| Priority            | High                                                                                   |
| Category            | Opportunity Management                                                                 |
| Version             | 1.1                                                                                    |
| Related             | Opportunity Mission Control · SmartAssist Relationship Intelligence · Company Contacts |
| Governing standards | SmartCRM Constitution v6.0 · SmartAssist Constitution · SmartCRM North Star            |


---



## 1. Purpose

Business opportunities are won by people, not companies.

SmartCRM must treat **stakeholder management** as a first-class capability on every opportunity: real people, clear roles, user-controlled roster, and SmartAssist that surfaces coverage gaps without inventing contacts.

---



## 2. Problem Statement

Today, sellers often know *which company* is in play, but not *who* can decide, who holds budget, who influences technical acceptance, or who is missing.

Without first-class stakeholders:

- Decision Maker status is guessed or invented
- SmartAssist cannot answer “who should we engage next?” with confidence
- Gaps and next-best actions become generic
- Users re-enter people who already exist on the company roster
- The opportunity looks “active” while relationship coverage is empty

This violates Constitution principles:


| Principle                       | Failure mode                                                              |
| ------------------------------- | ------------------------------------------------------------------------- |
| **Reality First**               | System invents or implies people who are not on the roster                |
| **Knowledge before questions**  | User is asked for names the company contact list already holds            |
| **Apple / 3-Second Test**       | User cannot tell in seconds who matters on this opportunity               |
| **12-Year-Old Rule**            | Adding a stakeholder feels like CRM admin, not “pick a person and a role” |
| **System thinks, user decides** | Assistant invents; user cannot trust or correct the roster                |


**Core problem:** Opportunities lack an obvious, trustworthy place to record and manage the people who actually move the deal.

---



## 3. Business Goals

1. Make stakeholder coverage a visible, controllable part of every opportunity.
2. Ensure Decision Maker / Economic Buyer / key roles are either **Known** (user-assigned) or explicitly **Unknown** — never fabricated.
3. Reuse company contacts as the primary source of people (no duplicate person records for opportunity assignment).
4. Feed SmartAssist relationship and opportunity intelligence from the live roster.
5. Reduce time-to-first-stakeholder after opportunity create to under one minute for a trained user.
6. Align seller behaviour with Standard Bio BD reality: multi-threaded buying centers, not single-name “accounts.”

**Success looks like:** A seller opens an opportunity, sees who is on it, what roles are covered or missing, and can add a real company contact with a role without leaving the opportunity workspace.

---



## 4. User Stories



### Primary — Commercial / BD


| ID     | As a…           | I want to…                                                       | So that…                                                               |
| ------ | --------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| US-01  | Commercial user | Add a company contact to an opportunity with a project role      | The buying center is explicit                                          |
| US-02  | Commercial user | See Decision Maker as Unknown when none is assigned              | I know what to fix next                                                |
| US-03  | Commercial user | Change a stakeholder’s role without removing them                | Roles evolve as discovery progresses                                   |
| US-04  | Commercial user | Remove a stakeholder who is no longer relevant                   | The roster stays true                                                  |
| US-05  | Commercial user | Get suggested contacts from the opportunity’s company            | I do not hunt through unrelated people                                 |
| US-06  | Commercial user | Add a stakeholder immediately after creating an opportunity      | Momentum is not lost                                                   |
| US-06A | Commercial user | Add stakeholders that do not belong to the customer organization | The complete decision, influence and advisory ecosystem is represented |




### External Stakeholder Support

SmartCRM shall support stakeholders that do not belong to the opportunity company.

External stakeholders may include:

- Consultants
- Technology Advisors
- EPC Contractors
- EIC
- Engineering Firms
- Investors
- Suppliers
- Regulatory Contacts
- Strategic Partners
- Offtakers

Opportunities frequently involve multiple organizations and external influencers.

SmartCRM shall represent the complete business ecosystem around an opportunity, including customer stakeholders, consultants, suppliers, engineering firms, investors, strategic partners and other relevant parties.

The objective is to understand the people and organizations that influence opportunity outcomes.

### Secondary — Engineer / Superuser


| ID    | As a…     | I want to…                                               | So that…                                    |
| ----- | --------- | -------------------------------------------------------- | ------------------------------------------- |
| US-07 | Engineer  | Manage technical stakeholders on opportunities I support | Technical coverage is visible to commercial |
| US-08 | Superuser | Manage any opportunity roster                            | Data quality can be corrected               |




### SmartAssist / Intelligence


| ID    | As a…  | I want SmartAssist to…                                   | So that…                        |
| ----- | ------ | -------------------------------------------------------- | ------------------------------- |
| US-09 | Seller | Surface stakeholder coverage (Known / Assumed / Unknown) | I trust what is real vs missing |
| US-10 | Seller | Recommend who to engage next from real roster gaps       | Effort goes to the right person |
| US-11 | Seller | Never invent a contact name                              | I never act on fiction          |




### Negative / guardrails


| ID    | As a…       | I must not…                                                                    | Because…                                         |
| ----- | ----------- | ------------------------------------------------------------------------------ | ------------------------------------------------ |
| US-12 | Any user    | Be required to type a free-form person who already exists as a company contact | Duplicate knowledge and Reality First violations |
| US-13 | SmartAssist | Auto-create fictional Decision Makers                                          | Trust and Constitution                           |


---



## 5. Functional Requirements



### 5.1 Scope

Stakeholders are **opportunity-scoped** members of `pipeline.team`.

Each member is:


| Field         | Rule                                                                                                                |
| ------------- | ------------------------------------------------------------------------------------------------------------------- |
| `contactId`   | Required. References an existing contact (preferably on the opportunity company).                                   |
| `projectRole` | Required string. Selected from standard opportunity roles, offering-suggested roles, or a user-defined custom role. |


Display name, title, email, and company affiliation are **resolved** from the contact record — not duplicated on the team row.

Stakeholders may represent:

- Customer Organizations
- Partners
- Suppliers
- Consultants
- Engineering Firms
- EPC Contractors
- EIC
- Investors
- Regulatory Bodies
- Other External Organizations

All stakeholder assignments must resolve to an actual contact.

Organizations may influence opportunities, but stakeholder participation is always represented through a real person associated with that organization.

### 5.2 Standard opportunity roles

The system shall provide at least:


| Role              | Intent                |
| ----------------- | --------------------- |
| Decision Maker    | Owns go / no-go       |
| Executive Sponsor | Executive air cover   |
| Technical Lead    | Technical acceptance  |
| Commercial Lead   | Commercial path       |
| Procurement       | Buying process        |
| Influencer        | Soft power / blockers |
| Economic Buyer | Controls funding or investment approval |


Additional roles from the project role catalog (e.g. Project Manager, Legal, Consultant) and **offering-driven suggested roles** may appear. Custom roles are allowed.

**Decision Maker detection:** Case-insensitive match of `projectRole` containing `decision maker`.

### 5.3 Create & maintain

The system shall allow authorized users to:

1. **Add** a stakeholder: select contact → select/confirm role → persist.
2. **Edit role** of an existing stakeholder.
3. **Remove** a stakeholder from the opportunity (does not delete the company contact).
4. Prevent duplicate `contactId` on the same opportunity team.



### 5.4 Company contact priority

When adding a stakeholder:

1. Prefer contacts belonging to the opportunity’s company.
2. Surface up to a small set of **Suggested** chips from that company (titled contacts first).
3. Allow selection from other companies only as secondary (clearly labeled).
4. If the company has no contacts, guide the user to add contacts on the company first — do not invent people.

5. Support external stakeholders that are not associated with the opportunity company.

Examples:

- Consultants
- Suppliers
- Engineering Firms
- EPC Contractors
- EIC
- Investors
- Strategic Partners

External stakeholders shall be clearly associated with their organization.

Company contacts remain the preferred source for customer stakeholders.

However, SmartCRM shall support the complete business ecosystem around an opportunity, including customers, consultants, suppliers, engineering firms, EPC contractors, EIC, investors, partners and other organizations that influence opportunity outcomes.

### 5.5 Post-create path

After opportunity create, the system shall offer an obvious **[+ Add Stakeholder]** path using company contact suggestions so the roster can start non-empty without a multi-screen hunt.

### 5.6 Surfaces


| Surface                                              | Requirement                                                                                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Opportunity Mission Control — Overview               | Compact stakeholder section: roster + add/edit/remove; copy that SmartAssist never invents contacts |
| Opportunity Mission Control — Actions → Stakeholders | Full stakeholder table (primary working surface)                                                    |
| Company opportunity create flow                      | Optional first stakeholder after create                                                             |




### 5.7 Derived signals (read-only)

Where useful, the UI may show influence / engagement / last-contact style signals derived from activities and relationships. These are **intelligence**, not editable CRM fields on the team row.

### 5.8 Out of scope (this FS)

- Creating or merging company contacts (company/contact FS)
- Project-level stakeholder model — see **FS-015** (Phase 2.2A); shared role vocabulary only
- Auto-emailing stakeholders
- Invented org charts from public web scraping without user confirmation

---



## 6. SmartAssist Behaviour

Governed by SmartAssist Constitution: observe before asking; knowledge before questions; **the system does the thinking; the user makes the decision.**   

### 6.1 Intelligence categories


| Category             | When                                                                                                                              |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Known**            | Stakeholder is on the user-controlled opportunity roster (resolved to a real contact)                                             |
| **Assumed**          | Soft inference only (e.g. role suggested from job title before user confirms) — never presented as a confirmed person on the deal |
| **Unknown**          | Required role or Decision Maker not present on the roster                                                                         |
| **Missing critical** | High-priority coverage gap (e.g. no Decision Maker on an active opportunity)                                                      |




## 6.2 Hard Rules (Non-Negotiable)

### 1. Never invent contacts.

SmartAssist shall never create:

- Fictional names
- Fictional stakeholders
- Fictional email addresses
- Fictional organizations
- Fictional relationship structures

Only verified contacts may appear on an opportunity roster.

---

### 2. Never invent business understanding.

SmartAssist shall not invent:

- Decision Makers
- Economic Buyers
- Sponsors
- Technical Leads
- Objectives
- Risks
- Blockers
- Deliverables
- Commitments

When information is unavailable:

Status shall be:

Unknown

rather than guessed.

---

### 3. Empty roster = Unknown.

If no stakeholders have been assigned:

Decision Maker = Unknown

is acceptable.

Invented answers are not.

---

### 4. Roster without Decision Maker role = Unknown.

If no stakeholder has a Decision Maker role:

Decision Maker = Unknown

until explicitly assigned by a user.

---

### 5. Assigned stakeholders = Known.

User-assigned stakeholders are treated as:

Known

and represent the highest-confidence source of stakeholder information.

---

### 6. The roster is the source of truth.

Answers to questions such as:

- Who is the Decision Maker?
- Who is the Technical Lead?
- Who is the Sponsor?
- Who should be engaged next?

shall be derived from the opportunity roster.

Understanding fields may add context.

The roster owns the people.

---

### 7. SmartAssist may recommend.

SmartAssist may:

- Suggest contacts
- Recommend roles
- Highlight missing coverage
- Recommend engagement actions

SmartAssist shall not automatically assign people.

User confirmation is always required.

---

### 8. External stakeholders are fully supported.

Stakeholders may belong to:

- Customer Organizations
- Partners
- Suppliers
- Consultants
- EPC Contractors
- Engineering Firms
- EIC
- Investors
- Regulatory Bodies
- Other External Organizations

The opportunity shall represent the complete business ecosystem around the opportunity.

---

### 9. Removed means removed.

When a stakeholder is removed by a user:

- SmartAssist shall not recreate the stakeholder automatically.
- SmartAssist may recommend re-adding a stakeholder.
- User confirmation is always required.

User decisions override assistant assumptions.

---

### 10. Knowledge before questions.

Before asking users for stakeholder information:

SmartAssist shall first determine whether:

- The contact already exists
- The organization already exists
- The role is already assigned
- The information is already known

Users should never be asked for information the workspace already contains.

---

### 11. If SmartAssist does not know, it shall say:

"I do not know."

Incomplete truth is preferred over confident fiction.

Trust is more important than appearing intelligent.


### 6.3 Response Standard

Every stakeholder-related recommendation shall answer:

1. What is happening?

Example:

No Decision Maker is assigned.

2. Why does it matter?

Example:

Commercial proposals may stall without understanding who approves investment decisions.

3. What should happen next?

Example:

Review stakeholder coverage and assign a Decision Maker if known.

4. What is the expected outcome?

Example:

Improved understanding of the approval process and increased confidence in opportunity progression.



### 6.4 Relationship to Understanding capture

Opportunity Understanding fields
(e.g. Decision Maker, Economic Buyer,
Stakeholder Map) may derive provisional
answers from the roster when present and
generate gaps when information is missing.

The stakeholder roster is the source of truth
for people and roles.

Opportunity Understanding captures:

- Context
- Business Drivers
- Political Landscape
- Decision Process
- Notes
- Nuance

People shall not be duplicated between
Understanding and Stakeholder Management.

The roster owns the people.

Understanding owns the explanation.

Gaps must not require duplicate person entry
when the roster already holds the fact.

---



## 7. UX Design

Aligned with Constitution / North Star: Michelin, Apple, 3-Second, 12-Year-Old, Space Efficiency.

### 7.1 Design intent


| Test                 | Pass condition                                                            |
| -------------------- | ------------------------------------------------------------------------- |
| **Apple / 3-Second** | User sees who is on the opportunity and whether Decision Maker is covered |
| **12-Year-Old**      | “Pick a person. Pick a role. Done.”                                       |
| **Michelin**         | One roster table + add control — no stakeholder dashboards or card sprawl |
| **Reality First**    | Only real contacts; Unknown when missing                                  |




### 7.2 Interaction pattern

1. Empty state: clear message that no stakeholders are assigned + **[+ Add Stakeholder]**.
2. Add flow: suggested company contacts → full contact select → role select (with smart default from title / missing offering roles) → save.
3. Row actions: edit role, remove.
4. Overview: short explanatory line — *User-controlled. Add, edit role, or remove — SmartAssist never invents contacts.*



### 7.3 Information budget


| Surface               | Budget                                                      |
| --------------------- | ----------------------------------------------------------- |
| Overview stakeholders | Compact list + one add affordance                           |
| Full stakeholders tab | Table of assigned people only — no secondary analytics wall |




### 7.4 Read-only mode

Users without `canManageOpportunityStakeholders` see the roster but cannot add, edit, or remove. Controls are hidden or disabled; no silent no-ops that look editable.

### 7.5 Language

- Prefer “stakeholders” / “people on this opportunity” over CRM jargon (“deal team members”) in primary UI.
- Prefer “Unknown” over empty whitespace for missing Decision Maker.

---



## 8. Reality First Principle

**Reality First:** SmartCRM shows what is actually known from organizational records. It does not invent people, roles, or coverage to look complete.

Applied to this feature:


| Situation                      | Correct behaviour                                   |
| ------------------------------ | --------------------------------------------------- |
| No team members                | Empty roster + Decision Maker Unknown               |
| Contact exists on company      | Suggest that contact                                |
| Role inferred from job title   | Suggest role; user confirms                         |
| Public web / LLM invents a CFO | Do not write to roster                              |
| Contact unresolved / deleted   | Drop from resolved display; do not show ghost names |


**Anti-patterns (forbidden):**

- Auto-populating “Decision Maker: TBD Person”
- Generating fake LinkedIn-style profiles into CRM
- Marking Decision Maker as Known without a roster assignment
- Asking the user to re-type a name already on the company contact list

---



## 9. Stakeholder Roles



### 9.1 Role vocabulary

Canonical opportunity roles (see Functional Requirements §5.2) plus:

- Shared project role catalog entries not already listed
- Offering-pack suggested roles (context-specific)
- User-defined custom roles



### 9.2 Role behaviour


| Behaviour                  | Rule                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Required for add           | Yes — every team member has a `projectRole`                                                                             |
| Multiple people, same role | Allowed (e.g. two Influencers)                                                                                          |
| One person, multiple roles | Not modeled as multiple rows for same `contactId`; use the primary opportunity role (custom text may combine if needed) |
| Decision Maker presence    | Used by SmartAssist coverage and Understanding derivation                                                               |
| Economic Buyer             | May be a distinct Understanding field and/or a role string; roster remains person source of truth                       |




### 9.3 RBAC — who may manage roles on an opportunity


| Auth role    | Manage opportunity stakeholders |
| ------------ | ------------------------------- |
| `superuser`  | Yes                             |
| `commercial` | Yes                             |
| `engineer`   | Yes                             |
| Others       | No (read roster only)           |


Server and client must both enforce; unauthorized `team` patches are rejected.

---



## 10. Persistence Rules



### 10.1 Storage


| Item              | Rule                                                   |
| ----------------- | ------------------------------------------------------ |
| Location          | `PipelineRow.team: PipelineTeamMember[]`               |
| Shape             | `{ contactId: string; projectRole: string }`           |
| Default on create | `team: []`                                             |
| Person data       | Lives on Contact / Company — not copied onto team rows |




### 10.2 Write model

1. UI constructs the **full replacement** `team` array (add / map role / filter remove).
2. Persist via opportunity patch: `syncPipelineRecord(id, { team }, role)`.
3. Server validates RBAC (`assertPipelinePatchAllowed` for `team`).
4. No per-member REST resource required in v1; atomic array replace is the contract.



### 10.3 Resolution

`resolvePipelineTeam` (or equivalent) resolves `contactId` against company contact rosters. Unresolved IDs are omitted from display — Reality First over dangling IDs.

### 10.4 Contact lifecycle


| Event                         | Rule                                                                                  |
| ----------------------------- | ------------------------------------------------------------------------------------- |
| Contact merge                 | Remap `team[].contactId` secondary → primary                                          |
| Contact delete                | Member becomes unresolved; dropped from resolved views; cleanup optional on next save |
| Company change on opportunity | Existing team retained; suggestions re-prioritize to new company                      |




### 10.5 Sync / local

Local and SharePoint-backed transports must accept `team` on deal update. `understanding` and other opportunity patches remain independent; stakeholder people are not stored inside Understanding text as a substitute for `team`.

---



## 11. Acceptance Criteria



### Must pass


| #     | Criterion                                                                                                                               |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------- |
| AC-01 | Authorized user can add a company contact to an opportunity with a role; the person appears on Overview and Stakeholders surfaces.      |
| AC-02 | Authorized user can edit a stakeholder’s role; change persists after reload.                                                            |
| AC-03 | Authorized user can remove a stakeholder; contact remains on the company.                                                               |
| AC-04 | Duplicate `contactId` cannot be added twice to the same opportunity.                                                                    |
| AC-05 | Empty roster shows Decision Maker as **Unknown** (not a fabricated name).                                                               |
| AC-06 | Roster with no Decision Maker role shows Decision Maker as **Unknown**.                                                                 |
| AC-07 | Roster with Decision Maker role shows Decision Maker as **Known** with the resolved contact identity.                                   |
| AC-08 | SmartAssist stakeholder answers never invent contact names.                                                                             |
| AC-09 | Add flow prioritizes the opportunity company’s contacts with visible suggestions when contacts exist.                                   |
| AC-10 | Company with zero contacts: user is guided to add contacts — not offered invented people.                                               |
| AC-11 | After opportunity create, user can add a stakeholder without navigating away from the create success path.                              |
| AC-12 | Unauthorized roles cannot mutate `team` (UI read-only + server reject).                                                                 |
| AC-13 | Apple / 3-Second Test: on Overview, user can identify who is on the opportunity and whether Decision Maker is covered within 3 seconds. |
| AC-14 | 12-Year-Old Rule: add path is explainable as “pick person, pick role, save.”                                                            |
| AC-15 | Michelin: no stakeholder card/dashboard sprawl on primary Overview — compact roster only.                                               |
| AC-16 | Removed stakeholders shall not be recreated automatically by SmartAssist. |




### Should pass


| #     | Criterion                                                                                                |
| ----- | -------------------------------------------------------------------------------------------------------- |
| AC-17 | Role default suggested from contact title / offering missing roles. |
| AC-18 | Custom roles can be entered and reused on the opportunity. |
| AC-19 | Understanding / Gaps may reflect roster-derived Decision Maker without requiring duplicate person entry. |
| AC-20 | External stakeholders can be added from organizations other than the opportunity company. |
| AC-21 | External stakeholders clearly display both organization and opportunity role. |
| AC-22 | SmartAssist includes external stakeholders when evaluating opportunity coverage. |





### Explicit fail conditions


| #    | Failure                                                                                  |
| ---- | ---------------------------------------------------------------------------------------- |
| F-01 | Any auto-created fictional stakeholder on the roster                                     |
| F-02 | Decision Maker shown as Known without a matching team assignment                         |
| F-03 | User must re-type a full person record that already exists on the company to assign them |


---



## 12. Constitution Compliance Checklist (v6.0)


| Principle                   | How this FS complies                                                |
| --------------------------- | ------------------------------------------------------------------- |
| System thinks, user decides | SmartAssist flags Unknown / missing roles; user assigns real people |
| Knowledge before questions  | Suggest company contacts before asking for new names                |
| Reality First               | Unknown over invention; resolve from contacts                       |
| Observe before asking       | Derive coverage from roster; ask only to confirm adds               |
| Relationship intelligence   | Key stakeholders, Decision Maker, gaps, who to engage next          |
| Apple / 3-Second            | Roster + Unknown Decision Maker visible immediately                 |
| Michelin                    | One roster, clear actions                                           |
| 12-Year-Old Rule            | Person + role                                                       |
| Impact mandatory            | Gap / NBA copy states why missing stakeholders block progress       |


---



## 13. Open Questions


| #     | Question                                                                              | Notes                                                     |
| ----- | ------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| OQ-01 | Should Economic Buyer be a first-class roster role in addition to Understanding text? | Prefer dual: role optional; Understanding captures nuance |
| OQ-02 | One contact → multiple concurrent opportunity roles?                                  | Deferred; custom role text or future multi-role model     |
| OQ-03 | Narrower RBAC (`canAssignDealTeam` vs `canManageOpportunityStakeholders`)?            | Align naming in a follow-up permissions FS                |


---



## Approval

Status: Approved

Approved Date: 2026-07-20

Approved By: SmartCRM Product Architecture

Purpose:

This document represents the approved requirements
for Opportunity Stakeholder Management.

Changes after approval shall be made by creating
a new document version rather than modifying
the approved specification.


---

## Document History


| Version | Date       | Notes                                                                                                     |
| ------- | ---------- | --------------------------------------------------------------------------------------------------------- |
| 1.0     | —          | Stub purpose only                                                                                         |
| 1.1     | 2026-07-20 | Full Feature Specification per Constitution v6.0; aligned with Mission Control stakeholder implementation |


