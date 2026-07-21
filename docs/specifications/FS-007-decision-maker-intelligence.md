# FS-007 Decision Maker Intelligence

## Document Information

| Property | Value |
| :--- | :--- |
| Specification ID | FS-007 |
| Name | Decision Maker Intelligence |
| Status | Approval Review |
| Owner | SmartCRM |
| Category | Relationship Intelligence |
| Version | 1.0 |
| Related | FS-001 Opportunity Stakeholder Management · FS-004 Relationship Intelligence · FS-005 Opportunity Workspace · FS-006 Influence Mapping |
| Governing Standards | SmartCRM Constitution v6.0 · SmartAssist Constitution · SmartCRM North Star |

---

## 1. Purpose

Deals stall and fail primarily due to **Decision Maker ambiguity**—either the commercial team engages the wrong authority, assumes budget approval where none exists, or fails to uncover formal sign-off chains.

**Decision Maker Intelligence** provides continuous evaluation and visibility into formal authority, economic sign-off paths, and approval dynamics across buying organizations without violating the Reality First Principle.

---

## 2. Core Principles & Guardrails

1. **Explicit Identification over Guesswork:** A Decision Maker is either **Known** (explicitly assigned by a user on the opportunity roster) or **Unknown**. SmartAssist shall never "assume" or fabricate a Decision Maker.
2. **Multi-Threaded Authority Support:** Enterprise deals frequently involve separate **Economic Buyers** (budget authority), **Technical Decision Makers** (technical veto), and **Executive Sponsors**. FS-007 accommodates multi-threaded authority structures.
3. **Registry Composition:** Authority profiles consume Contact facts from `FS-002`, Stakeholder roles from `FS-001`, and Influence stances from `FS-006`. Independent data stores are prohibited.

---

## 3. Decision Authority Model

### 3.1 Authority Classification

Every mapped Decision Maker or key sign-off stakeholder possesses an authority classification:

| Authority Class | Description | Roster Role Mapping (`FS-001`) |
| :--- | :--- | :--- |
| **Economic Buyer** | Final financial sign-off & budget release authority | `Economic Buyer` / `Decision Maker` |
| **Technical Decision Maker** | Owns architectural / technical sign-off or veto | `Technical Lead` / `Decision Maker` |
| **Commercial Decision Maker** | Owns contract negotiation & commercial acceptance | `Commercial Lead` / `Decision Maker` |
| **Executive Sponsor** | Executive air cover & overarching strategic sign-off | `Executive Sponsor` |

```typescript
// Shared Types: src/types/decision-maker.ts

export type AuthorityClass = 
  | "economic_buyer" 
  | "technical_decision_maker" 
  | "commercial_decision_maker" 
  | "executive_sponsor";

export type VerificationState = "known" | "assumed_unconfirmed" | "unknown";

export interface DecisionMakerProfile {
  opportunityId: string;
  contactId: string;
  authorityClass: AuthorityClass;
  verificationState: VerificationState;
  signOffThreshold?: number; // Monitory threshold if known (e.g. $500,000)
  verifiedByUserId?: string;
  verifiedAt?: string;
}