# FS-010 Growth & Expansion Intelligence

## Document Information

| Property | Value |
| :--- | :--- |
| Specification ID | FS-010 |
| Name | Growth & Expansion Intelligence |
| Status | Approved |
| Owner | SmartCRM |
| Category | SmartAssist & Commercial Growth |
| Version | 1.1 |
| Related | FS-002 Contact Registry · FS-003 Company Registry · FS-004 Relationship Intelligence · FS-005 Opportunity Workspace · FS-008 Meeting Intelligence · FS-009 Email & Interaction Intelligence |
| Governing Standards | SmartCRM Constitution v6.0 · SmartAssist Constitution · SmartCRM North Star · AD-001 Filter Transparency |

---

## 1. Purpose

Account growth is lost when commercial teams cannot see **who is healthy enough to expand**, **which product/service categories remain un-pitched**, and **which signals justify upsell, cross-sell, renewal, or churn intervention**.

**Growth & Expansion Intelligence** delivers three linked capabilities:

1. **Account Health Index** — a 0–100 composite score from email sentiment, meeting frequency, and deal velocity  
2. **Whitespace Matrix** — un-pitched product/service categories across accounts  
3. **Expansion Signals** — automated detection of `upsell`, `cross_sell`, `renewal_risk`, and `churn_risk`

All advisory outputs enforce **AD-001 Filter Transparency** and mandatory **4-Part Explainability**. SmartAssist proposes; users decide (FR-016).

---

## 2. Core Principles & Guardrails

1. **Reality First:** Health indexes and expansion signals are derived from observed CRM evidence (emails, meetings, opportunities). SmartAssist shall not invent accounts, deals, or buying intent.
2. **User Sovereignty (FR-016):** Signals are proposed (`detected`). Status transitions to `actioned` or `dismissed` require explicit user action. SmartAssist never auto-creates opportunities or changes opportunity stage from an expansion signal.
3. **4-Part Explainability (FR-015) — mandatory:** Every `ExpansionSignal` and every Whitespace Matrix recommendation shall store and/or display:
   - **Observation** — what SmartAssist detected  
   - **Reasoning** — why it matters commercially  
   - **Recommended Action** — what step to take next  
   - **Expected Outcome** — expected deal / account impact  
4. **AD-001 Filter Transparency — mandatory:** Every filtered collection of health indexes, whitespace cells/rows, or expansion signals shall show `Showing {filtered} of {total} {Label}`, active filter chips (`Label: Value`), per-chip remove, and Clear All when ≥2 filters are active. Filtering shall never live only inside dropdown labels.
5. **Privacy alignment with FS-009:** Account Health Index sentiment inputs prefer **external** deal mail by default (internal-only excluded unless the user opts into all domains).
6. **Composition over duplication:** Growth intelligence consumes Company (`FS-003`), Opportunity (`FS-005`), Meeting (`FS-008`), and Email (`FS-009`) facts. It does not duplicate contact or opportunity registries.

---

## 3. Capabilities

### 3.1 Account Health Index (0–100)

An `AccountHealthRecord` stores the latest computed **Account Health Index** for a company (`Company.healthRecords`).

| Component | Weight (guidance) | Inputs |
| :--- | :---: | :--- |
| **Engagement score** | ~35% | Meeting frequency (FS-008) over rolling windows; outbound/inbound cadence |
| **Sentiment score** | ~35% | Aggregated email sentiment grades (FS-009), external-party threads preferred |
| **Deal velocity** | ~30% | Stage progression rate, open deal value momentum, days-in-stage vs cohort |

**Composite `healthScore` (Account Health Index)** = weighted blend of engagement, sentiment, and velocity sub-scores, clamped to **0–100**.

| Band | Range | Meaning |
| :--- | :---: | :--- |
| Strong | 75–100 | Expansion-ready; prioritize Whitespace Matrix and upsell |
| Stable | 50–74 | Healthy enough to nurture; watch velocity |
| At risk | 25–49 | Engagement or sentiment declining; renewal/churn watch |
| Critical | 0–24 | Immediate commercial attention |

Scores are **advisory**. They do not auto-archive companies or change opportunity status.

### 3.2 Whitespace Matrix

