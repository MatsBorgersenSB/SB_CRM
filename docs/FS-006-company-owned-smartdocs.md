# FS-006 Company-Owned SmartDocs

## Document Information

| Property | Value |
|----------|-------|
| Specification ID | FS-006 |
| Name | Company-Owned SmartDocs |
| Status | Draft / Phase 1 |
| Owner | SmartCRM |
| Category | Core Capability |
| Related | FS-003 Company Management · FS-005 Opportunity Workspace · AD-001 Filter Transparency |
| Governing Standards | SmartCRM Constitution · SmartAssist Constitution · SmartCRM North Star |

---

## Problem Statement

Supplier quotations, vendor datasheets, certificates, and other company knowledge often arrive **before** an opportunity exists — or remain useful **across** many opportunities and projects.

Today SmartDocs are effectively deal-scoped (`PL-…` identity, opportunity SharePoint folder, Company 360 Documents filtered by `pipelineIds`). That forces bad workarounds:

- Creating a **fake opportunity** just to file a Dorset quote
- Stuffing supplier quotations into deal commercial packages (PI / BQ ownership)
- Or leaving the file outside SmartCRM so knowledge cannot be reused

SmartCRM must treat the **Company** as a first-class SmartDoc owner so commercial and engineering teams can file, find, and reuse supplier knowledge without inventing deals.

---

## Business Goals

1. **Company owns knowledge** — Supplier and company documents live on the company, not on a fabricated deal.
2. **Reuse across commercial + engineering** — One Dorset quotation (e.g. S02325) can inform multiple opportunities and projects without duplication.
3. **SharePoint as document SoT** — Files land under `/Companies/{CompanyName}/Documents/…`.
4. **Clear identity** — Company-owned SmartDoc IDs use the **`CO-…`** prefix; **`PL-…`** remains only for true deal-outbound / opportunity-owned documents.
5. **Reality First** — Never invent opportunities, contacts, or suppliers to make filing work.
6. **Michelin UX** — Company 360 Documents Import works when the company has zero deals.

---

## Explicit Rejects

| Reject | Rationale |
|--------|-----------|
| Fake opportunities to host supplier docs | Violates Reality First; pollutes pipeline and forecasts |
| SharePoint root `/Suppliers/…` | Locked SoT is `/Companies/{Name}/Documents/…` — suppliers are companies |
| Stuffing SUQ into PI/BQ package ownership | Price Indication / Budget Quotation packages own Standard Bio outbound commercial sets — not external supplier quotes |
| Auto-creating Contacts / Companies / Relationships on import | SmartAssist recommends; user decides |

---

## User Stories

1. **As Mats (commercial)**, I upload Dorset quotation S02325 on DorsetGM’s Company 360 Documents tab without selecting or creating an opportunity, and SmartCRM registers it as a company-owned SmartDoc (`CO-…-S-SUQ-####`) with Origin = External.
2. **As an engineer**, I open Company 360 → Documents and find supplier quotations and datasheets for that company even when no deal is open.
3. **As a seller**, I later optionally link the same SmartDoc to an opportunity (Phase 2) without moving ownership off the company.
4. **As SmartAssist**, I classify dropped files (Commercial / Supplier Quotation / External) and propose identity + counterparty — Mats confirms before create.

---

## Functional Requirements

### FR-1 Ownership

- A SmartDoc **may** be owned by a **Company** without a DealId.
- For company-owned SmartDocs: **`OwnerCompanyId` is required**; **`DealId` is optional** (absent in Phase 1 create path).
- Opportunity and Project are **optional links**, not owners (Phase 2).
- Opportunity-owned SmartDocs keep **`PL-…`** identity and existing deal create/list APIs.

### FR-2 Identity

- Company-owned IDs: `{CompanyCode}-{CategoryCode}-{TypeCode}-{Sequence}`  
  Example: `CO-1009-S-SUQ-0001`
- Deal-owned IDs remain: `PL-####-…`
- Sequence is unique per owner code + category + type across the SmartDocs library.
- IDs are assigned automatically — never edited manually.

### FR-3 Classification (Dorset-style quotes)

Default / recommended for supplier quotations:

| Field | Value |
|-------|-------|
| DocCategory | Commercial |
| DocType | Supplier Quotation |
| Origin | external |
| Counterparty | Supplier display name when known (e.g. Dorset) |

### FR-4 Persistence / SharePoint

