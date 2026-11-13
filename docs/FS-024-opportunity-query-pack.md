# FS-024 – Opportunity / Project Query Pack (SharePoint Excel)

## Document Information

| Property | Value |
|----------|-------|
| Specification ID | FS-024 |
| Title | Opportunity / Project Query Pack (SharePoint Excel) |
| Status | Approved — Pilot |
| Priority | High |
| Category | Opportunity & Project Knowledge |
| Version | 0.2 |
| Pilot | Antec Hornindal (Vest Biogas) — BOO deal model (FS-005B §4.3) |
| Related | FS-005 Opportunity Workspace · FS-005B BOO Deal Model · FS-001 Opportunity Stakeholders · FS-015 Project Relationships · FS-006 Company-Owned SmartDocs · FS-021 AI Knowledge Layer |
| Governing standards | SmartCRM Constitution · SmartAssist Constitution · SmartCRM North Star · Reality First · Michelin / Apple / 3-Second |

---

## 1. Problem Statement

Commercial and technical questions on multi-party opportunities and projects are scattered across email threads and ad-hoc files. External companies must not see each other’s questions. Answers that do come back often stay in attachments and never become deal knowledge — so Mission Control cannot answer *what we know / don’t know / what next*.

A custom external Q&A portal is heavy. SharePoint already provides document storage, sharing, and **revision control**. SmartCRM should orchestrate query packs and turn **accepted** answers into Understanding — not reinvent Excel or version history.

---

## 2. Business Goals

1. Create **one Query Pack per Opportunity or Project**.
2. Relate the pack to **real companies (and contacts) on the roster** — never invent parties.
3. Distribute **one Excel file per recipient company** so each party only sees positions assigned to them.
4. Keep **revision control in SharePoint** (file version history).
5. When answers return, **propose → user approves → land as deal/project knowledge** (Understanding / facts), with provenance.
6. Pass the 3-second test on the deal: what was asked, what is waiting, what was learned, what is still unknown.
7. Pilot on **Antec Hornindal** before generalising.

---

## 3. User Stories

| ID | As a… | I want to… | So that… |
|----|-------|------------|----------|
| US-01 | Seller / PM | Create a Query Pack on an opportunity or project | Commercial and technical questions live in one place for that deal |
| US-02 | Seller / PM | Assign each position to a company (and optional contact) from the roster | Distribution matches who is actually involved |
| US-03 | Seller / PM | Export / generate one Excel per company into SharePoint | Each party only receives their questions |
| US-04 | External contact | Open and answer only my company’s Excel via SharePoint / email | I never see other companies’ questions or other deals |
| US-05 | Seller / PM | Import a returned Excel and see a clear diff | I know what changed without re-reading the whole sheet |
| US-06 | Seller / PM | Accept, edit, or dismiss each proposed answer update | Nothing becomes deal fact without my decision |
| US-07 | Seller / PM | See pack status on Mission Control (sent / waiting / returned / imported) | I know what deserves attention next |
| US-08 | SmartAssist | Surface unanswered commercial/technical gaps from the pack | Next best action is grounded in real unknowns |

---

## 4. Functional Requirements

### 4.1 Query Pack (deal-scoped)

- One active Query Pack identity per Opportunity **or** Project (multiple packs over time allowed as revisions of intent; v1: one **current** pack plus SharePoint file versions).
- Pack metadata (SmartCRM): `packId`, scope (`opportunityId` \| `projectId`), title, status, SharePoint folder / master file URL, created/updated, owner.
- Status values: `draft` → `sent` → `partially_returned` → `returned` → `imported` (and `closed`).
- Positions (questions) have: stable `questionId`, type (`commercial` \| `technical`), text, optional category/pillar hint, assignee `companyId` (required for distribution), optional `contactId`, status (`open` \| `answered` \| `waived`), answer text (after accept), provenance.

### 4.2 Parties — Reality First

- Companies and contacts come **only** from the opportunity stakeholder roster / project related organizations (FS-001 / FS-015).
- No auto-create of companies or contacts when building or importing a pack.
- Unassigned positions stay internal-only (not exported to any external Excel).

### 4.3 SharePoint Excel — distribution & isolation

