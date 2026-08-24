# FS-015 – Project Relationship & Stakeholder Model

## Document Information

| Property            | Value                                                                                   |
| ------------------- | --------------------------------------------------------------------------------------- |
| ID                  | FS-015                                                                                  |
| Title               | Project Relationship & Stakeholder Model                                                |
| Status              | Approved                                                                                |
| Priority            | High                                                                                    |
| Category            | Project Management                                                                      |
| Version             | 1.0                                                                                     |
| Phase               | 2.2A                                                                                    |
| Related             | FS-001 Opportunity Stakeholders · Project Mission Control · SmartAssist                 |
| Governing standards | SmartCRM Constitution · SmartAssist Constitution · SmartCRM North Star                  |

---

## 1. Purpose

Projects are delivered by people across organizations — not by a single account field.

SmartCRM must treat **related organizations** and **project stakeholders** as first-class, user-controlled capabilities on every project: real companies, real contacts, clear roles, and SmartAssist that surfaces coverage gaps without inventing people or companies.

**Workspace Consistency:** Projects and Opportunities must feel identical — Mission Control overview + Actions working surface, Apple / 3-second clarity, 12-Year-Old Rule for add/edit/remove.

---

## 2. Problem Statement

Without first-class project relationships:

- Delivery teams cannot see which organizations are involved (customer, partner, supplier, regulator)
- Stakeholder coverage is guessed or buried in free text
- SmartAssist cannot answer “who is missing?” with confidence
- Users re-enter people who already exist as contacts
- Projects and opportunities feel like different products

This violates Reality First, Knowledge before questions, Apple / 3-Second Test, and **system thinks, user decides**.

---

## 3. Business Goals

1. Multiple related organizations per project with typed roles.
2. User-controlled stakeholder roster: add, remove, edit role, change organization.
3. Default role catalog plus **+ Create New Role**.
4. SmartAssist continuously evaluates missing Decision Makers, Sponsors, Technical Leads, Suppliers, Approvers.
5. Display Stakeholder Coverage, Relationship Health, Influence Map, Roles, and Responsibilities.
6. Keep Projects and Opportunities Mission Control parity.

---

## 4. User Stories

| ID    | As a…           | I want to…                                              | So that…                                      |
| ----- | --------------- | ------------------------------------------------------- | --------------------------------------------- |
| US-01 | Project user    | Add / change / remove related organizations             | The delivery ecosystem is explicit            |
| US-02 | Project user    | Link multiple organizations (customer, partner, …)      | Multi-party projects are truthful             |
| US-03 | Project user    | Add a contact as stakeholder with a role                | Who owns what is clear in seconds             |
| US-04 | Project user    | Edit role and change organization without removing      | Roles evolve without data loss                |
| US-05 | Project user    | Create a custom role when defaults do not fit           | Reality is not forced into wrong labels       |
| US-06 | Commercial user | See coverage and missing roles from SmartAssist         | I decide who to engage next                   |

---

## 5. Functional Requirements

### 5.1 Related Organizations

Allow:

- Add Organization
- Change Organization
- Remove Organization
- Multiple Organizations per Project

Organization types:

| Type       | Label      |
| ---------- | ---------- |
| customer   | Customer   |
| partner    | Partner    |
| supplier   | Supplier   |
| consultant | Consultant |
| regulator  | Regulator  |
| investor   | Investor   |
| internal   | Internal   |
| other      | Other      |

Rules:

1. Organizations resolve to real Company Registry IDs — never invent companies.
2. One organization may be marked **primary** (drives account linkage / `linkedCompanyId`).
3. Removing an organization reassigns stakeholders that pointed at it to **Organization not linked** (`UNASSIGNED_ORGANIZATION_ID`) — Reality First, no orphan labels.

### 5.2 Project Stakeholders

Allow:

- Add Contact (and internal Standard Bio user)
- Remove Contact
- Edit Contact Role
- Change Contact Organization

Default roles (ordered):

