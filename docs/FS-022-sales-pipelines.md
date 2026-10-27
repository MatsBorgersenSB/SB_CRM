# FS-022 – Sales Pipelines (Project Sales & Offer Sales)

## Document Information

| Property | Value |
|----------|-------|
| Specification ID | FS-022 |
| Title | Sales Pipelines — evidence-based stages, tiles view, drag-and-drop |
| Status | Draft — for review |
| Priority | High |
| Category | Opportunities · Pipeline · SmartAssist |
| Version | 0.2 |
| Related | FS-005 Opportunity Workspace · FS-013 Active Operating Loop · FS-015 Project Relationships · AD-001 Filter Transparency |

---

## 1. Problem Statement

Today the pipeline is a single fixed enum (`PipelineStatus`, `src/types/pipeline.ts`) with two structural problems:

1. **One shape for every deal.** Stages such as *Feedstock Analysis* and *Reactor Manufacturing* only describe plant/reactor projects. Product and consultancy sales do not fit.
2. **Selling and delivering are mixed.** *Won → Reactor Manufacturing → Site Installation → Live Production → Scheduled Maintenance* sit in the same list, duplicating the `Project` lifecycle (Planning → Execution → Commissioning → Operational → Support → Closed). This violates single source of truth.

There is also no board ("tiles") view and no way to move a deal between stages by drag-and-drop.

A stage chosen by the seller's opinion ("feels like 60%") does not increase organizational knowledge. Stages must reflect what we **know**.

## 2. Business Goals

- Treat **project sales** (long, multi-stakeholder, gated by funding/permitting/technical readiness) differently from **offer sales** (product and consultancy: shorter, more transactional).
- Make stage a statement of evidence, not opinion.
- Let the seller see and move deals visually (tiles) while SmartAssist explains whether the move is earned.
- Stop duplicating delivery state inside the sales pipeline.
- Forecast honestly: unknown until learned from our own history.

## 3. User Stories

- As a seller, I switch between **List** and **Tiles** and my choice is remembered.
- As a seller, I drag a deal to the next stage and the change is saved immediately.
- As a seller, when I move a deal early, I see exactly what is still unknown — not a blocking error.
- As a project seller, I see at a glance which of the eight project conditions (feedstock, site, funding, offtake, decision maker, sponsor, technology fit, permitting) is still missing on a deal.
- As a seller, I record a short reason when a deal is lost or skips stages.
- As a manager, I see forecast value that is labelled unknown until real history supports a win rate.
- As a user, when a deal is Won I land on its Project, not on a fake extra sales stage.

## 4. Functional Requirements

### 4.1 Pipeline templates (data, not enum)

A **pipeline template** defines, per deal type:

| Field | Meaning |
|-------|---------|
| `id` | Stable identifier (`project-sales`, `offer-sales`) |
| `stages[]` | Ordered stages |
| `stage.id` / `label` | Stable id + human label |
| `stage.exitCriteria[]` | Evidence that earns progression to the next stage |
| `stage.typicalDays` | Expected duration; used for stall detection (unknown if not set) |
| `stage.kind` | `open` · `won` · `lost` |

Adding a pipeline is configuration, not a code change to a shared enum.

### 4.2 Pipelines v1

**Project Sales (development / plant projects)** — sales motion `system`

A project deal is a plant sale. Its depth of investigation is the full 16-question Opportunity Understanding model (`src/types/opportunity-understanding.ts`), already scoped per deal by `src/lib/sales-motion.ts`.

| # | Stage | Exit evidence (examples) |
|---|-------|--------------------------|
| 1 | Identified | Company classified sell-to; project concept known |
| 2 | **Qualified** | Viability assessed (existing qualification engine); decision maker identified |
| 3 | Validation (FEL-2) | Feedstock, site and technology analysis done; assumptions validated |
| 4 | Proposal | Commercial baseline sent; funding and offtake route understood |
| 5 | Negotiation | Terms and contract under discussion; permitting path established |
| 6 | **Won** | All eight project conditions confirmed → recommends creating/linking a `Project` |
| – | Lost | Structured loss reason recorded |

**The eight project conditions — no project without all of them.** In an investigation, if any key dimension is missing there is no project. The conditions are the lens through which the existing understanding fields are read; they are not a second data store. Source of truth: `src/lib/project-conditions.ts`.

