# SmartCRM (`SB_CRM`) Engineering & AI Operations Manual

**Version:** 2.0 · **Last verified against the repo:** 2026-10-23 · **Shell:** Windows PowerShell · **Repo root:** `C:\Users\aar20\SB_CRM`

**Audience:** developers and AI agents (Cursor) working on SmartCRM.
**Ground rules:** follow `.cursorrules` and the SmartAssist constitution (`.cursor/rules/`). Reality First — never invent data. **Do not commit or push unless explicitly asked.**

Every path, script, and config value below was read from the repository on the date above. Where the repo differs from what you might expect, it is called out in **§0**.

---

## Contents

0. [Verification notes — read first](#0-verification-notes--read-first)
1. [Architecture & master toolchain matrix](#1-architecture--complete-master-toolchain-matrix)
2. [Decision matrix: which tool, when](#2-decision-matrix-when-should-i-use-which-tool)
3. [Copy-paste Cursor Agent prompt library](#3-copy-paste-cursor-agent-prompt-library)
4. [PowerShell command cheat sheet](#4-powershell-command-cheat-sheet)
5. [SOP: 6-step production release to Vercel](#5-sop-6-step-production-release-to-vercel)
6. [Troubleshooting & recovery runbook](#6-troubleshooting--recovery-runbook)
7. [Related documents](#7-related-documents)

---

## 0. Verification notes — read first

These are the places where the live repo differs from common assumptions. Treat this table as authoritative.

| # | Topic | Reality in the repo | What to do |
|---|-------|---------------------|-----------|
| 1 | `npm test` | **No `test` script exists.** Scripts are: `dev`, `build`, `db:migrate`, `postinstall`, `start`, `lint`, `test:e2e`, `prepare`. | Use `npm run test:e2e` (= `playwright test`). |
| 2 | Graphify full rebuild | `graphify.exe . --code-only` is **not valid syntax**. `--code-only` belongs to `extract`. | Full AST rebuild: `graphify.exe extract . --code-only`. Incremental: `graphify.exe update .`. Re-cluster only: `graphify.exe cluster-only .`. |
| 3 | Vercel AI SDK / `zod` / `pgvector` | **Not installed yet.** `ai`, `@ai-sdk/*`, and `zod` are absent from `package.json`; `prisma/schema.prisma` has no `vector` / `Unsupported(...)` columns and no `extensions` block. | AI today = `@anthropic-ai/sdk` + OpenAI via env vars (see §1.10). The AI SDK / pgvector are the **target** stack — install steps in §1.10. |
| 4 | Sentry Session Replay | `src/instrumentation-client.ts` calls `Sentry.init` with `tracesSampleRate: 1` and privacy `dataCollection` rules, but **no `replayIntegration` / `replaysSessionSampleRate`**. Replay is **not enabled**. | Treat Replay as available-but-off. Enabling it is a code change (and a privacy decision — see FS rules on Reality First / data handling). |
| 5 | Sentry DSN | The DSN is **hard-coded** in `src/instrumentation-client.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` (not an env var). Only `SENTRY_AUTH_TOKEN` (source-map upload) is secret. | Never commit `.env.sentry-build-plugin` (it is git-ignored). |
| 6 | Production hostname | `outlook/relationship-card/manifest.xml`, `outlook/README.md`, and `.env.example` use **`https://sb-crm-seven.vercel.app`**. `teams/manifest.json` references **`crm.standard.bio`**. Vercel project name is **`sb-crm`** (`.vercel/project.json`). | Confirm which hostname is the live alias before a release (§5 step 6). If the canonical host changes, the Outlook manifest, Entra redirect URIs, `AUTH_URL`, and `NEXT_PUBLIC_APP_URL` must all change together (§6.4). |
| 7 | Outlook manifest version | `manifest.xml` `<Version>` is **1.6.1.0**. `outlook/README.md` still says 1.4.1.0 (stale). A backup exists: `manifest.v1.3.2.backup.xml`. | Trust the manifest, not the README. |
| 8 | Stray parent lockfile | `C:\Users\aar20\package-lock.json` **and** `C:\Users\aar20\package.json` exist outside the repo. That is the source of Next.js multi-lockfile warnings. `next.config.ts` already pins `turbopack.root`. | See §6.5. |
| 9 | Postgres MCP credential | `.cursor/mcp.json` holds a **live Neon `neondb_owner` connection string** (owner-level, not a read-only role). The MCP server enforces read-only *transactions*, but the credential itself can write if used elsewhere. | Replace with a dedicated read-only role (§6.3) and **rotate the owner password** if it has ever been pasted into chat, a screenshot, or a log. This manual intentionally never prints it. |
| 10 | `.husky` layout | `core.hooksPath` = `.husky/_` (Husky 9). Hooks live in `.husky/`: `pre-commit`, `post-commit`, `post-checkout`, `post-merge`, `post-rewrite`. | See §1.7. |
| 11 | Knip config | No `knip.json` and no npm script — `npx knip` runs with defaults. | Expect false positives on Next.js entry points until a config is added. |
| 12 | Playwright MCP | `@playwright/mcp` is **not** in `package.json`; it is fetched on demand by `npx -y @playwright/mcp@latest` from `.cursor/mcp.json`. | Nothing to install. |

---

## 1. Architecture & Complete Master Toolchain Matrix

### 1.0 How the pieces fit

```text
                         ┌────────────────────────── Cursor (Agent) ──────────────────────────┐
                         │  Rules: .cursorrules · .cursor/rules/*.mdc (graphify, constitution)│
                         │  Skills: .agents/skills · .cursor/skills · skills-lock.json         │
                         │  MCP (.cursor/mcp.json): graphify · context7 · playwright ·         │
                         │                          postgres · Sentry                          │
                         └───────────────┬───────────────────────────────────────────────────-┘
                                         │ edits
        ┌────────────────────────────────▼──────────────────────────────────────────────┐
        │ SB_CRM  (Next.js 16.2.10 · React 19.2.4 · Prisma 7.9 + pg adapter · NextAuth v5)│
        │   src/middleware.ts  ── auth gate (bypass: /api/inngest, /monitoring, crons…)  │
        │   src/inngest/*      ── durable background functions  → /api/inngest           │
        │   Sentry             ── instrumentation + /monitoring tunnel                    │
        │   Outlook add-in     ── /outlook-addin, /outlook/* (manifest.xml)              │
        └───────┬───────────────────┬──────────────────────┬───────────────────────────┘
                │ pre-commit        │ CI (.github/…ci.yml)  │ deploy
          Husky: lint-staged   tsc, migrate, build,    Vercel project `sb-crm`
          + tsc --noEmit       Playwright smoke        (vercel.json crons, standalone build)
```

**Knowledge flow rule (North Star):** Sources → Knowledge → Understanding → Prioritization → Action. Tooling exists to protect that flow: orient (Graphify), verify (Playwright/Postgres), document (Context7), observe (Sentry), execute reliably (Inngest), keep clean (Knip/Husky).

### 1.1 Master toolchain matrix

| Tool Name | Category | What It Does | When to Use It | Config / Location | Cost / Tier |
|-----------|----------|--------------|----------------|-------------------|-------------|
| **Graphify** (`graphifyy` CLI v0.9.94 + `graphify-mcp`) | Code intelligence | AST (+ optional SQL schema) knowledge graph of the repo; answers `query`, `path`, `explain`; MCP server exposes the same to the agent | **Before** exploring unfamiliar code or touching shared models; after code changes (`update`) | `graphify-out/` (`graph.json`, `GRAPH_REPORT.md`, `graph.html`; git-ignored) · `.cursor/rules/graphify.mdc` · MCP `graphify` · binary `C:\Users\aar20\AppData\Roaming\Python\Python315\Scripts\graphify.exe` (+ `graphify-mcp.exe`) | Free / OSS. `--code-only` is local AST, no API key. Semantic extraction uses your LLM key |
| **Playwright** (`@playwright/test` ^1.61.1 + `@playwright/mcp`) | Testing / browser | E2E smoke tests (`tests/e2e`); live browser control for DOM, network, console inspection through MCP | UI/layout bugs, reproducing flows, timing a slow page, pre-release smoke | `playwright.config.ts` · `tests/e2e/` · MCP `playwright` · CI step "Run Playwright E2E smoke tests" | Free / OSS |
| **Context7 MCP** (`@upstash/context7-mcp`) | Documentation | Injects live, version-accurate library docs into the prompt (Next.js 16, Prisma 7, NextAuth v5, Office.js, Vercel AI SDK) | Any time you write framework/library code you are not 100% sure about | MCP `context7` (`cmd /c npx -y @upstash/context7-mcp@latest`) | Free tier (optional API key for higher limits — check Upstash plan) |
| **Postgres MCP** (`@modelcontextprotocol/server-postgres`) | Database | Read-only SQL (`query` tool runs in read-only transaction) against the connected DB from inside Cursor | Inspect real data/schema; `EXPLAIN ANALYZE` slow queries; before shared-model changes | MCP `postgres` in `.cursor/mcp.json` (connection string is secret — see §6.3) | Free (DB cost = Neon plan) |
| **Prisma Studio** (`prisma` ^7.9) | Database | Visual DB browser/editor | Browse/fix rows manually in **dev** only | `npx prisma studio` (port 5555) · `prisma.config.ts` (uses `DIRECT_URL` else `DATABASE_URL`) | Free |
| **Sentry** (`@sentry/nextjs` ^11.8.0 + Sentry MCP) | Observability | Client, server, edge error + trace capture; source maps; `/monitoring` tunnel; Sentry MCP lets the agent read issues | Any Production (`crm.standard.bio` / Vercel) or Outlook add-in error; after each release | `next.config.ts` (`org: standard-bio-as`, `project: javascript-nextjs`, `tunnelRoute: "/monitoring"`) · `src/instrumentation.ts` · `src/instrumentation-client.ts` · `sentry.server.config.ts` · `sentry.edge.config.ts` · `src/app/global-error.tsx` · `.env.sentry-build-plugin` · MCP `Sentry` → `https://mcp.sentry.dev/mcp/standard-bio-as/javascript-nextjs` | Free tier + paid plans (confirm org plan) |
| **Inngest** (`inngest` ^4.26.0) | Background jobs | Durable, retryable, step-based functions triggered by events/cron | Long-running M365 mail sync, tender scraping, AI enrichment — anything that can exceed a request or must retry | `src/inngest/client.ts` (`id: "sb-crm"`) · `src/inngest/functions.ts` · `src/app/api/inngest/route.ts` · dev server `npx inngest-cli@latest dev` | Free tier + paid plans (confirm org plan) |
| **Husky + lint-staged + TS gate** (`husky` ^9.1.7, `lint-staged` ^17.6.0) | Quality gate | Blocks bad commits: `eslint --fix` on staged `*.{ts,tsx,mjs}`, then whole-repo `tsc --noEmit`; Graphify hooks refresh the graph | Automatic on every `git commit`; never bypass | `.husky/pre-commit` · `package.json` → `lint-staged` · `prepare: husky` | Free |
| **Knip** (`knip` ^6.42.1) | Hygiene | Detects unused files, exports, types, dependencies, duplicates | Weekly cleanup; before major releases; after large refactors | `npx knip` (no `knip.json`, no npm script) | Free / OSS |
| **Agent Skills** (`npx skills`, `skills-lock.json`) | Agent guidance | Installs curated `SKILL.md` packs the agent reads on demand | Setting up a machine; adding/updating guidance; choosing a workflow skill | `.agents/skills/` · `.claude/skills/` · `.cursor/skills/` (SmartCRM custom skills) · `skills-lock.json` | Free (public GitHub packs) |
| **SmartCRM Native AI Stack** | Product AI | Anthropic + OpenAI calls power intake scan, SmartAssist, tender classification; Inngest hosts autonomous agents; (target) AI SDK + pgvector memory | Building any SmartAssist feature | See §1.10 | Pay-per-token to providers |
| **Vercel** (CLI 65.2.0 via `npx vercel`) | Hosting | Production build/hosting, crons | Release (§5) | `vercel.json` (3 crons) · `.vercel/project.json` (`sb-crm`) | Per Vercel plan |
| **GitHub Actions CI** | CI | `tsc`, `prisma migrate deploy`, SmartDocs filing harness, `npm run build`, Playwright | Runs on push/PR to `main` and `develop` | `.github/workflows/ci.yml` | GitHub plan |

### 1.2 Graphify

**What:** knowledge graph of code (functions, imports, calls, models) in `graphify-out/graph.json`. The workspace rule (`.cursor/rules/graphify.mdc`) **requires** it before using Read/Grep/Glob to explore.

**Files (all git-ignored via `graphify-out/`):**

| File | Purpose |
|------|---------|
| `graphify-out/graph.json` | Machine graph; read by CLI and by MCP `graphify` |
| `graphify-out/GRAPH_REPORT.md` | Large architecture report (~2.6k lines) — **search it, don't read it whole** |
| `graphify-out/graph.html` | Interactive visual graph — open in a browser |
| `graphify-out/wiki/index.md` | If present, navigate instead of raw files |

**Binary (use when `graphify` is not on PATH):**

```text
C:\Users\aar20\AppData\Roaming\Python\Python315\Scripts\graphify.exe
C:\Users\aar20\AppData\Roaming\Python\Python315\Scripts\graphify-mcp.exe
```

**Core commands:**

| Command | Use |
|---------|-----|
| `graphify query "<question>"` | Scoped subgraph for a codebase/architecture question |
| `graphify path "<A>" "<B>"` | Shortest dependency path (directed by default; add `--undirected` to ignore direction) |
| `graphify explain "<concept>"` | Plain-language node + neighbours (`--all` for every edge) |
| `graphify update .` | Re-extract code, AST only, no LLM — **run after modifying code** |
| `graphify extract . --code-only` | Full headless AST rebuild, skip docs/images, no API key |
| `graphify extract . --postgres <DSN>` | Add a live PostgreSQL schema to the graph (use a read-only DSN) |
| `graphify cluster-only .` | Re-cluster existing graph and regenerate report + `graph.html` (`--no-viz` to skip HTML) |
| `graphify hook status` / `hook install` | Inspect / (re)install the git hooks |

**Workflow:** orient (`query`/`explain`/`path`) → narrow (Read/Grep specific lines) → modify → `graphify update .`.

### 1.3 Playwright (tests + MCP)

**E2E (project suite)** — `playwright.config.ts`:

- `testDir: tests/e2e`, `baseURL: http://localhost:3000`, Chromium only.
- Auto-starts `npm run dev` (`reuseExistingServer` locally); env `E2E=1`, `NEXT_TELEMETRY_DISABLED=1`. `E2E=1` enables soft health probes so smoke tests need no live Postgres.
- CI: 1 worker, 2 retries, HTML report. Local: `list` reporter. Trace on first retry; screenshot on failure.
- Artifacts `test-results/`, `playwright-report/` are git-ignored.

**Playwright MCP (agent-driven browser):** start `npm run dev`, then ask the agent to open `http://localhost:3000`. Capabilities used here: accessibility snapshots (structure), screenshots (visual), network timings, console errors. Auth is Microsoft Entra SSO — the agent cannot complete SSO; sign in manually then hand back. Don't loop on a failing interaction: stop and report.

### 1.4 Context7 MCP

Add **`use context7`** to any prompt, and name the library + version. Most valuable here because **Next.js 16.2.10** (`AGENTS.md`: "This is NOT the Next.js you know"), **Prisma 7** (driver adapter `@prisma/adapter-pg`, `prisma.config.ts`), and **NextAuth v5 beta** all have breaking changes. For Next.js also consult `node_modules/next/dist/docs/` — the installed version is authoritative. Context7 teaches *how a library works*; SmartCRM conventions come from `/docs` (FS/AD) and `.cursor/rules/`.

### 1.5 Postgres MCP & Prisma Studio

- **Postgres MCP:** read-only SQL inside Cursor (`SELECT`, `EXPLAIN ANALYZE SELECT …`, `information_schema`). Point it at **dev/staging, or a read-only role** — never a write-capable production credential (§0 #9, §6.3).
- **Prisma Studio:** `npx prisma studio` → `http://localhost:5555`. Can **edit** data — dev only.
- Schema lives in `prisma/schema.prisma` (generator `prisma-client-js` → `src/generated/prisma`, git-ignored). Shared models: `Company`, `Contact`, `Relationship`, `Opportunity`, `Activity`, `MeetingRecord`, `EmailMessageRecord`, `DocumentRecord`, `ExternalIntegration`, `Tender`, `SmartAssistExploration`, and others. Client accessor: `getPrisma()` in `src/lib/prisma.ts`.
- Migrations: `npx prisma migrate dev` (local only) · `npm run db:migrate` (= `prisma migrate deploy`, CI/prod). **Never** `migrate dev` or `db push` against production.

### 1.6 Sentry

| Concern | Detail |
|---------|--------|
| Runtimes | Client: `src/instrumentation-client.ts` · Node: `sentry.server.config.ts` · Edge: `sentry.edge.config.ts` · wired by `src/instrumentation.ts` (`register()` + `onRequestError`) |
| Build | `withSentryConfig` in `next.config.ts`; `widenClientFileUpload: true`; source-map upload needs `SENTRY_AUTH_TOKEN` (local: `.env.sentry-build-plugin`; Vercel: env var) |
| Tunnel | `tunnelRoute: "/monitoring"` — browser events go through your own origin to dodge ad-blockers |
| **Middleware bypass** | `src/middleware.ts` allows `/monitoring` without a session **both** in the `pathname.startsWith("/monitoring")` branch **and** in the `config.matcher` exclusion list. If you rename `tunnelRoute`, update both or client errors redirect to `/auth/signin` and are lost |
| Outlook add-in | Task panes `/outlook-addin` and `/outlook/*` are served by the same Next app, so they use the same client instrumentation. Unauthenticated `/api/*` returns JSON 401 (not HTML) so add-in `fetch()` can detect auth state |
| Privacy | `dataCollection` disables user info, HTTP bodies, GraphQL docs, GenAI inputs/outputs, DB query data; IP/user headers and cookies are deny-listed |
| Replay | **Not enabled** (§0 #4) |
| MCP | `Sentry` server in `.cursor/mcp.json`; authenticate through *Cursor Settings → MCP* on first use |

### 1.7 Husky + lint-staged + TypeScript gate

`npm install` runs `prepare` → `husky`; `core.hooksPath` is `.husky/_`.

| Hook file | What runs |
|-----------|-----------|
| `.husky/pre-commit` | `npx lint-staged` (→ `eslint --fix` on staged `*.{ts,tsx,mjs}`) then `npx tsc --noEmit` (**whole repo**) |
| `.husky/post-commit` | Graphify background rebuild of the graph (code only, logs to `%USERPROFILE%\.cache\graphify-rebuild.log`; skipped during rebase/merge/cherry-pick; `GRAPHIFY_SKIP_HOOK=1` disables) |
| `.husky/post-checkout` · `post-merge` · `post-rewrite` | Same Graphify refresh logic after branch switch, merge, rebase/amend |

A failing `eslint` or `tsc` **blocks the commit**. Fix the error; never use `--no-verify`. Note `tsc` checks the whole project, so the error can be in a file you did not edit.

### 1.8 Knip

`npx knip` reports unused files, exports, types, dependencies. Useful flags (verified against knip 6.x `--help`): `--files`, `--exports` (exports, types, enum members, duplicates), `--dependencies`, `--include <types>`, `--exclude <types>`, `--production`. Treat the first run as triage: Next.js entry points (`app/**`, route handlers, `middleware`), `prisma/seed.ts`, and `scripts/*.ts` may be flagged falsely until a `knip.json` with `entry` patterns exists. **Never delete flagged code blindly** — confirm with `graphify explain`/`path` and a grep for dynamic references. Remove unused dependencies in their own change.

### 1.9 Agent Skills

Installed from GitHub via `npx skills`; the lock file is `skills-lock.json` (root).

| Source pack | Skills (examples) | Used for |
|-------------|-------------------|----------|
| `vercel-labs/agent-skills` (9) | `vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines`, `deploy-to-vercel`, `vercel-react-view-transitions` | UI building, layout/drawer fixes, React perf, deploy |
| `vercel/next.js` (7) | `next-dev-loop`, `next-bundle-optimizer`, `next-cache-components-*`, `next-partial-prefetching-*` | Next.js 16 verification & optimisation |
| `obra/superpowers` (15) | `systematic-debugging`, `brainstorming`, `writing-plans`, `executing-plans`, `test-driven-development`, `verification-before-completion`, `requesting-code-review`, `using-git-worktrees` | Disciplined debugging, planning, review |
| `anthropics/skills` (20) | `claude-api`, `frontend-design`, `webapp-testing`, `mcp-builder`, `pdf`, `docx`, `xlsx`, `pptx`, `skill-creator` | Claude API work, documents, testing |
| `prisma/skills` (9) | `prisma-cli`, `prisma-client-api`, `prisma-upgrade-v7`, `prisma-postgres`, … | Prisma 7 work |
| `vercel-labs/skills` (1) | `find-skills` | Discovering more skills |
| **SmartCRM custom** (`.cursor/skills/`) | `smartassist`, `living-workspace`, `growth-intelligence`, `strategic-marketing-intelligence`, `m365-colleague-work` | Product-specific behaviour |

Locations: `.agents/skills/` (pack installs), `.claude/skills/`, `.cursor/skills/` (custom). Restore on a fresh machine: `npx skills experimental_install` (reads `skills-lock.json`).

### 1.10 SmartCRM Native AI Stack

**What exists today (verified):**

| Layer | Implementation |
|-------|----------------|
| Anthropic | `@anthropic-ai/sdk` ^0.135.0; env `ANTHROPIC_API_KEY`, `ANTHROPIC_INTAKE_MODEL` (card scan: `src/app/api/crm/intake/card/scan/route.ts`) |
| OpenAI | env `OPENAI_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_SMARTASSIST_MODEL`, `OPENAI_TENDER_MODEL` (`src/lib/smartassist/*`, `src/lib/tenders/classifier.ts`) |
| SmartAssist | `src/lib/smartassist/` (e.g. `omniOrchestrator.ts`, `eventExtract.ts`) — recommends, user decides |
| Background agents | Inngest (`src/inngest/`) — currently one function, `crm-background-healthcheck` |

**Target stack (not installed yet — install deliberately, one provider at a time):**

```powershell
npm install ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google zod
```

| Piece | Notes |
|-------|-------|
| Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`) | Provider-agnostic generation/streaming/tool-calling. Look up v-current API with Context7 (`use context7`) — the API changes between majors |
| `zod` | Structured-output schemas and validation of every model response |
| PostgreSQL `pgvector` | Semantic memory. Requires `CREATE EXTENSION vector;` on Neon and a Prisma migration; vector columns need `Unsupported("vector(1536)")` + raw SQL for similarity queries. **Nothing in `schema.prisma` yet** |
| Inngest agents | Long enrichment runs as `step.run(...)` units so each step retries independently |

**Constitution constraints on any AI feature:** never auto-create/modify Contacts, Companies, Relationships, or Stakeholders without user approval; search existing knowledge before asking; every recommendation carries impact; unknown stays unknown.

### 1.11 Inngest

| File | Role |
|------|------|
| `src/inngest/client.ts` | `new Inngest({ id: "sb-crm" })` |
| `src/inngest/functions.ts` | `crmBackgroundHealthcheck` (`id: "crm-background-healthcheck"`, trigger event `crm/healthcheck.requested`); exported `functions` array |
| `src/app/api/inngest/route.ts` | `serve({ client, functions })` → `GET`, `POST`, `PUT` |

- **Middleware bypass:** `/api/inngest` is excluded in `src/middleware.ts` (both the allow-list and matcher). Machine-to-machine; verified by `INNGEST_SIGNING_KEY` in production.
- **Local dev (two terminals):** `npm run dev` + `npx inngest-cli@latest dev` → UI at `http://localhost:8288`. If auto-discovery fails: `npx inngest-cli@latest dev -u http://localhost:3000/api/inngest`.
- **Smoke test:** in the Dev Server UI send event `crm/healthcheck.requested`; confirm `crm-background-healthcheck` completes.
- **Existing Vercel crons** (`vercel.json`, protected by `CRON_SECRET`): `/api/cron/m365-mail-sync` (every 10 min), `/api/cron/m365-renew-subscriptions` (every 12 h), `/api/cron/tender-ingest` (daily 06:00 UTC). To migrate heavy work: define an event, move the work into a function with each unit in `step.run(...)`, have the route/cron `inngest.send(...)` instead of working inline. Migrate one job at a time.
- After each production deploy, re-sync the app in the Inngest dashboard against the production `/api/inngest` URL.

### 1.12 Outlook Add-in (reference)

`outlook/relationship-card/manifest.xml` — `<Id>6f3c8b2a-9d4e-4a1c-b7e2-a1b2c3d4e5f6</Id>` (never change), `<Version>1.6.1.0</Version>`, `ProviderName` SmartCRM, `DisplayName` "SmartCRM for Outlook". Task panes: `/outlook-addin` (Relationship Card), `/outlook-addin?mode=compose`, `/outlook/meeting-briefing`. `AppDomains` allow Microsoft login hosts for the Office Dialog SSO. Rules: Message (Read + Edit) and Appointment (Read). See §6.4 for the update procedure.

---

## 2. Decision Matrix: "When Should I Use Which Tool?"

| # | Situation | Use (in order) | Why |
|---|-----------|----------------|-----|
| 1 | **Before touching shared models** (`Company`, `Contact`, `Activity`, `getPrisma()`) | **Graphify** (`explain`, `path`) → **Postgres MCP** (real data shape, row counts, nulls) | Blast radius first; single-source-of-truth rule means these models feed many surfaces |
| 2 | **A page or API route feels slow** (e.g. `/?boot=1`) | **Playwright MCP** (network timings, waterfall) → **Graphify** (trace execution path from route to `getPrisma()` calls) → **Postgres MCP** (`EXPLAIN ANALYZE` the suspect query) | Measure → locate → prove |
| 3 | **Building UI / fixing a layout or drawer bug** | **Playwright MCP** (see it, screenshot, snapshot) + **`vercel-labs/agent-skills`** (`vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines`) + `.cursor/skills/living-workspace` | Verify visually; follow Michelin / 3-second test |
| 4 | **Writing Next.js 16 / Prisma 7 / NextAuth v5 / Office.js / Vercel AI SDK code** | **Context7** (`use context7`) + `node_modules/next/dist/docs/` for Next.js | Training data is stale for all of these |
| 5 | **A bug in Production (`crm.standard.bio`) or the Outlook Add-in** | **Sentry MCP** (find issue, stack, release) → **`obra/superpowers` `systematic-debugging`** (root cause before fix) → Playwright MCP to reproduce | Evidence → hypothesis → fix |
| 6 | **Long-running M365 mail sync, tender scraper, AI enrichment** | **Inngest** (`src/inngest/functions.ts`, `step.run`) + Context7 (Inngest v4 API) | Must retry, must outlive a request timeout |
| 7 | **Before weekly cleanup / major release** | **Knip** (`--files`, `--exports`) + **Graphify** import-cycle check (`path A→B` and `B→A`) | Remove dead code safely, catch circular imports |
| 8 | **Adding/changing an API route or page** | Check `src/middleware.ts` allow-list + matcher | Auth guard is path-based; wrong placement = silent 401/redirect |
| 9 | **Changing a Prisma model** | Graphify → `npx prisma migrate dev` → Postgres MCP verify → Prisma Studio (dev) | Never `db push` to prod |
| 10 | **Pre-commit failed** | Read the eslint/tsc error → fix → recommit (§6.2) | Never `--no-verify` |
| 11 | **Setting up a new machine** | §6.3 (`mcp.json`), `npm ci`, `npx skills experimental_install`, `graphify extract . --code-only` | Reproducible environment |
| 12 | **Outlook manifest changed** | §6.4 | Version bump + M365 re-upload |

---

## 3. Copy-Paste Cursor Agent Prompt Library

Paste directly into Cursor chat. Replace `<…>` placeholders. All assume the agent follows `.cursorrules` (graphify first, minimal diffs, no commits unless asked).

### 3.1 Orient before changing shared models

```text
Before changing anything, use graphify (MCP or CLI) to map the blast radius of <Company | Contact | Activity | getPrisma()>:
1. `graphify explain "<model>"` and list the top files that read or write it.
2. `graphify path` from <entry route/page> to <model>.
3. Use the Postgres MCP (read-only) to show the real shape of the data: row count, null rates for <fields>, and 3 sanitized sample rows.
Report: who depends on it, what could break, and the safest change. Do not edit code yet.
```

### 3.2 Slow page / API route

```text
`<URL, e.g. /?boot=1>` is slow. Diagnose; don't fix yet.
1. Start from http://localhost:3000 (assume `npm run dev` is running). Use the Playwright MCP to load the page, and report the network waterfall: slowest 5 requests with timings, payload sizes, and any console errors.
2. Use graphify to trace the execution path from that route to its data access (`getPrisma()` callers). List sequential awaits that could be parallel.
3. For the suspect query, use the Postgres MCP to run EXPLAIN ANALYZE (SELECT only) and report scans, row estimates vs actual, and missing indexes.
Give a ranked list of causes with measured evidence and expected gain.
```

### 3.3 UI build or layout/drawer bug

```text
Fix/build: <describe UI problem or feature> on <route>.
1. Read the relevant spec in /docs (FS-0XX) and the skills `vercel-react-best-practices`, `vercel-composition-patterns`, `web-design-guidelines`, and `.cursor/skills/living-workspace`.
2. Use the Playwright MCP at http://localhost:3000 to reproduce first: take a snapshot + screenshot at 1440px and 390px widths. If sign-in blocks you, stop and ask me.
3. Make minimal edits following existing patterns in src/.
4. Re-verify with Playwright (screenshot after) and apply the 3-second and Michelin tests: what am I looking at, what matters, what next? Remove anything that doesn't drive a decision.
```

### 3.4 Library-accurate code (Next.js 16 / Prisma / NextAuth / Office.js / AI SDK)

```text
use context7 — <library + version, e.g. Next.js 16.2, Prisma 7.9 with @prisma/adapter-pg, next-auth v5 beta, Office.js Mailbox 1.x, Vercel AI SDK>.
Question/task: <what to build>.
Also check node_modules/next/dist/docs/ if it's Next.js. Show the exact API signatures you're relying on before writing code, then implement with minimal diffs.
```

### 3.5 Production or Outlook Add-in bug

```text
Production bug: <symptom, URL, user, time>. Use the Sentry MCP (standard-bio-as / javascript-nextjs):
1. List the latest unresolved issues matching this symptom; pick the most likely, and show stack trace, release, environment, frequency, and affected route (Outlook add-in routes are /outlook-addin and /outlook/*).
2. Then follow the `systematic-debugging` skill (obra/superpowers): reproduce, form hypotheses, find root cause BEFORE proposing a fix. Use graphify path to trace from the failing frame to its callers.
3. Propose the smallest fix and a regression test. Don't commit.
```

### 3.6 Background job on Inngest

```text
Move <M365 mail sync | tender ingest | AI enrichment of X> to Inngest.
1. Use graphify to find the current route/cron implementation and its callers (crons are in vercel.json).
2. use context7 for the current Inngest v4 API (createFunction triggers, step.run, retries, concurrency).
3. Define event `crm/<name>.requested` and a function in src/inngest/functions.ts (append to the exported `functions` array). Each unit of work in `step.run(...)`, idempotent.
4. Make the existing route/cron `inngest.send(...)` instead of working inline.
5. Respect the constitution: never auto-create/modify Contacts, Companies, Relationships, Stakeholders without user approval.
Give me the Dev Server (npx inngest-cli@latest dev) test steps. Don't commit.
```

### 3.7 Weekly cleanup / pre-release hygiene

```text
Run `npx knip --files` and `npx knip --exports`. Group findings by confidence (high: no references anywhere; medium: only referenced via dynamic import/route conventions; low: framework entry points). For the top 10 high/medium candidates, verify with `graphify explain` and `graphify path` in both directions, plus a grep for dynamic references. Then use graphify to report any circular import chains among src/lib and src/components. Propose deletions as a list — don't delete anything.
```

### 3.8 Add an API route / page safely (middleware check)

```text
I'm adding <route>. Read src/middleware.ts and tell me: (a) is it covered by the auth guard, (b) does it need to be in the public allow-list or matcher exclusion (machine-to-machine like /api/inngest, /api/cron, /monitoring), (c) what happens for unauthenticated calls (JSON 401 for /api/*, redirect for pages). Implement with the minimal change.
```

### 3.9 Prisma model change

```text
Change: <model/field>. use context7 (Prisma 7.9). Use graphify to list every reader/writer of the model first. Edit prisma/schema.prisma, create a backwards-compatible migration with `npx prisma migrate dev --name <name>` (local only), update affected code, verify with the Postgres MCP. Call out anything not safe to deploy before the code (migration ordering).
```

### 3.10 Pre-merge review

```text
Review my uncommitted changes against .cursorrules: Reality First, relationship posture gating (isOpportunityEligibleCompany), AD-001 filter transparency, information budgets, impact on every risk/recommendation, no duplicated Contacts/Companies/Relationships/Stakeholders stores. Also run `npx tsc --noEmit` and `npm run lint` and report only errors.
```

### 3.11 Release readiness

```text
Walk SOP §5 of docs/SMARTCRM_OPERATIONS_MANUAL.md and report pass/fail per step without deploying: dev servers stopped, `git check-ignore` confirms .cursor/mcp.json / .env.sentry-build-plugin / graphify-out/ are ignored and untracked, `git status` shows only intended files, `npx tsc --noEmit` clean, Vercel env vars present (names only, never values), outlook manifest <Version> bumped if manifest changed.
```

### 3.12 Outlook manifest change

```text
I changed outlook/relationship-card/manifest.xml. Verify: <Version> is higher than 1.6.1.0, <Id> unchanged, every SourceLocation / bt:Url host matches the production host, AppDomains still cover Microsoft login, XML is well-formed. Then give me the exact M365 admin center steps to update the add-in. Don't edit <Id>.
```

### 3.13 New-machine bootstrap

```text
Help me set up SB_CRM on a new Windows machine using §6.3 of docs/SMARTCRM_OPERATIONS_MANUAL.md: recreate .cursor/mcp.json with placeholders (I'll supply secrets), run `npm ci`, restore skills, build the Graphify graph, and verify each MCP server connects. Never print or store secret values.
```

---

## 4. Complete PowerShell Command Cheat Sheet

Run from `PS C:\Users\aar20\SB_CRM>`. Running from a subfolder breaks `turbopack.root` (`process.cwd()`).

### 4.1 Daily Dev & Local Servers

```powershell
# One-time per session: define the graphify path variable
$gfy = "C:\Users\aar20\AppData\Roaming\Python\Python315\Scripts\graphify.exe"

git pull
npm ci                                              # only if package-lock.json changed (postinstall runs prisma generate)
npm run dev                                         # Next.js → http://localhost:3000
npx inngest-cli@latest dev                          # Inngest Dev Server → http://localhost:8288 (second terminal)
npx inngest-cli@latest dev -u http://localhost:3000/api/inngest   # if auto-discovery fails
npx prisma studio                                   # DB browser → http://localhost:5555 (dev DB only)
npx prisma generate                                 # regenerate client → src/generated/prisma
npx prisma migrate dev                              # create/apply migrations LOCALLY
npm run db:migrate                                  # prisma migrate deploy (CI / production)
npm run build                                       # prisma generate && next build
npm start                                           # run the built app
```

### 4.2 Code Quality & Hygiene

```powershell
npx tsc --noEmit                                    # whole-repo type check (same as Husky gate + CI)
npm run lint                                        # eslint
npx eslint --fix src\path\to\file.tsx               # fix one file
npx knip --files                                    # unused files only
npx knip --include exports,types                    # unused exports + types
npx knip --exports                                  # exports, types, enum members, duplicates
npx knip --dependencies                             # unused / unlisted deps
npx knip --production                               # production code only
npm run test:e2e                                    # Playwright suite (there is NO `npm test` script)
npx playwright test --ui                            # interactive runner
npx playwright show-report                          # open HTML report
npx playwright install chromium                     # first-time browser install
npx tsx scripts\smartdocs-attachment-filing-harness.ts   # same harness CI runs (needs DB)
```

### 4.3 Graphify Manual Refresh & Visual Graph

```powershell
& "C:\Users\aar20\AppData\Roaming\Python\Python315\Scripts\graphify.exe" update .                  # incremental AST refresh (no LLM) — default after edits
& "C:\Users\aar20\AppData\Roaming\Python\Python315\Scripts\graphify.exe" extract . --code-only     # full AST rebuild (no API key)
& "C:\Users\aar20\AppData\Roaming\Python\Python315\Scripts\graphify.exe" cluster-only .            # re-cluster + regenerate GRAPH_REPORT.md and graph.html
& "C:\Users\aar20\AppData\Roaming\Python\Python315\Scripts\graphify.exe" query "how does auth middleware gate API routes?"
& "C:\Users\aar20\AppData\Roaming\Python\Python315\Scripts\graphify.exe" path "Company" "getPrisma"
& "C:\Users\aar20\AppData\Roaming\Python\Python315\Scripts\graphify.exe" explain "Activity"
& "C:\Users\aar20\AppData\Roaming\Python\Python315\Scripts\graphify.exe" hook status
Start-Process "C:\Users\aar20\SB_CRM\graphify-out\graph.html"                                     # open the visual graph in your default browser
Get-Content "$env:USERPROFILE\.cache\graphify-rebuild.log" -Tail 30                                # last hook-triggered rebuild output
```

If `graphify` resolves on PATH you can drop the prefix; if not, use the full path above (or fix PATH — §6.1).

### 4.4 Agent Skills & AI SDK Management

```powershell
npx skills list                                     # installed skills
npx skills find react                               # search for skills
npx skills add vercel-labs/agent-skills             # add a pack
npx skills add vercel/next.js                       # add Next.js skills
npx skills add obra/superpowers                     # add superpowers
npx skills add anthropics/skills                    # add Anthropic skills
npx skills update                                   # update all to latest
npx skills remove <skill-name>                      # remove one
npx skills experimental_install                     # restore everything from skills-lock.json (new machine)
npm install ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google zod     # target AI SDK stack (not installed today — §1.10)
npm outdated ai @ai-sdk/openai @ai-sdk/anthropic @ai-sdk/google zod    # check versions after install
```

### 4.5 Git, Ports, and Safety Checks

```powershell
git status --short                                  # always review before staging
git check-ignore -v .cursor/mcp.json .env.sentry-build-plugin graphify-out/graph.json   # each must print a .gitignore rule
git ls-files .cursor/mcp.json .env.sentry-build-plugin graphify-out                      # must print NOTHING (not tracked)
git diff --cached --stat                            # review what's staged
Get-NetTCPConnection -LocalPort 3000,8288,5555 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort,OwningProcess   # what's running
Get-NetTCPConnection -LocalPort 3000,8288,5555 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }   # stop dev servers
npx vercel --version                                # confirm Vercel CLI works
npx vercel env ls production                        # list production env var NAMES
```

---

## 5. SOP: 6-Step Production Release to Vercel

**Target:** `https://crm.standard.bio` (Vercel project `sb-crm`). Confirm the live alias first — the Outlook manifest and `.env.example` reference `https://sb-crm-seven.vercel.app` (§0 #6).
**Branches:** work on `develop`; CI (`.github/workflows/ci.yml`) runs on push/PR to `main` and `develop`.

### Step 1 — Stop all local dev servers

Dev servers hold locks on `.next/` and `node_modules`, and a running `inngest-cli dev` can retry events against stale code.

```powershell
Get-NetTCPConnection -LocalPort 3000,8288,5555 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
```

### Step 2 — Confirm `.gitignore` protects secrets and generated files

```powershell
git check-ignore -v .cursor/mcp.json .env.sentry-build-plugin graphify-out/graph.json
git ls-files .cursor/mcp.json .env.sentry-build-plugin graphify-out
```

- First command: **three** lines, each citing a `.gitignore` rule (`.cursor/mcp.json`, `.env.sentry-build-plugin`, `graphify-out/`).
- Second command: **no output**. If anything prints, it is tracked — `git rm --cached <path>`, rotate any secret it contained, then continue.
- Also confirmed ignored: `.env*` (except `.env.example`), `.vercel`, `/src/generated/prisma`, `/.next/`, `/test-results/`, `/playwright-report/`.

### Step 3 — Verify, then stage deliberately

```powershell
npx tsc --noEmit
npm run lint
npm run build
npm run test:e2e
git status --short
git add <specific paths>
git diff --cached --stat
```

- **Do not `git add -A` blindly.** The working tree contains untracked non-product files (e.g. `.agents/`, `skills-lock.json`, `tsc-result.txt`, `prisma-*-output.txt`, `tmp-sql.sql`, `brief.json`, `company.json`, PDFs/docx). Stage only what belongs in the release.
- New env vars → add placeholder to `.env.example`. New migrations in `prisma/migrations/` must be backwards-compatible with the code currently running in production.
- If `outlook/relationship-card/manifest.xml` changed, `<Version>` must be bumped (§6.4).

### Step 4 — Commit through the Husky pre-commit gate

```powershell
git commit -m "<type>: <concise why>"
```

Husky runs `npx lint-staged` (eslint --fix on staged files) then `npx tsc --noEmit`. If blocked, fix the reported error and recommit (§6.2). **Never `--no-verify`.** After the commit succeeds, the `post-commit` hook rebuilds the Graphify graph in the background.

### Step 5 — Push to `develop` and wait for green CI

```powershell
git push origin develop
gh run list --branch develop --limit 3
```

CI steps: `npm ci` → `prisma generate` → `tsc --noEmit` → `prisma migrate deploy` → SmartDocs filing harness → `npm run build` → Playwright smoke. Don't deploy on red CI. (Merge `develop` → `main` per team practice if your Vercel Git integration also builds from `main`.)

### Step 6 — Migrate, deploy, verify

```powershell
npm run db:migrate         # ONLY if prisma/migrations changed; run with the PRODUCTION DIRECT_URL in the environment
npx vercel deploy --prod
```

> Never run `prisma migrate dev` or `db push` against production. Apply migrations before (or as part of) the deploy, and keep them backwards-compatible.

**Post-deploy verification (first 15–30 minutes):**

1. Sign in with Microsoft SSO succeeds on the production host.
2. Core surfaces load: Companies, Contacts, an Opportunity, home/Attention.
3. Vercel → Project → Cron Jobs shows `m365-mail-sync` (`*/10 * * * *`), `m365-renew-subscriptions` (`0 */12 * * *`), `tender-ingest` (`0 6 * * *`); no 401s (they need `CRON_SECRET`).
4. Inngest dashboard: re-sync the app at `<production origin>/api/inngest`; send `crm/healthcheck.requested` and confirm the run.
5. Sentry (`standard-bio-as` / `javascript-nextjs`): new release appears with source maps; no new unresolved issues (use the Sentry MCP prompt in §3.5).
6. Outlook add-in task pane (`/outlook-addin`) loads and the iframe origin matches the manifest host.

**Rollback:** Vercel → Deployments → promote the previous good deployment, or `npx vercel rollback`. If a migration was applied, ship a forward-fix migration — never edit applied migrations.

### Required Vercel environment variables (Production)

Verify **names** with `npx vercel env ls production`; never paste values into chat or commits.

| Variable | Purpose | Notes |
|----------|---------|-------|
| `DATABASE_URL`, `DIRECT_URL` | Prisma / Postgres | `prisma.config.ts` prefers `DIRECT_URL` |
| `AUTH_SECRET` | Auth.js | Required |
| `AUTH_URL` | Auth.js origin | Must equal public origin, no trailing slash |
| `NEXT_PUBLIC_APP_URL` | OAuth redirects, add-in, deep links | Same origin |
| `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID` | Entra SSO | Tenant: `organizations` |
| `TOKEN_ENCRYPTION_SECRET` | AES-256 token encryption | Required in production (64 hex chars) |
| `CRON_SECRET` | Protects `/api/cron/*` | Bearer or `x-cron-secret` |
| `INTERNAL_DOMAINS` | Internal email domains (privacy classification) | e.g. `standard.bio,…` |
| **`SENTRY_AUTH_TOKEN`** | Source-map upload at build | Secret; local copy is in `.env.sentry-build-plugin` |
| **`INNGEST_SIGNING_KEY`** | Verifies Inngest → `/api/inngest` requests | Required for production sync |
| **`INNGEST_EVENT_KEY`** | Lets the app `inngest.send(...)` events | Required once any route sends events |
| **`ANTHROPIC_API_KEY`** (+ optional `ANTHROPIC_INTAKE_MODEL`) | Card intake scan | |
| **`OPENAI_API_KEY`** (+ optional `OPENAI_BASE_URL`, `OPENAI_SMARTASSIST_MODEL`, `OPENAI_TENDER_MODEL`) | SmartAssist, tender classifier | |
| `GOOGLE_GENERATIVE_AI_API_KEY` | `@ai-sdk/google` default key name | Only after the AI SDK is adopted (§1.10) |
| SharePoint / Graph / tender-source keys | `SHAREPOINT_*`, `M365_OAUTH_SCOPES`, `DOFFIN_API_KEY`, `SAM_GOV_API_KEY`, `MERCELL_*`, register keys | As applicable (see `.env.example`) |

Entra redirect URIs (Web platform): `{NEXT_PUBLIC_APP_URL}/api/auth/callback/azure-ad` and `{NEXT_PUBLIC_APP_URL}/api/auth/m365/callback`.

---

## 6. Troubleshooting & Recovery Runbook

### 6.1 `graphify` is not recognized in PowerShell

**Cause:** `C:\Users\aar20\AppData\Roaming\Python\Python315\Scripts` is not on `PATH`.

Immediate (this session only):

```powershell
$env:Path += ";C:\Users\aar20\AppData\Roaming\Python\Python315\Scripts"; graphify --version
```

Permanent (user PATH, idempotent), then open a new terminal:

```powershell
$d="C:\Users\aar20\AppData\Roaming\Python\Python315\Scripts"; $p=[Environment]::GetEnvironmentVariable("Path","User"); if(($p -split ';') -notcontains $d){ [Environment]::SetEnvironmentVariable("Path","$p;$d","User") }
```

No-PATH fallback: call the full path (§4.3) — `.cursor/mcp.json` already uses the full path for `graphify-mcp.exe`. If the exe is missing: `pip install --user graphifyy`. If the MCP shows no tools, check that `graphify-out\graph.json` exists: `& "C:\Users\aar20\AppData\Roaming\Python\Python315\Scripts\graphify.exe" extract . --code-only`, then toggle the server in *Cursor Settings → MCP*.

### 6.2 Husky pre-commit blocks a commit

1. **Read the output top-down.** Two stages, in order:
   - `lint-staged` / `eslint --fix` failed → the message is `path:line:col  error  rule-name`.
   - `tsc --noEmit` failed → `src/…(line,col): error TSxxxx: …`.
2. Reproduce and fix in isolation:

```powershell
npx eslint --fix src\path\to\file.tsx
npx tsc --noEmit
```

3. `eslint --fix` modifies files: re-stage them (`git add <file>`), then commit again.
4. `tsc` is **whole-repo**; the error may be in a file you didn't touch (e.g. a type changed by your edit, or a pre-existing break). Fix the cause — use `graphify explain "<symbol>"` to find dependents.
5. **Never `git commit --no-verify`** and never delete `.husky/pre-commit`. If a rule is genuinely wrong, fix the rule in `eslint.config.mjs` in a separate, reviewed change.
6. Hook doesn't run at all? `git config core.hooksPath` must print `.husky/_`; if not, run `npm run prepare`.

### 6.3 Recreate `.cursor/mcp.json` on a new machine

`.cursor/mcp.json` is git-ignored (contains secrets), so a clone will not have it.

```powershell
git clone https://github.com/MatsBorgersenSB/SB_CRM.git; cd SB_CRM; npm ci; npx skills experimental_install; pip install --user graphifyy; & "$env:APPDATA\Python\Python315\Scripts\graphify.exe" extract . --code-only
```

(Adjust the Python version folder if it differs: `Get-Command graphify-mcp -ErrorAction SilentlyContinue` or `Get-ChildItem "$env:APPDATA\Python\*\Scripts\graphify*.exe"`.)

Create `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "context7": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@upstash/context7-mcp@latest"]
    },
    "playwright": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "@playwright/mcp@latest"]
    },
    "graphify": {
      "command": "C:\\Users\\aar20\\AppData\\Roaming\\Python\\Python315\\Scripts\\graphify-mcp.exe",
      "args": ["C:\\Users\\aar20\\SB_CRM\\graphify-out\\graph.json"]
    },
    "postgres": {
      "command": "cmd",
      "args": [
        "/c", "npx", "-y", "@modelcontextprotocol/server-postgres",
        "postgresql://<READONLY_USER>:<PASSWORD>@<HOST>/<DB>?sslmode=require"
      ]
    },
    "Sentry": {
      "url": "https://mcp.sentry.dev/mcp/standard-bio-as/javascript-nextjs"
    }
  }
}
```

Then: restart Cursor → *Settings → MCP* → confirm all five servers are green → authenticate **Sentry** in the browser prompt. The `cmd /c npx` wrapper is required on Windows.

**Use a read-only Postgres role** (run once as the DB owner, e.g. in the Neon SQL editor; replace placeholders):

```sql
CREATE ROLE crm_readonly LOGIN PASSWORD '<generate-a-long-random-password>';
GRANT CONNECT ON DATABASE <db> TO crm_readonly;
GRANT USAGE ON SCHEMA public TO crm_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO crm_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO crm_readonly;
```

Point the MCP at a dev/staging DB or this role, never the owner credential. If the current owner string was ever exposed, rotate it.

### 6.4 Update the Outlook Add-in manifest (`<Version>` changes)

File: `outlook/relationship-card/manifest.xml` — current `<Version>1.6.1.0</Version>`; `<Id>6f3c8b2a-9d4e-4a1c-b7e2-a1b2c3d4e5f6</Id>`.

1. **Bump `<Version>`** (higher than the deployed one, four-part e.g. `1.6.2.0`). Microsoft ignores updates with an unchanged/lower version. **Never change `<Id>`** — it would install as a different add-in.
2. Keep every `SourceLocation` / `bt:Url` on the production host (currently `https://sb-crm-seven.vercel.app/outlook-addin`, `…?mode=compose`, `…/outlook/meeting-briefing`). Both manifest blocks (V1_0 and the nested V1_1) must stay consistent. Keep `AppDomains` for Microsoft login hosts.
3. Validate: `npx office-addin-manifest validate outlook\relationship-card\manifest.xml`
4. **Deploy the web app first** (§5) so the new task panes exist at the manifest URLs.
5. Update in Microsoft 365: **admin center → Settings → Integrated apps → select SmartCRM for Outlook → Update/Upload the new `manifest.xml`** (centralized deployment, preferred). Propagation to clients is not instant (can take hours; Microsoft cites up to 24 h). Restart Outlook to speed it up.
6. Sideloaded copies (dev): Outlook → *Get Add-ins → My add-ins → Custom add-ins* → remove the old one → **Add from file** → upload the new manifest.
7. Verify in the task pane DevTools / Network that the iframe origin is the intended host, and that a new Sentry session shows no add-in errors.
8. Update `outlook/README.md` (it still says 1.4.1.0) and keep a backup copy of the previous manifest if you want a rollback (precedent: `manifest.v1.3.2.backup.xml`).

If the **canonical host changes** (e.g. to `crm.standard.bio`): change all manifest URLs + `AppDomains` as needed, `AUTH_URL`, `NEXT_PUBLIC_APP_URL`, and both Entra redirect URIs together, then bump `<Version>`.

### 6.5 Next.js multiple-lockfile / Turbopack root warning

**Cause (confirmed on this machine):** `C:\Users\aar20\package-lock.json` and `C:\Users\aar20\package.json` exist in the parent folder, so Next infers the wrong workspace root ("We detected multiple lockfiles"). `next.config.ts` already sets `turbopack: { root: process.cwd() }`, which only works when you start Next **from `C:\Users\aar20\SB_CRM`**.

```powershell
Get-ChildItem C:\Users\aar20 -Filter "package*.json" -File | Select-Object FullName,Length,LastWriteTime
Get-ChildItem C:\Users\aar20 -Filter "*lock*" -File -Force | Select-Object FullName
```

Fix (pick one):

- **Preferred:** rename the stray parent files if you don't use them — `Rename-Item C:\Users\aar20\package-lock.json package-lock.json.bak` (and `package.json` if it's an accidental `npm install` at the home directory). Check first that nothing else relies on them.
- Always launch from the repo root: `Set-Location C:\Users\aar20\SB_CRM; npm run dev`.
- Don't "fix" it by adding `outputFileTracingRoot` or deleting the repo's own `package-lock.json`.

### 6.6 Other quick fixes

| Symptom | Check / fix |
|---------|-------------|
| Agent explores files blindly | Graphify rule not applied — run `graphify query` first; ensure `.cursor/rules/graphify.mdc` exists |
| Context7 / Playwright MCP won't start | Node/`npx` available? Restart Cursor; read *Settings → MCP* logs; keep the `cmd /c` wrapper |
| E2E fails on DB access | Run with `E2E=1` semantics — config sets it automatically; smoke tests are designed to run without Postgres |
| SSO redirect error on Vercel | `AUTH_URL` / `NEXT_PUBLIC_APP_URL` match the origin; Entra redirect URI is **Web** platform |
| Build fails: Prisma client missing | `npx prisma generate`; `DATABASE_URL` set? (`postinstall` and `build` both run generate) |
| Crons return 401 | `CRON_SECRET` set in Vercel; passed as Bearer / `x-cron-secret` |
| Sentry client errors not arriving | `/monitoring` must remain bypassed in `src/middleware.ts` (allow-list **and** matcher); ad-blockers handled by the tunnel |
| Inngest functions not appearing | `/api/inngest` bypass intact; `INNGEST_SIGNING_KEY` / `INNGEST_EVENT_KEY` set; re-sync app in Inngest dashboard; new functions added to the exported `functions` array |
| Unauthenticated `/api/*` returns HTML | It shouldn't — middleware returns `{ error: "Unauthorized", code: "AUTH_REQUIRED" }` with 401; check the matcher |
| `/static/*` returns 410 | Intentional (ghost CRA chunks). Use `/outlook-addin` |
| Knip flags Next.js routes | Add `entry` patterns in a new `knip.json` |
| Graphify graph shrank after refactor | `graphify update . --force` (use only after deliberate deletions) |

---

## 7. Related Documents

- `.cursorrules`, `.cursor/rules/smartcrm-north-star.mdc`, `.cursor/rules/smartassist-constitution.mdc`, `.cursor/rules/graphify.mdc`, `.cursor/rules/token-saver.mdc`
- `AGENTS.md` (Next.js breaking-changes note), `CLAUDE.md`
- `outlook/README.md`, `outlook/relationship-card/VALIDATION-REPORT.md`
- `docs/` FS/AD specifications (index in `.cursorrules`)
- `.github/workflows/ci.yml`, `vercel.json`, `.env.example`, `playwright.config.ts`, `prisma.config.ts`
