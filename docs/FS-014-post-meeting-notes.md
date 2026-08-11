# FS-014 Post-Meeting SmartAssist Notes

## Document Information

| Property | Value |
|----------|-------|
| Specification ID | FS-014 |
| Name | Post-Meeting SmartAssist Notes |
| Status | Approved |
| Owner | SmartCRM |
| Category | SmartAssist & Integrations |
| Related | FS-008 Meeting Intelligence · FS-002 Contact Management · FS-003 Company Management · FS-005 Opportunity Workspace · FS-013 Active Operating Loop |
| Governing Standards | SmartCRM Constitution · SmartAssist Constitution · SmartCRM North Star · AD-001 Filter Transparency |

---

## Problem Statement

Teams meetings produce the richest commercial context — decisions, commitments, risks — but that knowledge is lost unless someone manually types notes into SmartCRM. Users asked to invite SmartAssist as a meeting note-taker. A live meeting bot is heavy. **Post-meeting transcript notes** deliver the value with far less risk.

---

## Business Goals

1. After a Teams meeting ends, SmartAssist turns the transcript into a clear note draft.
2. Extract only what the transcript supports: summary, decisions, commitments, open questions.
3. Persist nothing as fact until the user **Approves** (or dismisses).
4. Reuse FS-008 `MeetingRecord` / `MeetingCommitmentRecord` — single source of truth.
5. Pass the 3-second test: What happened? What was agreed? What should happen next?

---

## User Stories

1. As a seller, after a Teams meeting, I want SmartAssist to prepare notes from the transcript so I do not re-type everything.
2. As a seller, I want to Approve or dismiss each proposed commitment before it becomes a CRM fact.
3. As SmartAssist, I want to prefer Graph transcript fetch when available, and accept pasted transcript/VTT when it is not.
4. As an admin, I do not want a bot joining live meetings in this slice.

---

## Functional Requirements

### FR-001 Sources (post-meeting only)

SmartAssist may obtain meeting text from:

1. **Pasted transcript** (plain text or Teams `.vtt`) — always available.
2. **Microsoft Graph transcripts** (when tenant grants `OnlineMeetingTranscript.Read.*`) — optional automation.

Out of scope for FS-014: live media bots, real-time captions joining the call.

### FR-002 Extract without inventing

From transcript text, SmartAssist shall propose:

| Field | Rule |
|-------|------|
| Summary | Short business prose of what was discussed |
| Commitments / actions | Only phrases the transcript supports |
| Owner hints | Only when named or clearly attributable |
| Due hints | Only when stated |
| Open questions / unknowns | Explicit gaps — never filled with fiction |

Never invent people, companies, opportunities, or commitments.

### FR-003 Propose → Approve → Persist

1. Extraction creates **proposed** `MeetingCommitmentRecord` rows (`status = proposed`).
2. Summary stored on `MeetingRecord.aiSummary` as draft understanding.
3. User Approves / Completes / Dismisses each commitment via existing Meeting Intelligence UI (FS-008).
4. Optional: Active Assist may surface “Review meeting notes” when proposed commitments exist.

### FR-004 Meeting linkage

Resolve meeting context in order:

1. Explicit `meetingId`
2. `opportunityId` + subject/time window
3. Create a manual `MeetingRecord` linked to opportunity/company when user confirms import

### FR-005 Privacy

- Respect tenant transcript policies.
- Do not sync internal-only meetings into external deal intelligence by default (align FS-008).
- Do not auto-create Contacts from speaker labels without Relationship Intake approval.

---

## SmartAssist Behaviour

- Observe transcript before asking
- Propose notes before reporting
- System thinks; user decides
- Impact on every review prompt (why these commitments matter)

---

## UX Design

| Surface | Behaviour |
|---------|-----------|
| Opportunity Meeting Intelligence | “Paste Teams transcript” → Extract → proposed commitments appear for Approve |
| Company / Opportunity Active Assist | “Review meeting notes” when `pending_review` + proposed commitments |
| Outlook / Teams live bot | Out of scope |

Michelin: one import action, one review list — no new dashboard.

---

## Reality First Principle

Unknown speakers stay unknown. Weak transcript → low confidence, fewer proposals. Empty extraction is valid — do not invent filler notes.

---

## Persistence / Ownership Rules

| Knowledge | Owner |
|-----------|--------|
| Meeting event + participants | `MeetingRecord` / `MeetingParticipantRecord` (FS-008) |
| Proposed / confirmed commitments | `MeetingCommitmentRecord` |
| Transcript raw text | Not required long-term; optional transient processing only in v1 |

---

## Acceptance Criteria

1. Pasting a Teams VTT or plain transcript produces a summary + proposed commitments without auto-confirming them.
2. Approving a commitment sets `status = confirmed` (existing PATCH path).
3. Dismissing a commitment sets `status = dismissed`.
4. No live Teams bot is required.
5. When Graph transcript permissions are missing, paste path still works.
6. Extraction never creates Contact or Company records by itself.

---

## Out of scope

- Inviting SmartAssist into the live Teams call
- Real-time audio / media bots
- Automatic Contact creation from speaker names
- Replacing Teams Copilot UI inside the meeting window