| Condition | Question | Confirmed by (understanding fields) |
|-----------|----------|-------------------------------------|
| Feedstock | Is there enough feedstock of known quality? | `feedstock_volume` + `feedstock_quality` |
| Site and utilities | Is there a site that can supply what the plant needs? | `site_readiness` + `utilities` |
| Funding | Can the customer pay for it? | `funding_source` + `budget` |
| Offtake | Who buys or uses what the plant produces? | `offtake_strategy` |
| Decision maker | Who decides, and who holds the budget? | `decision_maker` + `economic_buyer` |
| Sponsor | Who inside the customer is pushing this? | roster member with a sponsor/champion role, or captured `stakeholder_map` |
| Technology fit | Does our technology fit this application? | `technical_fit` |
| Permitting | Is there a realistic path to a permit? | `permitting` |

Each condition is `confirmed`, `partial` (some evidence, named gaps remain) or `unknown`. A condition is never `confirmed` by default.

**Evidence rule (Reality First).** A condition is confirmed only by what a person recorded: a captured answer or a confirmed finding. Values inferred from deal fields — the feedstock type on the record, the deal value, the design capacity — do **not** confirm anything. The only derived evidence accepted is the opportunity roster (named people with roles).

**Gating.**
- **Won (project sales) is a hard gate: all eight conditions must be confirmed.** The board refuses the drop and shows what is missing, with the capture action beside each gap. Permitting is not a soft risk — no permit, no project.
- **All earlier stages are guidance only.** The user may move early; SmartAssist shows which conditions are still open and why each matters (impact), per §4.7.
- **Lost is never gated.**
- The same conditions drive the fatal-flaw alerts (`no_feedstock`, `no_site`, `no_financing`, `no_offtake`, `no_decision_maker`, `no_sponsor`, `technology_mismatch`, `unrealistic_permitting`). A flaw is raised when the evidence is missing — never from a score guess or a record-field heuristic.

Offer Sales (below) has no project conditions.
**Offer Sales (product and consultancy)** — sales motions `product` and `consulting`

Lean investigation: product asks buyer, quantity or size, and needed-by date; consultancy asks buyer, scope, fee/budget and needed-by date. Feedstock, site, permitting, offtake and funding questions are never asked (already enforced by the sales motion profile).
| # | Stage | Exit evidence (examples) |
|---|-------|--------------------------|
| 1 | Interest | Contact and need identified |
| 2 | Needs understood | Customer need confirmed (product: spec/volume; consultancy: scope) |
| 3 | Quote / Proposal | Quote or SOW sent |
| 4 | Negotiation | Terms under discussion |
| 5 | Won | Order/SOW accepted |
| – | Lost | Structured loss reason recorded |

Offer Sales is **one pipeline** tagged by offering type (Product · Consultancy). Exit criteria and tile content may vary by tag. Split into two pipelines only if criteria diverge materially after real use (see §11).

### 4.3 Pipeline selection

- The pipeline follows the **sales motion** resolved from the offerings in scope (`resolveSalesMotion`): `system` → Project Sales; `product` and `consulting` → Offer Sales.
- Offering scope that contains the reactor or a complete system is always a project sale, even if it also includes products or services.
- No offerings selected → **unclassified**: the deal stays on Project Sales for investigation purposes, but nothing is invented; SmartAssist recommends defining the scope.
- Pipeline can be changed with a user decision.
- Create Opportunity remains gated by `isOpportunityEligibleCompany` (sell-to roles only).
### 4.4 Selling ends at Won

- Sales pipelines end at **Won** or **Lost**.
- Delivery/production statuses (*Reactor Manufacturing, Site Installation, Commissioning Phase, Live Production, Scheduled Maintenance*) are removed from the sales pipeline. Their meaning belongs to `Project` stages.
- On Won of a project-sales deal, SmartAssist **recommends** creating or linking a Project; it does not auto-create it.

### 4.5 List / Tiles toggle

- Opportunities screen has a **List | Tiles** toggle. Default: List. Choice persisted per user.
- Both views render the same filtered dataset. View is a renderer, not a different data source.
- A pipeline selector scopes the board to one pipeline at a time.

### 4.6 Tiles (board) view

