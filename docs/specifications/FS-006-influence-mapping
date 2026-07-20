# FS-006 Influence Mapping

## Document Information

| Property | Value |
| :--- | :--- |
| Specification ID | FS-006 |
| Name | Influence Mapping |
| Status | Approval Review |
| Owner | SmartCRM |
| Category | Relationship Intelligence |
| Version | 1.0 |
| Related | FS-001 Opportunity Stakeholder Management · FS-004 Relationship Intelligence · FS-005 Opportunity Workspace |
| Governing Standards | SmartCRM Constitution v6.0 · SmartAssist Constitution · SmartCRM North Star |

---

## 1. Purpose

Opportunities are decided by power dynamics, personal motivations, and political alignment within buying centers. 

**Influence Mapping** provides a visual and analytical representation of influence structures across an Opportunity or Company context. It enables commercial teams to answer critical strategy questions:
* *Who holds informal power vs. formal authority?*
* *Where are our Champions, Blockers, and Decision Influencers?*
* *How do relationships recorded in the Relationship Registry translate into deal movement?*

---

## 2. Core Principles & Guardrails

1. **Composition Over Duplication:** Influence Mapping consumes stakeholder facts from `FS-001` and relationship facts from `FS-004`. It does not store duplicate contact or relationship records.
2. **Reality First:** Influence levels and stance (e.g., *Champion*, *Blocker*) reflect user-confirmed observations. SmartAssist shall never invent political stances, influence levels, or corporate hierarchies.
3. **SmartAssist Assists, User Decides:** SmartAssist may highlight unmapped influence gaps or single-threaded risks, but user confirmation is mandatory before persisting stance or influence data.

---

## 3. Influence Model

### 3.1 Influence Attributes

When a Contact is assigned as a Stakeholder on an Opportunity (`FS-001`), the user or SmartAssist (with confirmation) evaluates two primary dimensions:

#### **Influence Level**
* **High:** Can single-handedly alter deal outcome or strategy.
* **Medium:** Possesses strong departmental veto or advisory weight.
* **Low:** Impacted by outcome but possesses minimal decision-making weight.
* **Unknown:** Influence level has not yet been verified (**Default**).

#### **Stance / Political Sentiment**
* **Champion:** Actively promotes SmartCRM/our proposal internally.
* **Positive:** Supportive, but not actively driving internal alignment.
* **Neutral:** Uncommitted or unbiased observer.
* **Blocker:** Actively opposes our solution or prefers an alternative/status quo.
* **Unknown:** Stance is unverified (**Default**).

```typescript
// Shared Types: src/types/influence.ts

export type InfluenceLevel = "high" | "medium" | "low" | "unknown";
export type SentimentStance = "champion" | "positive" | "neutral" | "blocker" | "unknown";

export interface StakeholderInfluenceProfile {
  opportunityId: string;
  contactId: string;
  influenceLevel: InfluenceLevel;
  stance: SentimentStance;
  notes?: string; // Qualitative observation context
  updatedAt: string;
}