The **Whitespace Matrix** identifies **un-pitched product/service categories** (Standard Bio offerings / commercial packages) across accounts—categories not yet represented on open opportunities, or weakly covered relative to industry peers.

| Axis | Meaning |
| :--- | :--- |
| Rows | Accounts (`Company`) in portfolio scope |
| Columns | Product / service categories (offerings) |
| Cell | Pitched / partial / un-pitched + optional signal link |

Whitespace is primarily a **computed view** (may be ephemeral or cached). Each actionable cell presented in UI shall expose 4-part explainability when SmartAssist recommends acting on the gap. Filtered matrix views must satisfy AD-001 (`Showing X of Y Whitespace Gaps` or equivalent entity label).

### 3.3 Expansion Signals

Persisted `ExpansionSignal` records capture automated detection of growth and risk triggers.

| `SignalType` | Meaning |
| :--- | :--- |
| `upsell` | Deeper adoption or higher capacity of an existing offering |
| `cross_sell` | Adjacent / un-pitched category from the Whitespace Matrix |
| `renewal_risk` | Contract / relationship renewal under threat |
| `churn_risk` | Disengagement or negative sentiment suggesting attrition |

| `SignalStatus` | Meaning |
| :--- | :--- |
| `detected` | SmartAssist proposed; awaiting user review (**default**) |
| `reviewing` | User opened / is evaluating |
| `actioned` | User accepted and took a commercial step |
| `dismissed` | User rejected the signal |

`updatedAt` tracks user status changes and review activity.

---

## 4. Data Model

### 4.1 Prisma (authoritative)

```prisma
enum SignalType {
  upsell
  cross_sell
  renewal_risk
  churn_risk
}

enum SignalStatus {
  detected
  reviewing
  actioned
  dismissed
}

model AccountHealthRecord {
  id              String   @id @default(uuid())
  companyId       String
  company         Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  healthScore     Int      // Account Health Index 0–100
  engagementScore Int
  sentimentScore  Int
  calculatedAt    DateTime @default(now())
}

model ExpansionSignal {
  id              String       @id @default(uuid())
  companyId       String
  company         Company      @relation(fields: [companyId], references: [id], onDelete: Cascade)
  opportunityId   String?
  opportunity     Opportunity? @relation(fields: [opportunityId], references: [id], onDelete: SetNull)
  type            SignalType
  status          SignalStatus @default(detected)
  title           String
  observation     String
  reasoning       String
  recommendation  String
  expectedOutcome String
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}
```

**Back-relations**

- `Company.healthRecords` → `AccountHealthRecord[]`
- `Company.expansionSignals` → `ExpansionSignal[]`
- `Opportunity.expansionSignals` → `ExpansionSignal[]`

### 4.2 Shared TypeScript Types

```typescript
// Shared Types: src/types/fs010-growth-intelligence.ts

export type SignalType = "upsell" | "cross_sell" | "renewal_risk" | "churn_risk";
export type SignalStatus = "detected" | "reviewing" | "actioned" | "dismissed";

export interface AccountHealthIndexView {
  id: string;
  companyId: string;
  healthScore: number;      // Account Health Index 0–100
  engagementScore: number;  // 0–100
  sentimentScore: number;   // 0–100
  calculatedAt: string;
}

export interface ExpansionSignalView {
  id: string;
  companyId: string;
  opportunityId?: string;
  type: SignalType;
  status: SignalStatus;
  title: string;
  observation: string;
  reasoning: string;
  recommendation: string;
  expectedOutcome: string;
  createdAt: string;
  updatedAt: string;
}

export interface WhitespaceMatrixCell {
  companyId: string;
  categoryId: string;
  categoryLabel: string;
  coverage: "pitched" | "partial" | "unpitched";
  observation: string;
  reasoning: string;
  recommendation: string;
  expectedOutcome: string;
}
```

---

## 5. Functional Requirements

### FR-010-01 Account Health Index Calculation

The platform shall compute and persist `AccountHealthRecord` per company on a schedule or on-demand refresh. The UI default shows the latest `calculatedAt` as the Account Health Index.

### FR-010-02 Whitespace Matrix

The platform shall compute a Whitespace Matrix of un-pitched (and optionally partial) product/service categories per account in portfolio scope. Actionable cells use 4-part explainability.