- **Master** workbook (internal): all positions for the pack. Lives under the opportunity/project SharePoint path (or company Documents when company-owned filing applies — prefer deal/project folder for pack master).
- **Recipient export**: one `.xlsx` per assigned company, containing **only** that company’s rows.
- Isolation is **file-based** — never one shared sheet with hidden rows for other parties.
- Sharing uses existing SharePoint / Outlook practices (link or attachment). SmartCRM does **not** require an external SmartCRM login.
- SharePoint **version history** is the revision SoT for each file. SmartCRM does not duplicate a second version store.

### 4.4 Excel template — professional Q&A register (always included)

Recipient-facing sheet name: **Q&A**. Every export includes these columns (industry RFI / clarification-register practice):

| Column | Required | Notes |
|--------|----------|-------|
| `Q&A Ref` | Yes | Unique ref (same value as `QuestionId`) — never reuse |
| `Discipline` | Yes | Commercial or Technical |
| `Question` | Yes | One clear question (plain language) |
| `Issued To (Company)` | Yes | Recipient company display name |
| `Issued To (Contact)` | No | Named contact when assigned |
| `Date Issued` | Yes | Date the Excel was issued |
| `Response Required By` | No | Filled by issuer before send when a deadline applies |
| `Status` | Yes | Open / Answered / Closed — N/A |
| `Answer` | Yes | Empty when sent; filled by recipient |
| `Answered By` | No | Filled by recipient |
| `Date Answered` | No | Filled by recipient |
| `Clarification / Comment` | No | Extra notes either side |
| `References / Attachments` | No | Links / document refs attached to the question |
| `Project / Opportunity` | Yes | Scope title for audit trail |

System columns (keep for import; do not delete): `QuestionId`, `CompanyId`, `ContactId`, `PackId`, `ScopeId`.

### 4.5 Import → propose → approve → knowledge

1. User attaches or selects the returned Excel (or SharePoint file) for a recipient company.
2. **Import safety:** Every data row **must** include `QuestionId`. Rows without `QuestionId` are rejected from auto-match and placed in an **unmatched review queue**. SmartCRM never silently maps by question text alone. Field mappings (`UnderstandingFieldId`) are never invented — only applied when the position already carries an optional pillar/field hint or the user chooses one on Accept.
3. SmartCRM matches rows by `QuestionId` (+ pack scope).
4. Diff proposes updates: new/changed `Answer` / `Comment` only — never invent missing answers.
5. User **Accept / Edit / Dismiss** each proposal (same posture as FS-014 / FS-021 proposals).
6. Accepted answers:
   - Update the pack position (`answered` + answer text + provenance).
   - **Knowledge landing path:** Create a `SourceFinding` with `kind: "document"` (title cites pack + company + file). Each accepted answer becomes a `SourceFindingClaim` (statement = answer prose, impact required). Optional `fieldId` when mapped; confirm uses the existing findings confirm flow so Understanding fields write only on confirm. Unmapped answers remain confirmed knowledge claims without a field write.
7. Provenance on every accepted fact: pack id, company, SharePoint item / version (when known), import timestamp — stored on the finding title/note and pack position.
8. Unanswered positions remain explicit **Unknowns** for SmartAssist.

### 4.5A Pilot operating rule (SharePoint versions)

- Prefer **edit in SharePoint** (co-author) or **replace file / upload as new version** on the same SharePoint item so revision history stays coherent.
- Email return is allowed for the pilot: the returned attachment **must be re-uploaded** to the same SharePoint recipient item when possible before import.
- SmartCRM import always targets a **chosen file** (upload or SharePoint URL) and stores SharePoint item id / version id when known. SmartCRM does **not** keep a parallel version table.

### 4.5B Master vs recipient drift

- Adding questions to the master after a send requires **regenerating** that company’s recipient Excel and treating it as a new send.
- Never merge Company B’s answers into Company A’s file.
- Isolation remains file-based for every send.

### 4.6 Mission Control (Michelin)

Above the fold for the pack strip (or single block on Overview / Actions — not a dashboard sprawl):