1. Project Manager
2. Commercial Lead
3. Technical Lead
4. Engineering Lead
5. Decision Maker
6. Executive Sponsor
7. Project Sponsor
8. Technical Buyer
9. Supplier
10. Consultant
11. EIC
12. Procurement
13. Legal

Support: **+ Create New Role** (free text persisted on the roster).

Rules:

1. External stakeholders resolve to Contact Registry IDs — never invent contacts.
2. Each stakeholder has an `organizationId` pointing at a related organization, Internal (Standard Bio), or unassigned.
3. Optional responsibilities and influence (High / Medium / Low) support Influence Map and Responsibilities.
4. User-removed stakeholders stay removed (`removedStakeholders`) — migration and SmartAssist must not recreate them.

### 5.3 Surfaces

| Surface                                           | Requirement                                                                 |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| Project Mission Control — Overview                | Compact orgs + stakeholders + stakeholder intelligence                      |
| Project Mission Control — Actions → Organizations | Full related-organizations table                                            |
| Project Mission Control — Actions → Stakeholders  | Full roster + full SmartAssist intelligence                                 |

---

## 6. SmartAssist Behaviour

**The system does the thinking. The user makes the decision.**

Continuously evaluate (when evidence context exists):

| Gap              | Typical trigger                                              |
| ---------------- | ------------------------------------------------------------ |
| Missing Decision Maker | Customer project with evidence, no Decision Maker role |
| Missing Sponsor  | Active customer project / decisions, no sponsor role         |
| Missing Technical Lead | Milestones present, no Technical / Engineering Lead     |
| Missing Supplier | Supplier organization linked, no Supplier stakeholder        |
| Missing Approver | Regulator / permit risk, no Legal / Procurement / EIC        |

Display:

1. **Stakeholder Coverage** (score + label)
2. **Relationship Health** (Healthy / Needs Attention / At Risk)
3. **Influence Map**
4. **Roles**
5. **Responsibilities**

Every gap includes **impact** and a recommended action. SmartAssist never invents contacts or organizations.

---

## 7. UX Design

- **Apple / 3-Second Test:** What am I looking at? Who is involved? Who is missing?
- **12-Year-Old Rule:** Pick a company/type or pick a person/role — no CRM jargon.
- **Workspace Consistency:** Same Mission Control rhythm as Opportunities (FS-001 / FS-005).
- Michelin: Overview stays compact; depth lives on Actions tabs.

---

## 8. Reality First

- Unknown organization → unassigned, not invented.
- Unknown person → not shown as stakeholder.
- Unknown role coverage → Missing / Assumed with impact — never fabricated names.

---

## 9. Persistence / Ownership

| Field                   | Store                         | Notes                                      |
| ----------------------- | ----------------------------- | ------------------------------------------ |
| `relatedOrganizations`  | Project workspace JSON        | Company IDs + type + primary               |
| `projectStakeholders`   | Project workspace JSON        | Contact/user + role + organizationId       |
| `removedStakeholders`   | Project workspace JSON        | Tombstones so removals stick               |
| Contact / Company       | Contact / Company registries  | Single source of truth for people/companies|

RBAC: `canManageProjectStakeholders`.

API: `PATCH /api/projects/[projectId]` with relationship fields.

---

## 10. Acceptance Criteria

1. User can add, change, and remove multiple related organizations with the listed types.
2. User can add, remove, edit role, and change organization for stakeholders.
3. Default roles match §5.2; custom roles via **+ Create New Role**.
4. SmartAssist shows coverage, health, influence map, roles, responsibilities, and the five gap kinds when applicable.
5. Removing an organization does not leave stakeholders labeled with a deleted org.
6. Project Mission Control feels consistent with Opportunity Mission Control.
7. No invented contacts or companies appear on the roster.

---

## 11. Out of scope (this FS)

- Creating/merging Company or Contact records (FS-002 / FS-003)
- Auto-emailing stakeholders
- Opportunity buying-center presets (FS-001) — shared vocabulary only where overlapping