- One column per open stage; Won and Lost shown as collapsed end zones.
- Column header: stage name, deal count, total value (value shown as unknown if any value is unknown — never as a silent partial sum).
- **Tile content (Michelin):** deal + company · value · next action *or* top blocker (with impact) · last touch / momentum.
- Project-sales tiles additionally show project-condition progress (e.g. 5 of 8 confirmed) and, when relevant, the weakest condition.
- No scores, rule IDs, or confidence percentages on the tile.
- Tile is a link to `/opportunities/{dealId}` (relationship-first navigation).

### 4.7 Drag-and-drop

- Dropping a tile in another column calls the existing `PATCH /api/deals/[id]` (audit action `STAGE_CHANGED`).
- Optimistic: the tile moves immediately; on failure it snaps back with a short message.
- Only roles allowed by `canUpdateDealStage` can drag; others get a read-only board.
- Keyboard accessible (move between stages without a mouse).
- **Reason prompts** (small, inline): required for **Lost**; required when **skipping stages**; optional otherwise. Forward single-step moves have no friction.
- **Moving early is allowed** for every stage except **Won on a project deal**, which requires all eight project conditions (§4.2). The system shows which exit criteria are not yet evidenced; the user decides.
- **Blocked drop (Won):** the tile returns to its column and a compact panel lists each unconfirmed condition, why it matters, and a capture action. Moving a deal to Won is never blocked for Offer Sales.

### 4.8 Stall and regression signals

- A deal exceeding the stage's `typicalDays` is flagged with impact ("quiet for N days — risk of losing momentum").
- Weakened evidence (decision maker left, permit refused, funding no longer confirmed) is flagged with impact.
- If `typicalDays` is not set, no stall is invented.

### 4.9 Forecasting

- Win probability per stage is **unknown** until enough closed deals exist for that pipeline.
- When history is sufficient, SmartCRM calibrates stage win rates from our own data per pipeline.
- Forecast is labelled with how it was derived. No hard-coded percentages.

### 4.10 Migration from `PipelineStatus`

| Current value | New |
|---------------|-----|
| Prospecting | Project Sales · Identified |
| Feedstock Analysis | Project Sales · Validation |
| Contract Negotiation | Project Sales · Negotiation |
| Won | Won |
| Reactor Manufacturing · Site Installation · Commissioning Phase | Won + linked Project stage (Execution/Commissioning) |
| Live Production · Scheduled Maintenance | Won + linked Project stage (Operational/Support) |

- Existing deals default to Project Sales (they are plant/reactor deals today). Reclassification to Offer Sales is a user action.
- The SharePoint pipeline schema is documented as frozen: migration needs an explicit mapping layer and backfill plan before any column change. No data is dropped.
- Deals whose delivery-stage Project does not yet exist are flagged "Project not linked" — not auto-created.

## 5. SmartAssist Behaviour

- **Observe before asking:** evaluate exit criteria from existing relationships, activities, emails, documents, SmartDocs.
- **Recommend, never move:** SmartAssist may say "ready for Proposal — 4 of 4 criteria evidenced" or "not yet — decision maker unknown". It never changes a stage itself.
- **Explain impact:** every flag states what is happening, why it matters, what next.
- **Qualified gate:** for project sales, recommend validating viability before investment in Validation/Proposal work.
- **Name the missing condition:** "Not ready for Won — permitting and funding not confirmed. No permit means no project." Always with the next capture action.
- **Posture:** no pipeline actions for buy-from, collaborate, watch/fund, or unclassified companies; recommend classify.

## 6. UX Design

- 3-second test: *What am I looking at?* (pipeline + stage counts) · *What matters?* (blocked/stalled tiles) · *What next?* (next action on tile).
- One hero per surface: the board. Filters and toggle are quiet chrome.
- Wide layout; columns use available width. Horizontal scroll only when stages exceed width.
- **AD-001:** when filters hide deals, show "N deals hidden by filters" above the board with a way to review them.
- Tiles are compact; detail lives in the opportunity workspace (FS-005).
- Respect `prefers-reduced-motion` for tile movement.

## 7. Reality First Principle

- No invented stages, probabilities, values, or gates. Unknown stays unknown.
- Empty columns stay empty.
- Project conditions default to `unknown`, never `confirmed`. Inferred record values never confirm a condition.
- A stage move never fabricates evidence.

## 8. Persistence / Ownership Rules

