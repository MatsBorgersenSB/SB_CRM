# FS-008 Meeting Intelligence

## Document Information

| Property | Value |
| :--- | :--- |
| Specification ID | FS-008 |
| Name | Meeting Intelligence |
| Status | Approved |
| Owner | SmartCRM |
| Category | SmartAssist & Integrations |
| Version | 1.0 |
| Related | FS-001 Opportunity Stakeholder Management · FS-002 Contact Registry · FS-003 Company Registry · FS-004 Relationship Intelligence · FS-005 Opportunity Workspace |
| Governing Standards | SmartCRM Constitution v6.0 · SmartAssist Constitution · SmartCRM North Star |

---

## 1. Purpose

Meetings are the single richest source of relationship signals, deal velocity, and commitment tracking. However, commercial teams frequently lose critical context due to manual data entry friction and disjointed calendar systems.

**Meeting Intelligence** continuously ingests calendar events from external communication platforms (primarily **Microsoft 365 / Graph API**), maps participants directly to the `ContactRegistry` (`FS-002`), automatically logs interactions into the `RelationshipRegistry` (`FS-004`), and surfaces AI-extracted, user-confirmed action items within the `OpportunityWorkspace` (`FS-005`).

---

## 2. Core Principles & Guardrails

1. **Reality First & User Approval:** SmartAssist extracts summaries and proposed action items, but **no commitments, stance changes, or follow-up tasks shall be persisted without explicit user confirmation**.
2. **Deterministic Contact Resolution:** External meeting participants are automatically matched against `ContactRegistry` (`FS-002`) by primary or secondary email addresses. Unmatched external participants trigger an inline "Unresolved Stakeholder" alert for instant contact creation.
3. **Idempotency & Delta Sync:** Calendar synchronization uses Microsoft Graph API `deltaTokens` and `iCalUId` values to prevent duplicate entries across updates, reschedules, or recurring meeting series.
4. **Privacy & Internal Filtering:** Sync strictly respects OAuth scopes configured in `ExternalIntegration`. Internal-only meetings (where all attendees share the host tenant's email domain) are excluded from external deal intelligence tracking by default.

---

## 3. Data Model & Architecture

### 3.1 Shared TypeScript Types

```typescript
// Shared Types: src/types/meeting-intelligence.ts

export type MeetingSourceProvider = "m365_graph" | "google_workspace" | "manual";
export type MeetingSyncStatus = "pending_review" | "processed" | "ignored";
export type CommitmentStatus = "proposed" | "confirmed" | "completed" | "dismissed";

export interface MeetingParticipant {
  email: string;
  name?: string;
  contactId?: string; // Resolved Contact ID from FS-002
  companyId?: string; // Resolved Company ID from FS-003
  isExternal: boolean;
  responseStatus: "accepted" | "declined" | "tentative" | "none";
}

export interface MeetingCommitment {
  id: string;
  description: string;
  ownerEmail: string;
  dueDate?: string;
  status: CommitmentStatus;
  confirmedByUserId?: string;
}

export interface MeetingIntelligenceRecord {
  id: string;
  externalEventId: string; // M365 iCalUId or Event ID
  provider: MeetingSourceProvider;
  opportunityId?: string;  // Linked Opportunity ID (FS-005)
  companyId?: string;      // Linked Company ID (FS-003)
  subject: string;
  startTime: string;
  endTime: string;
  location?: string;
  webLink?: string;
  organizerEmail: string;
  participants: MeetingParticipant[];
  aiSummary?: string;
  commitments: MeetingCommitment[];
  syncStatus: MeetingSyncStatus;
  createdAt: string;
  updatedAt: string;
}