# FS-012 Relationship Intake

## Document Information

| Property | Value |
|----------|-------|
| Specification ID | FS-012 |
| Name | Relationship Intake |
| Status | Approved |
| Owner | SmartCRM |
| Category | SmartAssist & Integrations |
| Related | FS-002 Contact Management · FS-003 Company Management · FS-004 Relationship Intelligence · FS-009 Email Intelligence · FS-011 Autonomous Workflows |
| Governing Standards | SmartCRM Constitution · SmartAssist Constitution · SmartCRM North Star · AD-001 Filter Transparency |

---

## Problem Statement

When a user sends or receives mail from a person who is not yet in SmartCRM, they lose context if they must leave Outlook to create records. SmartAssist already sees the mail — but must not invent companies, contacts, or opportunities. The gap is a clear **Propose → Confirm → Persist** path inside Outlook.

---

## Business Goals

1. Keep the user in Outlook while SmartAssist checks SmartCRM and prepares a create decision.
2. Never auto-create Contacts, Companies, Relationships, or Stakeholders.
3. Capture relationship posture (Supplier / Prospect / Partner…) before inventing commercial CTAs.
4. Optionally connect the thread to an existing opportunity or project after the user approves create.
5. Pass the 3-second test: What am I looking at? What matters? What next?

---

## User Stories

1. As a seller, when I open mail from an unknown person, I want SmartAssist to tell me they are not in SmartCRM and prepare a create draft so I can say Yes or No without leaving Outlook.
2. As a seller, when the company already exists by domain, I want to add only the contact to that company.
3. As a seller, after Yes, I want to optionally link this thread to an existing opportunity or project.
4. As SmartAssist, I want to enrich from signature and available mail context, leave unknowns blank, and never invent Customer or Create Opportunity for buy-from / unclassified roles.

---

## Functional Requirements

### FR-001 Resolve before ask

On Outlook relationship pane for an unknown sender email, SmartAssist shall:

1. Search Contact Registry by exact email.
2. If no contact: search Company Registry by exact domain (then known company name from signature if present).
3. Classify resolution as: **company_match** | **new_company** | **internal_colleague** | (contact already exists → show relationship card, not intake).

Hard rule: **unknown contact never opens the Relationship Card.** Company-domain match without a Contact Registry hit must open Relationship Intake (“Add this contact?”). Missing company must open intake for company + contact.

**Internal colleagues are users, not contacts.** `@standard.bio` (and other internal domains) must never open Add Contact. Outlook shows the person as a SmartCRM user (Users & Access) or as a colleague who can be added there — never as a Contact Registry record.

Confidence:

| Match | Confidence | UI behaviour |
|-------|------------|--------------|
| Exact email contact | high | Relationship card (not intake) |
| Exact company domain | medium | Propose add contact to that company |
| Signature / domain name only | low | Propose create company + contact |
| Nothing useful | none | Propose create with blank name fields allowed |

### FR-002 Enrich without inventing

SmartAssist may prefill from:

- Outlook display name
- Signature block (job title, phone, company name, address, website)
- Email domain (suggested company name only when no CRM company)

SmartAssist shall not invent industry, company type, job role, opportunities, or projects.

### FR-003 Propose — never persist

SmartAssist builds a **Relationship Intake Proposal** (draft only):

- Person draft (name, email)
- Company draft or matched company id
- Enrichment suggestions (accept/ignore)
- Optional link candidates (open opportunities for matched company; projects)
- Decision question (singular)

No CRM write occurs until user approval.

### FR-004 User sovereignty — Yes / No

Primary decision:

- **Yes** — proceed to confirm (required fields) then persist
- **No** — dismiss; leave SmartCRM unchanged

Required on confirm:

- Contact **role** (user-selected list)
- For **new company**: **relationship type** + **industry**
- Optional: link thread to one opportunity **or** one project (not both inventing new deals)

### FR-005 Persist on approve only

On Yes + confirm:

1. Create contact (and company if needed) via Contact / Company Registry (Prisma when available).
2. New companies: `Status = Active` + user-chosen `CompanyTypes` — never default to Prospect/Customer.
3. If user selected an opportunity or project and a conversation id is available: tag the thread intentionally (same rules as Outlook mail tag).
4. Return refreshed relationship card.
5. Offer **View contact in SmartCRM** and **View company in SmartCRM** deep links after successful create.

### FR-006 Posture-gated commercial CTAs

After create:

- **Open relationship card** is always the primary success action.
- **Create opportunity** only when `isOpportunityEligibleCompany` is true (Customer / Prospect / Offtaker).
- Suppliers, partners, unclassified: never nag Create Opportunity.

### FR-007 Information budget (Outlook intake)

Max blocks on primary surface:

1. Status line (not in SmartCRM / company match)
2. Person + company draft summary
3. Decision (Yes / No)
4. On Yes only: confirm fields + optional link
5. Soft link to Open SmartCRM

No dashboard, no chatbot thread, no multi-card sprawl.

---

## SmartAssist Behaviour

| Principle | Behaviour |
|-----------|-----------|
| Observe before asking | Resolve + enrich before showing the card |
| Knowledge before questions | Prefer matched company over asking for a new name |
| System thinks, user decides | Proposal + Yes/No; user confirms type/role |
| Reality First | Unknown stays blank; no invented Customer |
| Impact | Explain why create matters in one short line |

---

## UX Design

### Primary (before Yes)

```
SmartCRM
New relationship
[Name] · [email]
Company: [Matched Emko] | [Suggested Acme from domain]
[one-line why]

[ Yes — prepare create ]   [ No ]
```

### Confirm (after Yes)

- Role (required)
- Relationship type + industry (new company only)
- Optional: Connect thread → Opportunity | Project | None
- [ Create in SmartCRM ]

### Success

- Added to SmartCRM
- [ Open relationship card ]
- [ Create opportunity ] only if sell-to eligible

---

## Reality First Principle

- Do not invent contacts, companies, types, or opportunities.
- Domain match is a **proposal**, not an automatic link — user may Change / create new.
- Personal email domains (gmail, etc.) must not invent a corporate company from the domain alone without user confirmation of the company name.

---

## Persistence / Ownership Rules

| Entity | Owner store | Intake rule |
|--------|-------------|-------------|
| Contact | Contact Registry | Create only on approve |
| Company | Company Registry | Create only on approve; types required |
| Opportunity / Project links | Email intelligence / intentional tag | Optional; never invent new opportunity in intake Yes path |
| Stakeholders | Opportunity roster | Out of scope for intake v1 |

Single source of truth: no duplicate contact/company rows across JSON and Prisma when registry is available — prefer Prisma create paths.

---

## Acceptance Criteria

1. Unknown sender in Outlook shows Relationship Intake — not a dead end and not auto-create.
2. Existing company by domain → Yes adds contact to that company.
3. No company → Yes requires relationship type + industry before persist.
4. No CRM writes on No or on proposal load.
5. Optional opportunity/project link works when conversation context exists.
6. Create Opportunity CTA absent for Supplier / unclassified after create.
7. User never leaves Outlook to complete create + optional thread link.
8. Internal Standard Bio addresses never create a contact — Outlook treats them as users (Users & Access).

---

## Addendum — Compose Assign (hybrid)

When the user is **writing** a new mail in Outlook:

1. SmartCRM Compose pane (`?mode=compose`) resolves **To / Cc recipients** (not the mailbox owner).
2. Unknown recipient opens the **same FS-012 intake** with recipient-oriented copy (`variant=compose`).
3. After create, optional opportunity/project link uses an **outbound** seed (`isOutbound: true`, contact = recipient) via `saveAsync` when the draft lacks identity.
4. Known contact: Assign opportunity | project | relationship-only (posture-gated) — same commercial rules as read-mode Tag.
5. Prefer **decide-then-compose** from Opportunity / Relationship Card (“New mail in Outlook” / New tagged mail) when starting from CRM; Compose Assign covers “already writing.”

---

## Out of scope (v1)

- Autonomous background create from mail sync
- Merge duplicate wizard
- Auto-create opportunities or stakeholders
- Full HTML body persistence (FS-009 preview-only remains)
