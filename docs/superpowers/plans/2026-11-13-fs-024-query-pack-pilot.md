# FS-024 Query Pack Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Antec Hornindal pilot slice: deal-scoped Query Pack, one Excel per company, import diff → propose/accept into `SourceFinding` / Understanding, one Mission Control strip — no portal, no Graph webhook.

**Architecture:** Pack metadata lives on `OpportunityUnderstandingCapture.queryPack` (reuses existing `understanding` JSON persistence — no parallel version store). Excel bytes are generated/parsed with JSZip (same pattern as contact spreadsheet). Accepted answers become `SourceFinding` (`kind: "document"`) claims; confirm reuses `applySourceFindingDecision`. SharePoint upload/share remains manual for v1 (download/upload in UI).

**Tech Stack:** TypeScript, React, JSZip, existing pipeline/understanding save paths, node:test

**Spec:** [docs/FS-024-opportunity-query-pack.md](../../FS-024-opportunity-query-pack.md)

## Global Constraints

- Reality First: parties only from opportunity `team` / company roster — never invent Antec/Vest Biogas contacts
- Isolation: one Excel per company; never hidden-row multi-party sheet
- SharePoint owns file revision history; SmartCRM stores URLs/version ids when known only
- No answer becomes Understanding without Accept/confirm
- Import requires `QuestionId`; unmatched rows → review queue
- Michelin: one Mission Control strip; full list collapsed
- v1 freeze: manual export/import only — no portal, no Graph webhook
- Do not commit unless the user asks

## Review Focus

- Missing `QuestionId` on import must never auto-match by question text
- Export for company A must never include company B rows
- Accept without `fieldId` still creates confirmed knowledge claim (no invented field mapping)
- Regenerating recipient file after master edit is a new send — do not merge foreign answers
- Antec seed assigns only when roster company id is provided by caller — seed alone does not create companies

---

### Task 1: Query Pack types + pure domain logic

**Files:**
- Create: `src/types/query-pack.ts`
- Create: `src/lib/query-pack.ts`
- Create: `src/lib/query-pack.test.ts`
- Modify: `src/types/opportunity-understanding.ts` — add optional `queryPack?: QueryPack`

**Interfaces:**
- Produces: `QueryPack`, `QueryPosition`, `createQueryPack`, `antecHornindalSeedPositions`, `assignPositionCompany`, `rowsForCompanyExport`, `diffImportAnswers`, `acceptAnswerProposals` → `{ pack, finding }`

- [ ] **Step 1: Write failing tests** in `src/lib/query-pack.test.ts` for: create pack; Antec seed ids `ANTEC-SEED-01`…`05`; export filters by `companyId`; import without QuestionId → unmatched; accept builds `SourceFinding` kind document with optional fieldId

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx tsx --test src/lib/query-pack.test.ts`

- [ ] **Step 3: Implement types + domain** in `src/types/query-pack.ts` and `src/lib/query-pack.ts`; extend `OpportunityUnderstandingCapture`

- [ ] **Step 4: Run tests — expect PASS**

---

### Task 2: Excel export / import (JSZip)

**Files:**
- Create: `src/lib/query-pack-excel.ts`
- Create: `src/lib/query-pack-excel.test.ts`
- Reuse parse patterns from: `src/lib/contact-spreadsheet.ts`

**Interfaces:**
- Consumes: `QueryPosition[]`, pack ids
- Produces: `buildQueryPackXlsx(positions, meta) => Promise<Uint8Array>`, `parseQueryPackXlsx(buffer) => { matched, unmatched }`

- [ ] **Step 1: Write failing round-trip test** (build → parse preserves QuestionId/Answer)

- [ ] **Step 2: Implement minimal OOXML sheet via JSZip** (sharedStrings + sheet1); columns per FS-024 §4.4 including hidden CompanyId/PackId

- [ ] **Step 3: Run tests — expect PASS**

---

### Task 3: Wire accept into findings on understanding save path

**Files:**
- Modify: `src/lib/query-pack.ts` — `acceptAnswerProposals` merges finding into `findings[]` and updates pack position status
- Test: extend `src/lib/query-pack.test.ts`

**Interfaces:**
- Produces: `mergeAcceptedQueryPackFinding(understanding, proposals) => OpportunityUnderstandingCapture`

- [ ] **Step 1: Test** accept updates position to `answered`, appends finding with provenance note, claim impact non-empty

- [ ] **Step 2: Implement merge helper**

- [ ] **Step 3: Run tests — expect PASS**

---

### Task 4: Mission Control strip + Actions panel (pilot UI)

**Files:**
- Create: `src/components/opportunity/query-pack-strip.tsx`
- Create: `src/components/opportunity/query-pack-panel.tsx`
- Modify: `src/components/opportunity/opportunity-mission-control.tsx` — render strip on Overview; panel entry from Actions or strip CTA
- Modify: deal save path already used by `onSaveFindings` / understanding — panel calls parent save with updated `understanding.queryPack` + findings

**Interfaces:**
- Consumes: `pipeline.understanding`, roster companies from deal team, `onSaveUnderstanding` callback
- UX copy: “Questions for this deal”; “Send to {Company}”; “What changed in their answers?”

- [ ] **Step 1: Strip shows** title, status, waiting-on companies, CTA Create / Import / Review
- [ ] **Step 2: Panel** create with Antec seed (optional), assign company from roster only, download per-company xlsx, upload returned file, show diff + Accept/Dismiss
- [ ] **Step 3: Manual smoke** on opportunity page (or component test if present)

---

### Task 5: Antec Hornindal pilot execution harness

**Files:**
- Create: `src/lib/query-pack-antec-pilot.test.ts` — end-to-end pure simulation (no invented parties: caller supplies companyId string fixture labeled as roster id)
- Modify: `docs/FS-024-opportunity-query-pack.md` §9 — add **Pilot runbook checklist** with pass/fail boxes for live M365 run

- [ ] **Step 1: Automated pilot test** — seed → assign companyId `roster-vest` → export → simulate answers → import → accept → finding confirmed path
- [ ] **Step 2: Document live runbook** steps for opening real Antec opportunity when present in tenant data
- [ ] **Step 3: Run** `npx tsx --test src/lib/query-pack*.test.ts` — all PASS

---

## Done when

- FS-024 Approved — Pilot hardenings present
- Domain + excel + accept tests green
- Mission Control strip + panel usable for manual export/import
- Antec seed + pilot simulation test green; live SharePoint share remains operator step per runbook
