# SmartCRM Constitutional Compliance Audit

| Field | Value |
| :--- | :--- |
| **Audit date** | 2026-07-17 |
| **Scope** | `src/`, `prisma/`, `docs/` (read-only; no application code modified) |
| **Governing standards** | SmartCRM Constitution v6.0 (Strategic IP Edition) · `docs/governance/SMARTCRM_PRINCIPLES.md` · AD-001 · FS-001–FS-009 |
| **Focus principles** | AD-001 Filter Transparency · Reality First & User Sovereignty · 4-Part Explainability · Security & Encryption / M365 privacy / domain boundaries |
| **Overall verdict** | **Strong on sovereignty & encryption foundations; partial on explainability consistency and M365 privacy defaults** |

---

## 1. Audit method

1. Read AD-001 (`docs/architecture/AD-001-filter-transparency.md`), principles (`docs/governance/SMARTCRM_PRINCIPLES.md`), and feature specs under `docs/specifications/` (FS-008, FS-009) plus FS-005 explainability FR-015/FR-016.
2. Scanned UI shells, deal intelligence surfaces, SmartAssist panels, Prisma schema, and API route handlers for filter bars, propose/approve gates, 4-part insight fields, AES token handling, domain rules, and tombstone/purge paths.
3. Classified findings as **fully compliant**, **minor gaps** (with paths/lines), or **recommended non-destructive refactors**.

---

## 2. Principle scorecards

| Principle | Score | Summary |
| :--- | :---: | :--- |
| **AD-001 Filter Transparency** | **Mostly compliant** | Live primary workspaces use `FilterTransparencyBar` / `FilterToolbar`. Gaps on `/deals` role-scoped count and a few edge/dormant surfaces. |
| **Reality First & User Sovereignty** | **Strongly compliant** | Commitments, influence stance, Co-Pilot, purge, and drafts are user-gated. Sentiment does not auto-write stance. |
| **4-Part Explainability** | **Partial** | Schema + Business Impact / Qualification / some briefings align; Gaps UI, CVM, and in-memory insight catalogs omit the full quartet. `OpportunityInsight` is unused at runtime. |
| **Security & Encryption / M365 privacy** | **Partial–strong** | AES-256-GCM for OAuth tokens, preview-only bodies, cron auth, and domain helpers are solid. Internal-only default exclusion and tombstone sync wiring are incomplete. |

---

## 3. Fully Compliant Modules

### 3.1 AD-001 — Filter Transparency

| Module | Evidence |
| :--- | :--- |
| Canonical bar | `src/components/ui/filter-transparency-bar.tsx` — Showing X of Y, chips, Clear All |
| Filter toolbar composition | `src/components/ui/filter-toolbar.tsx` (~289–349) via `buildActiveFilterChips` |
| Companies (`/companies`) | `src/components/layout/companies-operations-shell.tsx` (~287–302) |
| Contacts | `src/components/layout/contacts-shell.tsx` (~304–320) |
| Opportunities | `src/components/layout/opportunities-operations-shell.tsx` (~237–252) |
| Activities (page) | `src/components/activities/activity-work-management-workspace.tsx` (~148–161) |
| Activities (embedded 360) | `src/components/activities/smart-activity-workspace.tsx` (~375–391) |
| Influence Map | `src/components/opportunities/influence-matrix.tsx` (~283–295) |
| Meetings | `src/components/opportunities/meeting-intelligence.tsx` (~276–288) |
| Emails | `src/components/opportunities/email-intelligence.tsx` (~396–410) |
| Universal search (with hits) | `src/components/search/universal-search-dialog.tsx` (~383–402) |
| Intelligence Center | `src/components/layout/intelligence-center-shell.tsx` (~132–137) |
| Knowledge / SmartDocs | `src/components/layout/knowledge-shell.tsx` (~246–261) |
| Documents panel | `src/components/documents/workspace-documents-panel.tsx` (~245–264) |
| Projects | `src/components/layout/projects-operations-shell.tsx` (~134–146) |

### 3.2 Reality First & User Sovereignty

| Module | Evidence |
| :--- | :--- |
| Meeting commitments (Confirm / Dismiss) | `meeting-intelligence.tsx` (~193–233, ~438–455); `PATCH` only in `src/app/api/opportunities/[id]/meetings/route.ts` (~55–110); FS-008 §2 |
| Influence stance (user-only writes) | `influence-matrix.tsx` (~201–229, ~408–431); `src/app/api/opportunities/[id]/influence/route.ts` (~133–227). No sentiment→stance write path in `src/` |
| Email sentiment advisory | Explicit copy at `email-intelligence.tsx` L331; sentiment stored/displayed only |
| Email purge (user-confirmed) | `email-intelligence.tsx` (~277–282); `DELETE` `src/app/api/opportunities/[id]/emails/route.ts` (~63–93); FS-009 §2.6 |
| Outlook draft (user-initiated) | `POST /api/m365/draft` + `DraftInOutlookButton` — no silent send |
| SmartAssist Co-Pilot | Propose → Approve/Dismiss: `smart-assist-copilot-view.tsx` (~45–66, ~87–105); persist only in `smartassist-copilot-executor.ts` (~45–98) |
| Workspace Architect | Approve before apply: `workspace-architect-shell.tsx` (~32, ~125–140) |
| Principles alignment | `docs/governance/SMARTCRM_PRINCIPLES.md` — “SmartAssist suggests. Users approve.” |

