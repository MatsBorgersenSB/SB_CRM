# SmartCRM → Gemini Handoff: Technical Design & Development Status

**Date:** 2026-07-28  
**Repo:** `SB_CRM` (SmartCRM)  
**Primary branch for recent work:** `develop`  
**Purpose of this brief:** Give Gemini (or any successor agent) enough product, architecture, and delivery context to continue **technical CRM design** without rediscovering the system from scratch.

---

## 1. What SmartCRM is (non-negotiable product identity)

SmartCRM is **not** a traditional CRM.

It is an **Organizational Knowledge and Decision System** — the intelligence layer above Microsoft 365.

**Purpose:** Transform information → understanding → priorities → action.

**North Star questions (every screen):**

1. What do we know?
2. What don’t we know?
3. What changed?
4. What deserves attention?
5. What should happen next?

**SmartAssist** is a **Business Development Intelligence Assistant**, not a chatbot:

- System thinks → user decides
- Knowledge before questions
- Reality First (never invent people/companies/facts)
- Michelin (few ingredients, perfectly chosen)
- Impact mandatory on risks/recommendations

**Canonical rule sources:**

- `.cursor/rules/smartcrm-north-star.mdc`
- `.cursor/rules/smartassist-constitution.mdc`
- `.cursorrules`
- `docs/governance/SMARTCRM_PRINCIPLES.md`

---

## 2. Tech stack (current)

| Layer | Choice |
|--------|--------|
| App | Next.js **16.2.10** (App Router), React 19, TypeScript, Tailwind 4 |
| ORM / DB | Prisma **7.9** + PostgreSQL (`@prisma/adapter-pg`, `pg`) |
| Generated client | `src/generated/prisma` (via `prisma generate`) |
| Auth (current) | Client role context + request header `x-sb-user-role` (not full Entra session yet) |
| M365 | Graph OAuth paths exist; tokens AES-256-GCM encrypted at rest |
| Deploy | Vercel-oriented; Docker Compose documented in `docs/DEPLOYMENT.md` |
| E2E | Playwright (`npm run test:e2e`) |

**Build scripts (important for Vercel):**

```json
"build": "prisma generate && next build",
"postinstall": "prisma generate"
```

**Env template:** `.env.example`  