### FR-010-03 Expansion Signal Detection

SmartAssist may insert `ExpansionSignal` rows with `status = detected` and full 4-part fields populated. Detection shall cite evidence (meeting cadence drop, negative sentiment cluster, whitespace category, stalled deal velocity).

### FR-010-04 User Status Transitions

Users may set signal status to `reviewing`, `actioned`, or `dismissed`. Dismiss and action require explicit UI confirmation. No silent status changes. `updatedAt` updates on each transition.

### FR-010-05 Explainability UI

Expansion signals and Whitespace Matrix recommendations shall render via the shared `ExplainabilityBlock` (Observation, Reasoning, Recommended Action, Expected Outcome).

### FR-010-06 AD-001 on Growth Collections

Filtered lists/matrices of health indexes, signals, and whitespace shall use `FilterTransparencyBar` / `FilterToolbar` with entity labels such as `Accounts`, `Signals`, or `Whitespace Gaps`.

### FR-010-07 Optional Opportunity Link

`opportunityId` is optional. Upsell signals often link to an open opportunity; cross-sell whitespace may be company-level only until the user creates a deal.

---

## 6. API Surface (initial)

| Method | Path | Behavior |
| :--- | :--- | :--- |
| `GET` | `/api/companies/[id]/health` | Latest Account Health Index (`AccountHealthRecord`) |
| `POST` | `/api/companies/[id]/health/recalculate` | Recompute scores (authorized roles) |
| `GET` | `/api/companies/[id]/expansion-signals` | List signals (AD-001 filter query params) |
| `PATCH` | `/api/expansion-signals/[id]` | Update `status` only (user-gated); bumps `updatedAt` |
| `GET` | `/api/companies/[id]/whitespace` | Whitespace Matrix slice for one account |
| `GET` | `/api/growth/whitespace-matrix` | Portfolio Whitespace Matrix |

Exact route wiring may land in a subsequent implementation sprint; this document defines the contract.

---

## 7. UX Placement

| Surface | Content |
| :--- | :--- |
| Growth Intelligence workspace (`/growth`) | Portfolio health bands, Whitespace Matrix, top expansion signals |
| Company workspace | Account Health Index card + signal list + whitespace row |
| Opportunity Mission Control | Related expansion signals when `opportunityId` matches |

Filter defaults should prefer **actionable** signals (`detected` + `reviewing`) with an AD-001 chip (e.g. `Status: Open`) so users always see why the list is constrained.

---

## 8. Acceptance Criteria

| ID | Criterion |
| :--- | :--- |
| AC-01 | `AccountHealthRecord` and `ExpansionSignal` exist in Prisma with `Company.healthRecords` / `expansionSignals` and `Opportunity.expansionSignals`. |
| AC-02 | Every persisted expansion signal includes non-empty observation, reasoning, recommendation, and expectedOutcome. |
| AC-03 | UI lists/matrices for signals/health/whitespace show AD-001 Showing X of Y + active filter chips. |
| AC-04 | Signal status never moves to `actioned` / `dismissed` without explicit user confirmation. |
| AC-05 | Account Health Index remains in 0–100 and is displayed as advisory (not auto-mutating CRM stage/status). |
| AC-06 | Explainability uses the four FR-015 labels (or shared `ExplainabilityBlock`). |
| AC-07 | Whitespace Matrix surfaces un-pitched product/service categories with 4-part explainability on actionable cells. |
| AC-08 | `ExpansionSignal.updatedAt` is maintained on status changes. |

---

## 9. Out of Scope (this version)

- Automatic opportunity creation from signals
- External market-data vendors as score inputs (may inform later Growth sections)
- Replacing the existing strategic Growth dashboard sections (competitors, events, etc.) — FS-010 **extends** account-level expansion intelligence alongside them

---

## 10. Related Implementation Notes

- Prisma models: `AccountHealthRecord`, `ExpansionSignal` in `prisma/schema.prisma`
- Migrations: `add_fs010_growth_intelligence` (+ follow-up for `updatedAt` if applied separately)
- Shared explainability: `src/components/ui/explainability-block.tsx`
- Filter transparency: `docs/architecture/AD-001-filter-transparency.md`

---

*End of FS-010.*