### 3.3 4-Part Explainability (where implemented)

| Module | Evidence |
| :--- | :--- |
| Prisma 4-part model | `prisma/schema.prisma` `OpportunityInsight` L272–285 (`observation`, `reasoning`, `recommendation`, `expectedOutcome`) |
| Business Impact (full mode) | `business-impact-card.tsx` + `smart-assist-business-impact.ts` — Situation / Impact / Recommended Action / Expected Outcome |
| Opportunity Qualification | `opportunity-qualification-panel.tsx` (~92–104) — includes Expected outcome |
| Activity action recommendations | `activity-action-recommendations.ts` / UI — reason + expectedOutcome |
| Email assistant briefing | `smartassist-email.ts` + `smartassist-email-assistant.tsx` — includes expected outcome |

### 3.4 Security, encryption, M365 privacy foundations

| Module | Evidence |
| :--- | :--- |
| AES-256-GCM token crypto | `src/lib/encryption.ts` L3–6, L38–54, L60–81; production fail-closed without `TOKEN_ENCRYPTION_SECRET` (L18–22) |
| Encrypt on write / decrypt on read | `src/lib/m365-client.ts` upsert (~302–325); token getters (~347–399) |
| Preview-only mail storage | `schema.prisma` `bodyPreview` only (~482); Graph `$select` includes `bodyPreview` not full `body` (`m365-client.ts` ~254–256); aligns FS-009 §2.1 / FR-009-07 |
| Cron auth | `src/app/api/cron/m365-renew-subscriptions/route.ts` — `CRON_SECRET` required (Bearer / `x-cron-secret`); fail closed if unset |
| Domain boundary helpers | `src/lib/domain-rules.ts` (`INTERNAL_DOMAINS`, exact + subdomain); wired in `email-intelligence-data.ts` (~117–127) and `meeting-intelligence-data.ts` (~120–127) |
| Soft tombstone helper + purge sovereignty | `email-intelligence-data.ts` (~272–307); UI badge/filter for deleted; never auto-purge |
| Schema token documentation | `ExternalIntegration.accessToken` / `refreshToken` comments — AES-256-GCM (`schema.prisma` ~545–546) |

---

## 4. Minor Compliance Gaps

> Line numbers are approximate snapshots as of audit date; prefer symbol/context if files drift.

### 4.1 AD-001 Filter Transparency

| Severity | Gap | Location | Detail |
| :--- | :--- | :--- | :--- |
| ⚠️ Live | `/deals` portfolio count without X of Y | `src/components/layout/app-shell.tsx` **L122–126**, **L136–142** | Role-scoped `visiblePipelines` shows a bare count badge (`{visiblePipelines.length}`), not `Showing {filtered} of {total} Deals`. No `FilterTransparencyBar`. |
| ⚠️ Edge | Ask-mode zero results hide bar | `src/components/search/universal-search-dialog.tsx` **~394–402** | When ask returns zero items, active Search constraint may omit X of Y / chip while query still constrains. |
| ⚠️ Dormant | Non-compliant company directory | `src/components/companies/company-directory.tsx` **~121–234**; mounted by unused `companies-shell.tsx` **~100** | Counts only when filters active; health/industry live in `<select>`s without chips; not on live `/companies` (operations shell is compliant). |
| ⚠️ Dormant | Legacy activity filters | `src/components/activities/activity-filters.tsx` (full file) | No transparency bar; unused today — risk if re-mounted. |

### 4.2 Reality First & User Sovereignty

| Severity | Gap | Location | Detail |
| :--- | :--- | :--- | :--- |
| ⚠️ Soft | Proposed commitments pre-persisted | Seed / `meetingCommitmentRecord` (`prisma/seed.ts` ~320–397) | FS-008 requires no persistence without confirmation. `status: "proposed"` is the intentional propose pattern but is still a DB write before Confirm. UX treats Confirm as the commercial commitment. |
| ⚠️ Spec ahead of code | No runtime meeting→commitment extractor | `src/` (search) | Only seed creates proposed commitments; sync→propose pipeline not found beyond read/PATCH. |
| ⚠️ Soft | Activity Close is one-click | `activity-action-recommendations.tsx` **~71–78** | Explicit user click completes activity without Confirm/Dismiss second step (weaker than meeting commitment pattern). |