- SharePoint path SoT: `/Companies/{CompanyName}/Documents/…`
- SmartCRM stores library metadata (identity, classification, ownership, optional SharePoint URL/path).
- Binary upload to Graph under the company Documents folder mirrors the opportunity pattern when Graph is configured; otherwise metadata + local/document record path is acceptable with an explicit Graph ensure TODO.

### FR-5 APIs

- Company-scoped **list** and **create/register**: `/api/companies/[companyId]/smartdocs`
- Existing `/api/deals/[id]/smartdocs` remains for deal-owned docs (no breaking change).

### FR-6 Company 360 Documents

- Lists company-owned SmartDocs **and** documents from linked opportunities (`pipelineIds`).
- Import / register works when `pipelineIds` is empty.
- Does not invent a deal when none exists.

### FR-7 Filter Transparency (AD-001)

- When Documents filters hide rows, show filtered vs total counts and clear filters.

---

## SmartAssist Behaviour

- Observe filename / content signals before asking (e.g. quotation, tilbud, Dorset, S02325).
- Suggest Commercial / Supplier Quotation / Origin external for supplier quotes.
- Suggest Counterparty from company name or filename when confident.
- Never auto-create Companies, Contacts, Opportunities, or fake deals.
- Recommend linking to an open opportunity only when one already exists and the user asks (Phase 2).

**The system does the thinking. The user makes the decision.**

---

## UX Design

### Company 360 → Documents

1. **What am I looking at?** Company document workspace (not a CRM file dump).
2. **What matters?** Supplier quotes, certificates, and reusable company knowledge — plus deal docs when present.
3. **What next?** Import or create a company SmartDoc; open Document 360 for detail.

### Import (Michelin)

- Single Import flow; when no opportunity is selected / available, ownership = Company.
- Show preview SmartDoc ID (`CO-…`) before confirm.
- Do not require an opportunity picker when none exist.

### Information budget

- Browse table + one Import composition — no extra dashboard cards.

---

## Reality First Principle

- Unknown company → resolve or create company via FS-003 flows; do not invent.
- Unknown opportunity → leave DealId empty; do not fabricate PL- records.
- Partial metadata is allowed; Origin may be `unknown` until confirmed.
- Never invent people, relationships, or commercial package membership for SUQ.

---

## Persistence / Ownership Rules

| Concern | Owner |
|---------|--------|
| Company record | FS-003 Company Registry |
| Opportunity record | FS-005 Opportunity Workspace |
| Company-owned SmartDoc metadata | SmartDocs library (`OwnerCompanyId`, optional `DealId`) |
| File bytes | SharePoint `/Companies/{Name}/Documents/…` (SoT) |
| Commercial packages (PI/BQ/FQ) | Opportunity commercial sets — **not** SUQ ownership |

### Phase 1 fields

- `OwnerCompanyId` (required for company-owned)
- `DealId` optional / null for company-owned
- `Ownership`: `company` \| `opportunity`
- `SharePointFolderPath` / `SharePointWebUrl` when known
- `LinkedDealId` / `LinkedProjectId` — reserved (Phase 2; may exist as optional type stubs)

---

## Acceptance Criteria

### Phase 1

1. User can upload/register a SmartDoc owned by a company **without** DealId.
2. Company 360 Documents lists company-owned docs, not only `pipelineIds` deal docs.
3. Identity helper produces `CO-{code}-S-SUQ-####` (and peers) consistent with `smartdoc-identity.ts`.
4. Types require `OwnerCompanyId` for company-owned; `DealId` optional.
5. API: company-scoped create/list without breaking deal path.
6. SharePoint path fields ready for `/Companies/{Name}/Documents/`; Graph folder ensure may be TODO if heavy.
7. No fake deals created by the import path.
8. Company Documents Import works when the company has no deals.

### Phase 2 (deferred)

- Optional link company SmartDoc → Opportunity / Project without changing ownership
- Full Graph ensure + upload parity with opportunity folders
- Document 360 surfaces for multi-link reuse / engineering BOM context
- Cross-company supplier catalogue views

---

## Phase Boundaries

| Phase | Scope |
|-------|--------|
| **Phase 1** | FS, types, CO- identity, company create/list API, library persistence, Company 360 list + import without deal, SharePoint path fields + Graph TODO |
| **Phase 2** | Optional opportunity/project links, full Graph company Documents provision, richer reuse UX |

---

## Compliance Notes

- Aligns with North Star: what do we know (supplier quote), what next (reuse / link later).
- SmartAssist assists classification; user confirms.
- Single source of truth: Companies own company docs; Opportunities own deal-outbound docs.
|