- The deal is the single record; pipeline and stage are attributes of the deal. No parallel stage store.
- Delivery state is owned by the `Project`, not the deal.
- Stage changes are audited (`STAGE_CHANGED`) with actor, from/to, reason (when given).
- Pipeline templates are configuration owned by admins; changing a template does not silently rewrite existing deals.
- View preference (List/Tiles) is per-user.
- Contacts, Companies, Relationships, Stakeholders are referenced by ID — never duplicated on tiles or deals.

## 9. Acceptance Criteria

1. Opportunities screen offers List | Tiles; selection persists per user; both show the same filtered deals.
2. Board shows one pipeline at a time; Project Sales and Offer Sales have distinct stages.
3. Tile shows only: deal/company, value, next action or blocker with impact, last touch (+ project-condition progress for project sales).
4. Dragging a tile updates the stage via `PATCH /api/deals/[id]`, audited as `STAGE_CHANGED`; failure reverts the tile and informs the user.
5. Users without `canUpdateDealStage` cannot drag.
6. Moving to Lost requires a reason; skipping stages requires a reason; single-step forward moves do not.
7. Early moves are permitted and show unmet exit criteria without blocking — except Won on a project deal, which requires all eight project conditions confirmed (permitting included).
8. SmartAssist never changes a stage automatically.
9. Delivery/production statuses no longer appear as sales stages; migrated deals show a linked/unlinked Project indicator.
10. Column value totals show *unknown* when any contributing value is unknown.
11. Filtered-out deals are disclosed per AD-001.
12. Create Opportunity respects `isOpportunityEligibleCompany`.
13. Win probability is unknown until sufficient history; no hard-coded percentages.
14. Board is keyboard accessible.
15. Project conditions are evaluated only for system/unclassified deals; product and consultancy deals never show or are gated by them.
16. A condition is confirmed only by captured evidence or roster; record-field inference never confirms (covered by `sales-motion.test.ts`).
17. Fatal-flaw alerts for the eight conditions are raised from missing evidence, not from score or record-field heuristics.

## 10. Phases

1. **Spec + sign-off** of stages and exit criteria (this document).
2. **Model:** pipeline templates, migration mapping layer, Project link on Won.
3. **Views:** List | Tiles toggle, read-only board, AD-001 disclosure.
4. **Interaction:** drag-and-drop, optimistic update, reason prompts, permissions.
5. **Intelligence:** exit-criteria evaluation, project-condition evaluation (`project-conditions.ts` — built), "ready for next stage", stall/regression flags.
6. **Forecast:** calibrated stage win rates from history.

## 11. Out of Scope (v1) / Open Decisions

**Decisions made (27 Oct 2026)**
- Stage names and exit criteria in §4.2 accepted as the v1 baseline; refine with real use.
- Product and Consultancy stay in **one** Offer Sales pipeline (tagged by offering type).
- Typical durations per stage stay **unknown** until measured.
- **All eight project conditions block Won** on project deals, permitting included ("no permit, no project"). Earlier stages are guidance only.
- Weak flaw heuristics (e.g. `no_site` via `FileLeafRef`) replaced by evidence-based conditions before gating on them.

**Proposed — awaiting confirmation**
- **Required vs optional exit criteria:** each criterion is marked *required* or *optional*. Only required criteria decide whether SmartAssist says "ready for next stage"; optional ones are shown but never hold a deal back. Neither type blocks a move; the only hard gate is Won on a project deal (the eight project conditions, §4.2). Keep 2–3 required criteria per stage.
- **Loss-reason taxonomy** (pick one, optional note, optional competitor link to Company Registry): Chose competitor · Funding not secured · Permitting or regulatory blocked · Technical fit · Price or commercial terms · Project postponed or cancelled · Customer went silent · We declined · Don't know. "Don't know" is always allowed (Reality First).
- **Won → Project (project sales):** *recommend, not require.* On Won, SmartAssist recommends creating or linking a Project. If none is linked, the deal carries a persistent "Project not linked" attention item until linked or dismissed with a reason. Offer Sales: link is optional and not recommended by default.

**Still open**
- Final required/optional marking per criterion (set during build with real examples).

**Out of scope for v1**
- Custom per-user pipelines.
- Bulk multi-select drag.
- Automatic stage advancement.
- Cross-pipeline conversion workflows beyond manual reclassification.