1. What am I looking at? — Query Pack title + commercial/technical mix  
2. What matters? — waiting on whom; newly returned; open unknowns that block progress  
3. What next? — send / chase / import / review proposals  

Expert detail (full position list, file links, version notes) behind expand.

### 4.7 Out of scope / v1 scope freeze (pilot)

**In scope (v1):** Manual export per company, manual import of returned Excel, propose/accept UI into `SourceFinding` → Understanding, one Mission Control strip, SharePoint as file + version SoT.

**Out of scope (v1 / pilot):**

- External SmartCRM portal or magic-link answer UI  
- Auto-writing Understanding without user approval  
- One Excel shared with multiple external companies  
- Inventing Antec / Vest Biogas / other parties not already on the roster  
- Live co-authoring UX beyond SharePoint’s own behaviour  
- Automatic Graph webhook / sync of every SharePoint version  
- Multi-pack versioning UI inside SmartCRM (SharePoint versions only)  
- Auto-propose question libraries beyond the Antec seed list (user may edit/add)

---

## 5. SmartAssist Behaviour

- Observe roster and existing Understanding / unknowns before proposing questions.
- Prefer **knowledge before questions**: do not ask externally what SmartCRM already knows with high confidence.
- Propose commercial vs technical split and assignee company from posture (sell-to / collaborate / buy-from) — user decides.
- After import: recommend which accepted answers update which Understanding fields; user confirms.
- Never invent people, companies, relationships, or answers.
- System thinks; user decides.

---

## 6. UX Design

### 6.1 Opportunity / Project workspace

- Entry: Actions (or Overview secondary) — **Query Pack**.
- States: empty → create pack; draft → assign & export; sent → waiting; returned → import & review.
- Review UI: proposal list (Accept / Edit / Dismiss), not a CRM table dump.

### 6.2 Apple / 12-year-old rules

- “Questions for this deal” — not “RFQ module / questionnaire entity.”
- “Send to Company A” — not “provision external principal.”
- “What changed in their answers?” — not “merge spreadsheet delta pipeline.”

---

## 7. Reality First Principle

- Parties only from existing opportunity/project relationships.
- Answers only from returned file content or explicit user edit.
- Unknown stays unknown until accepted evidence exists.
- Pilot references **Antec Hornindal** as stated in FS-005B; this FS does not invent additional facts, contacts, or companies for that case.

---

## 8. Persistence / Ownership Rules

| Asset | Owner / SoT |
|-------|-------------|
| Pack metadata + position answers (accepted) | SmartCRM (deal/project scoped) |
| Excel bytes + revision history | SharePoint |
| Understanding / findings after accept | Opportunity / Project Understanding (existing engines) |
| Companies / Contacts | Existing registries — pack only references IDs |

Single source of truth: do not duplicate company/contact records into the pack.

---

## 9. Pilot — Antec Hornindal

**Purpose:** Validate the stupid-simple loop on a real multi-party BOO opportunity.

### 9.1 Antec question seed (documented unknowns only — FS-005B §4.3)

SmartAssist / pack create may **pre-fill** these positions. The user edits, assigns to roster companies only, and sends. Never invent answers or parties. Seed only what FS-005B already states as unknown / to be confirmed:

| SeedId | Type | Suggested field hint | Question (plain language) |
|--------|------|----------------------|---------------------------|
| ANTEC-SEED-01 | commercial | `site_readiness` | Land plot next to Vest Biogas (~80×120 m²): will terms be rent/lease or ownership, and what terms apply? |
| ANTEC-SEED-02 | technical | `utilities` | Utility capacity and thermal heat exchange tie-in terms with Vest Biogas — what is confirmed and what must still be secured? |
| ANTEC-SEED-03 | commercial | `offtake_strategy` | Surplus thermal heat offtake (~7–8 GWh/year): energy form (steam / hot water / temperature), volume (MWh/year), and price terms? |
| ANTEC-SEED-04 | commercial | `offtake_strategy` / option | Will Vest Biogas also want Standard Bio to pyrolyse/treat dried digestate, or is that still undecided? |
| ANTEC-SEED-05 | commercial | `end_product` | (Internal / other offtaker when on roster) Biochar product offtake: buyers, specification, volume, pricing, carbon credits — what is known vs open? |