Keys: `DATABASE_URL`, `DIRECT_URL`, `TOKEN_ENCRYPTION_SECRET`, `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `INTERNAL_DOMAINS` (+ optional Azure/M365).

---

## 3. Roadmap status (`docs/roadmap/ROADMAP`)

### Phase 1 — CRM Foundation ✅

| Spec | Status | Notes |
|------|--------|--------|
| FS-001 Opportunity Stakeholders | ✅ Implemented | Roster refs Contact Registry IDs |
| FS-002 Contact Management | ✅ Implemented | Registry ownership |
| FS-003 Company Management | ✅ Implemented | Registry ownership |

### Phase 2 — Relationship Intelligence (design-heavy / partial product)

| Spec | Status in ROADMAP | Spec doc status | Design note |
|------|-------------------|-----------------|-------------|
| FS-004 Relationship Intelligence | Not marked ✅ | Review | Core relationship layer; large FS |
| FS-005 Opportunity Workspace | Not marked ✅ | Approval Review | “Opportunity Operating System” / Mission Control |
| FS-006 Influence Mapping | Open | Spec exists | Influence matrix exists in product surfaces |
| FS-007 Decision Maker Intelligence | Open | Spec exists | Prisma `DecisionMakerProfile` exists |

### Phase 3 — SmartAssist

| Spec | Status | Notes |
|------|--------|--------|
| FS-008 Meeting Intelligence | Open on ROADMAP | Significant UI/API + commitments propose/confirm |
| FS-009 Email Intelligence | Open on ROADMAP | Preview-only bodies; purge sovereignty |

*(FS-008/009 have substantial implementation even if ROADMAP checkmarks are incomplete — treat as “shipped foundation, deepen design.”)*

### Phase 4 — Growth, Automation & Platform ✅ (recently delivered)

| Spec | Status | Surfaces |
|------|--------|----------|
| FS-010 Account Health & Expansion Signals | ✅ | `/growth`, Prisma `AccountHealthRecord` / `ExpansionSignal` |
| FS-011 Autonomous Workflows | ✅ | `/workflows`, approve/dismiss queue, `WorkflowRule` / `WorkflowExecution` |
| FS-012 AI Copilot & Intelligence | ✅ | `/api/ai/*`, email draft, meeting summary, deal velocity |
| FS-013 Enterprise Security & RBAC | ✅ | `Role` ADMIN/MANAGER/REP, `User`, `AuditLog`, fail-closed auth |
| FS-014 Advanced Analytics & Export | ✅ | `/analytics`, CSV export (ADMIN/MANAGER) |
| FS-015 Real-Time Notifications & Collaboration | ✅ | `Notification` model + bell UI + webhook test |

### Phase 5 — Quality ✅

| Spec | Status |
|------|--------|
| FS-016 Playwright E2E | ✅ | `tests/e2e/*.spec.ts` |

### Phase 6 — Integrations (next major design/build horizon)

| Spec | Status |
|------|--------|
| FS-017 Outlook Integration | Not started (previews exist: `/outlook/*`, M365 APIs) |
| FS-018 Teams Integration | Approved — `docs/FS-018-teams-integration.md` (Phase 1–4 design) |
| FS-019 ERP Integration | Not started |

---

## 4. What “done” looks like in code today

### Core registries & workspaces

- Companies: `/companies`, `/companies/[companyId]`
- Contacts: `/contacts`, `/contacts/[contactId]`
- Opportunities/Deals: `/opportunities`, `/deals`, detail Mission Control–style workspace
- Activities, Projects, Knowledge/SmartDocs, Intelligence, Attention, Revenue, Inventory, Conversions
- Administration: users-access, workspace architect, assisted configuration
- Growth workspace, Workflows approval queue, Analytics reporting

### Prisma domain models (high level)

`Company`, `Contact`, `Relationship`, `Opportunity`, `OpportunityInsight`,  
`StakeholderInfluenceProfile`, `DecisionMakerProfile`,  
`MeetingRecord` + commitments/participants, `EmailMessageRecord`, `DocumentRecord`,  
`ExternalIntegration` + `WebhookSubscription`,  
`AccountHealthRecord`, `ExpansionSignal`,  
`WorkflowRule`, `WorkflowExecution`,  
`User` + `Role` + `AuditLog`,  
`Notification`

### Security / RBAC (FS-013 + constitutional remediation)

- **Fail-closed:** missing/invalid `x-sb-user-role` → `engineer` (maps to enterprise **REP**), **never** superuser/ADMIN  
  → `src/lib/api-auth.ts`
- Admin user APIs gated with `hasRole(..., ['ADMIN'])` via `requireAdminRole`  
  → `src/lib/security/require-admin.ts`
- Audit actions include stage changes, AI usage, analytics export, user create/update, deal/company/contact create, workflow approve/dismiss  
  → `src/lib/security/audit-logger.ts`
- Access-tier map (UI roles ↔ enterprise): superuser/admin → ADMIN; commercial → MANAGER; engineer/client_lead → REP

### Dual data reality (critical for design)

- **Prisma** = registries, health, workflows, audit, notifications, M365 sync artifacts
- **JSON / SharePoint-shaped portfolio** still used for some pipeline/deal operations (`pipeline-db.json`, SharePoint transport modes)
- Design must keep **single source of truth** for Contacts/Companies/Relationships/Stakeholders — opportunity surfaces **reference**, do not duplicate

---

## 5. Recent engineering status (late July 2026)

### Completed remediations

1. Fail-open auth fixed → fail-closed REP default  
2. Administration users APIs gated + audited (`USER_CREATED` / `USER_UPDATED`)  
3. `.env.example` + `.gitignore` exception `!.env.example`  
4. AuditLog extended on creates + workflow state changes  
5. ROADMAP reconciled for FS-010–015 (+ FS-016)  
6. Vercel build: `prisma generate` on `postinstall` and before `next build`  
7. Local verification: `npx tsc --noEmit` and `npm run build` succeed (SSG may log Prisma connection warnings if local DB is down — falls back to JSON portfolio where coded)

### Known operational caveats

- Local Prisma DB (`prisma dev` / ports like 51214/51218) can be flaky; build still completes with JSON fallbacks
- Auth is **header/role-switcher based**, not production Entra session middleware yet — design FS-017/018 should assume real identity eventually
- Constitutional audit (`docs/CONSTITUTIONAL_AUDIT_REPORT.md`, 2026-07-17): strong on sovereignty/encryption foundations; partial on 4-part explainability consistency and some M365 privacy defaults

---

## 6. Where design work should continue (recommended focus)

### A. Product / UX design (highest leverage)

1. **FS-004 Relationship Intelligence** — elevate relationships as primary navigation object; strength, history, coverage, graph readiness without inventing edges  
2. **FS-005 Opportunity Operating System** — Mission Control tabs (Overview / Gaps / Understanding / Actions / Ask); enforce information budgets; decide-first UX  
3. **FS-006 / FS-007** — Influence + Decision Maker intelligence consistency with Reality First and Contact Registry  
4. **FS-008 / FS-009 deepening** — meeting→commitment extraction pipeline (still partly seed/propose); email/meeting intelligence explainability completeness  
5. **FS-017 Outlook / FS-018 Teams** — embed intelligence *in* M365 surfaces (Relationship Card 5 blocks, Meeting Briefing, Daily Focus, Account Workspace) using `@smartcrm/m365-ui` patterns described in North Star — **no CRM iframes in Teams**

### B. Architecture decisions still soft / needed

- Unify pipeline store: SharePoint/JSON vs Prisma `Opportunity` as system of record  
- Promote `OpportunityInsight` (4-part model in schema) from unused → runtime source of truth  
- Replace role-header auth with real identity + server-side session for production RBAC  
- Filter Transparency (AD-001) gaps: `/deals` portfolio count, a few edge surfaces  
- Notification “real-time” vs poll; collaboration model beyond bell/webhook

### C. Design constraints that must be honored

- **Michelin / Apple 3-second / 12-year-old rules**
- **ImpactContext** required on risks/recommendations
- **AD-001** on every filtered collection
- **Propose → Approve** for SmartAssist mutations (workflows, commitments, copilot, expansion signals)
- Do **not** auto-create Contacts/Companies/Relationships/Stakeholders
- Prefer editing existing FS/AD docs under `/docs` over inventing parallel specs

---

## 7. Canonical docs map (read these first)

| Need | Path |
|------|------|
| This handoff | `docs/GEMINI_HANDOFF.md` |
| Roadmap | `docs/roadmap/ROADMAP` |
| FS-001–005 (agent-facing) | `docs/FS-00x-*.md` |
| FS-006–011 (specs folder) | `docs/specifications/` |
| Filter transparency AD | `docs/AD-001-filter-transparency.md` (also under `docs/architecture/`) |
| Deployment | `docs/DEPLOYMENT.md` |
| Constitutional audit | `docs/CONSTITUTIONAL_AUDIT_REPORT.md` |
| Principles | `docs/governance/SMARTCRM_PRINCIPLES.md` |
| Knowledge architecture | `docs/SMARTCRM_KNOWLEDGE_ARCHITECTURE.md` |
| Next.js caveat | `AGENTS.md` — this Next.js differs from training data; check `node_modules/next/dist/docs/` when coding |

---

## 8. Key code anchors for technical design

| Concern | Location |
|---------|----------|
| Request role / fail-closed | `src/lib/api-auth.ts` |
| RBAC | `src/lib/security/rbac.ts`, `require-admin.ts` |
| Audit | `src/lib/security/audit-logger.ts` |
| Schema | `prisma/schema.prisma` |
| Growth / health | FS-010 libs + `/growth` |
| Workflows | `/workflows`, `/api/workflows/executions` |
| AI copilot | `src/lib/ai/*`, `/api/ai/*` |
| Analytics | `src/lib/analytics/*`, `/analytics` |
| Notifications | `/api/notifications`, notification UI |
| M365 preview surfaces | `/outlook/*`, `/api/m365/*` |
| Opportunity Mission Control | opportunity workspace components under `src/components/opportunities/` |
| Relationship links (Phase 4D nav) | `@/components/relationship/relationship-links` |

---

## 9. Suggested “continue from here” prompt

> Continue technical CRM design for SmartCRM (Organizational Knowledge & Decision System above M365, not a record CRM). Phases 1 and 4–5 are largely implemented (FS-001–003, FS-010–016). Next design priority is Phase 2–3 depth (FS-004 Relationship Intelligence, FS-005 Opportunity OS, FS-006/007, deepen FS-008/009) then Phase 6 M365 embeddings (FS-017/018). Honor Reality First, user sovereignty (propose→approve), AD-001 filter transparency, Michelin budgets, and single source of truth for Contact/Company/Relationship registries. Dual store (Prisma + JSON/SharePoint pipeline) must be reconciled in the target architecture. Produce design proposals as FS/AD-aligned specs and UX flows, not generic CRM feature lists. Read `docs/GEMINI_HANDOFF.md` and `docs/roadmap/ROADMAP` first.

---

## 10. One-line status

**SmartCRM has a working Next.js + Prisma foundation with registries, opportunity workspace, growth/workflows/AI/RBAC/analytics/notifications, and constitutional security hardening — design focus now shifts from “platform features” to relationship-first Opportunity OS and native M365 intelligence surfaces.**