### 4.3 4-Part Explainability

| Severity | Gap | Location | Detail |
| :--- | :--- | :--- | :--- |
| ⚠️ Structural | `OpportunityInsight` unused at runtime | `prisma/schema.prisma` L272–285; no `prisma.opportunityInsight` usage in `src/` | Canonical 4-part model exists in schema but is not created/read by app code. Insights live in-memory (`smartassist-intelligence-layer.ts`, `types/smartassist-intelligence.ts`) without Observation/Reasoning/Recommendation/Expected Outcome. |
| ⚠️ Partial | Knowledge Gaps UI | `opportunity-workspace-intelligence.ts` `CriticalKnowledgeGap` **~37–45**; `opportunity-knowledge-view.tsx` **~82–84** | Has missingInformation / whyItMatters / recommendedAction — **no Expected Outcome**; labels ≠ Observation/Reasoning. |
| ⚠️ Partial | Mission Control Overview | `opportunity-mission-control.tsx` **~160–170** | Want / block / next — not 4-part FR-015 structure. |
| ⚠️ Partial | NextBestAction type | `opportunity-workspace-intelligence.ts` **~67–71** | `action` / `why` / `expectedImpact` — close, missing Observation; naming differs. |
| ⚠️ Partial | Commercial Viability / Coach | `CommercialViabilityAction` **~120–125**; `smart-assist-coach-view.tsx` **~125–133+** | Recommendation + reason/summary; no structured Observation/Reasoning/Expected Outcome. |
| ⚠️ Partial | Assistant recommendation card | `assistant-recommendation-card.tsx` **~44–47** | Why / Impact / Recommended action — **no Expected Outcome**. |
| ⚠️ Soft | Business Impact compact mode | `business-impact-card.tsx` **~30–37** | Drops Situation & Expected Outcome (Impact + Action only). |
| ⚠️ Soft | Growth card confidence % | `growth-recommendation-card.tsx` **~18–19** | Surfaces engine confidence in primary UI (north-star prefers hiding internals). |

### 4.4 Security, encryption, M365 privacy & domains

| Severity | Gap | Location | Detail |
| :--- | :--- | :--- | :--- |
| ⚠️ Spec gap (FS-009) | Internal-only not excluded **by default** | `email-intelligence.tsx` **L161–163**, **L223–224**; emails API returns all | Default `domainFilter = "all"`. Spec: internal-only mail excluded from external deal intelligence by default. Classification flags exist; default UX/API do not hide internal-only. |
| ⚠️ Spec gap (FS-008) | Meetings lack internal-only default exclusion | `meeting-intelligence-data.ts` (~120–127) | Participant `isExternal` badges exist; no meeting-level internal-only default filter. |
| ⚠️ Incomplete | Tombstone helper unused by sync | `email-intelligence-data.ts` **L275–286**; re-export `prisma-data.ts` **L98** | `markEmailDeletedInSource` never called from delta/webhook paths — Outlook `@removed` → tombstone not wired. |
| ⚠️ Incomplete | Mail delta ingest not persisted | `m365-client.ts` `fetchMailDelta` **~250–268** | Function exists; no caller persists delta → `EmailMessageRecord`. |
| ⚠️ Soft | Legacy plaintext decrypt passthrough | `encryption.ts` **L62–64** | Non-`enc:v1:` values returned unchanged (migration-friendly; allows unencrypted rows). |
| ⚠️ Soft | Dev encryption fallback key | `encryption.ts` **L24–27** | Deterministic local-only key when secret unset (production throws — OK). |
| ⚠️ Soft | Cron secret compare not constant-time | `m365-renew-subscriptions/route.ts` **~29** | `!==` vs `crypto.timingSafeEqual`. |
| ⚠️ Soft | `deltaSyncToken` stored plaintext | `schema.prisma` **~548** | Graph delta links can be sensitive; not AES-wrapped like OAuth tokens. |
| ⚠️ Soft | Outlook body debug logging | `outlook-import-diagnostics.ts` **~5–15**; `outlook-message-body.ts` **~80–82** | Can log RAW body/signature when debug or non-production. |
| ⚠️ Soft | SharePoint env access token | Graph SharePoint path via `MICROSOFT_GRAPH_ACCESS_TOKEN` (env plaintext) | Outside `ExternalIntegration` AES store — separate risk class. |
| ⚠️ Soft | Attachment bytes at rest | `DocumentRecord.contentBase64` (`schema.prisma` ~512) | Intentional for commercial attachments; not email body, but unencrypted at rest. |

---

## 5. Recommended Refactors (non-destructive)

These preserve working behavior; prefer additive UI defaults, wrappers, and wiring over rewrites.

### 5.1 AD-001