Assign seed rows only when a matching **roster** company exists for that question. Rows without an assignee stay internal-only.

### 9.2 Setup (manual / assisted, no invented parties)

**Stay on the project page** (12-year-old path — no Opportunity hop):

1. Open **Antec - Hornindal** project (`/projects/PRJ-ANTEC-HORNINDAL`) → **Overview**.
2. Orange block **Ask the companies** → **Start asking** → **Start with Antec questions**.
3. Assign each question to a company already on Related organizations.
4. **Download their Excel** → upload via **OPEN SHAREPOINT FOLDER** (recipient file).
5. Share that **recipient file URL only** (not a master sheet). Prefer SharePoint co-edit or new version on return (§4.5A).
6. **Bring answers back** → review → **Save answers to the project**.
7. Confirm the orange block shows waiting vs answers brought back.

(Opportunity Overview has the same **Ask the companies** strip if you work from the deal.)

### 9.3 Pilot success

- Isolation: Company A’s file never contains Company B’s rows.  
- Revision: SharePoint versions cover edits without a CRM version table.  
- Knowledge: at least one accepted answer visible as deal Understanding or confirmed finding with provenance.  
- Import safety: rows missing `QuestionId` appear in unmatched review — never silent map.  
- No new company/contact created by the pack flow.

### 9.4 Live M365 runbook checklist (Antec Hornindal)

Automated simulation: `npx tsx --test src/lib/query-pack-antec-pilot.test.ts` (fixture roster id only — does not invent CRM parties).

Live tenant (operator):

| Step | Action | Pass |
|------|--------|------|
| 1 | Stay on **Antec - Hornindal project** Overview (do not invent companies/contacts) | [ ] |
| 2 | Orange **Ask the companies** → **Start asking** → **Start with Antec questions** | [ ] |
| 3 | Assign questions only to Related organizations already on the project | [ ] |
| 4 | **Download their Excel** → upload via **OPEN SHAREPOINT FOLDER** as recipient file | [ ] |
| 5 | Share **recipient file URL only** (not master) with the contact | [ ] |
| 6 | Prefer SharePoint co-edit; if emailed back, re-upload as new version on same item | [ ] |
| 7 | **Bring answers back** → review → **Save answers to the project** | [ ] |
| 8 | Confirm finding appears; confirm claims in Understanding as needed | [ ] |
| 9 | Confirm unmatched rows (if any) stayed in review queue | [ ] |
| 10 | Confirm no new company/contact was created by the pack flow | [ ] |

---

## 10. Acceptance Criteria

| ID | Criterion |
|----|-----------|
| AC-01 | User can create one Query Pack on an opportunity or project |
| AC-02 | Positions assign only to roster companies/contacts |
| AC-03 | Export produces one Excel per company with only that company’s questions |
| AC-04 | Master + recipient files land in SharePoint; version history remains SharePoint’s |
| AC-05 | Import matches by `QuestionId` and shows a diff of answer changes |
| AC-06 | No answer becomes Understanding/fact without Accept (or explicit Edit+Accept) |
| AC-07 | Accepted answers carry provenance (pack, company, file/version when known) |
| AC-08 | Unanswered positions remain visible as unknowns for attention / NBA |
| AC-09 | Client/external users are not required to log into SmartCRM |
| AC-10 | Pilot completable on Antec Hornindal without inventing parties |
| AC-11 | Accepted answers land as `SourceFinding` (`kind: "document"`) claims; Understanding field write only on confirm with optional `fieldId` |
| AC-12 | Import without `QuestionId` never auto-matches; unmatched rows go to review queue |
| AC-13 | Pack UI shows which company has which recipient file URL (share the file, not the master) |

---

## 11. Consequences

**Enables:** Multi-party commercial/technical clarification with SharePoint-grade sharing and revision control; deal knowledge that stays alive after import.

**Avoids:** External portal build; duplicate CRM versioning; hidden-row “security.”

**Follow-ons (not v1):** Auto-propose questions from BOO pillar gaps; Graph webhook when SharePoint file changes; project-scoped packs parity polish; template library by deal model (`boo` vs sales).