1. **`/deals` AppShell** — Wrap portfolio list with `FilterTransparencyBar` using role-scoped total vs visible count (even when user filters are absent), e.g. `Showing {visible} of {portfolioTotal} Deals` when role scope shrinks the set (`app-shell.tsx` ~122–142).
2. **Universal search ask empty state** — Always render the transparency bar when a query string is non-empty, including zero-result ask (`universal-search-dialog.tsx` ~394–402).
3. **Dormant cleanup (optional)** — Either retire `company-directory.tsx` / `activity-filters.tsx` behind a deprecation comment or migrate them onto `FilterToolbar` before any route remounts them.

### 5.2 Reality First & sovereignty

4. **Meeting commitment pipeline** — When extractor lands: write only `status: "proposed"` (or ephemeral proposals) and keep Confirm/Dismiss as sole path to `confirmed` / activity creation (already the UI contract).
5. **Activity Close** — Optional second confirm or undo toast for high-impact completions to match commitment UX (`activity-action-recommendations.tsx`).

### 5.3 4-Part Explainability

6. **Wire `OpportunityInsight`** — Persist SmartAssist deal insights through Prisma fields (`observation`, `reasoning`, `recommendation`, `expectedOutcome`) and render a shared `ExplainabilityBlock` component.
7. **Normalize Gaps / NBA / CVM cards** — Map existing copy into the four labels (or alias Situation→Observation, Impact→Reasoning) and add **Expected Outcome** where missing (`opportunity-knowledge-view.tsx`, coach/CVM, `assistant-recommendation-card.tsx`).
8. **Compact Business Impact** — Keep compact mode but expose a “Why / Expected outcome” expand so FR-015 is never silently truncated (`business-impact-card.tsx` ~30–37).
9. **Hide confidence %** in primary growth UI; keep for expert/debug tier only (`growth-recommendation-card.tsx`).

### 5.4 Security & M365 privacy

10. **Default domain filter to `external`** on Email Intelligence (and optionally Meetings), with an explicit chip “Domain: External” so AD-001 stays honest (`email-intelligence.tsx` L161–163). Optionally mirror server-side default in GET emails for deal intelligence consumers.
11. **Wire tombstone path** — On Graph delta `@removed` / 404, call `markEmailDeletedInSource`; never auto-purge (already compliant).
12. **Complete mail ingest** — Persist `fetchMailDelta` results into `EmailMessageRecord` (preview-only fields) with idempotent `externalMessageId`.
13. **Harden crypto ops** — `timingSafeEqual` for cron secret; encrypt `deltaSyncToken` with same `encryptToken` helpers; optional migration job to re-encrypt any legacy plaintext OAuth rows.
14. **Tighten diagnostics** — Restrict RAW Outlook body logging to explicit `OUTLOOK_IMPORT_DEBUG=1` even in development; never log OAuth tokens (already avoided).
15. **Attachment at-rest** — Document risk; consider encrypting `contentBase64` with the same AES key material in a later sprint (non-breaking if dual-read decrypt).

---

## 6. Spec ↔ implementation matrix (high level)

| Spec / Decision | Status |
| :--- | :--- |
| AD-001 Filter Transparency | **Mostly met** on live filtered collections |
| FS-005 FR-015 / FR-016 Explainability + approval | **Partial** (approval strong; 4-part inconsistent) |
| FS-006 Reality First (no invented stance) | **Met** |
| FS-008 Meeting propose → confirm | **Met** in UI/API; extractor not live |
| FS-009 Preview-only storage | **Met** |
| FS-009 Sentiment advisory only | **Met** |
| FS-009 Internal-only excluded by default | **Not met** (filter available, default = all) |
| FS-009 Tombstone on Outlook delete | **Helper present; sync not wired** |
| FS-009 User purge only | **Met** |
| OAuth token AES-256-GCM | **Met** |
| Domain boundary classification | **Met** (display); default exclusion **gap** |

---

## 7. Out of scope / not modified

- No changes to `src/`, `prisma/` application logic, seeds, or env files.
- This document is the sole deliverable of the audit pass (`docs/CONSTITUTIONAL_AUDIT_REPORT.md`).
- Constitution binary (`.docx`) was treated as governing via aligned markdown principles/specs in-repo; if Strategic IP clauses diverge from FS/AD docs, treat FS/AD + `SMARTCRM_PRINCIPLES.md` as the executable audit baseline used here.

---

## 8. Suggested follow-up order

1. **Privacy default** — Email/Meetings `domainFilter` default → external (FS-009 / FS-008).  
2. **Tombstone + delta ingest wiring** — complete M365 evidence loop without auto-purge.  
3. **AD-001 on `/deals`** — small UX fix, high trust signal.  
4. **Shared ExplainabilityBlock + `OpportunityInsight` persistence** — close FR-015 gap without changing sovereignty gates.

---

*End of audit report.*
