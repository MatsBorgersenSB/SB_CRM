# FS-023 – M365 Mutual Meeting Scheduler & Interactive Slot Picker ("FindTime")

## Document Information

| Property | Value |
|----------|-------|
| Specification ID | FS-023 |
| Title | M365 Mutual Meeting Scheduler & Interactive Slot Picker |
| Status | Approved — v1 |
| Priority | High |
| Category | SmartAssist & M365 Integrations |
| Version | 1.0 |
| Related | FS-013 Active Operating Loop · FS-014 Post-Meeting Notes · FS-018 Microsoft Teams Integration |
| Governing standards | SmartCRM Constitution · SmartAssist Constitution · SmartCRM North Star · Michelin / Apple / 3-Second / Reality First |

---

## 1. Problem Statement

Scheduling multi-party B2B meetings between Standard Bio (commercial lead + technical/engineering colleagues) and external client stakeholders currently requires:

1. Manually cross-checking multiple internal Outlook calendars.
2. Typing out candidate times in an email, risking double-booking while waiting for the client to reply.
3. Back-and-forth email threads when times conflict, or impersonal third-party booking links that break across corporate firewalls.
4. Manually creating the Microsoft Teams invite and linking it back to the SmartCRM Activity, Company, or Opportunity once a time is agreed.

Furthermore, Microsoft retired the legacy **FindTime** add-in in favour of Outlook Scheduling Poll, which has **no public Microsoft Graph API** for programmatic creation.

---

## 2. Business Goals

1. **Zero-friction internal alignment:** Automatically query `POST /me/findMeetingTimes` across the organizer and selected Standard Bio colleagues (`SharedWith`) to surface 3–4 conflict-free windows.
2. **Prevent double-booking:** Optionally place temporary `tentative` `[Hold]` events on the organizer's Outlook calendar until the client selects a slot.
3. **1-click client experience (Safe-Links proof):** Embed interactive time-slot buttons directly in the outgoing Outlook draft/email that open a lightweight confirmation card (`/meet/{token}?slot={id}`) in the client's local timezone.
4. **Automatic loop closure:** When the client confirms a slot, automatically book the official **Microsoft Teams meeting** (`POST /me/events`), delete unused calendar holds, update the SmartCRM `Activity` (`TeamsEventId`, `TeamsJoinUrl`, `ActivityDate`), and notify the organizer.

---

## 3. User Stories

| ID | As a… | I want to… | So that… |
|----|-------|------------|----------|
| US-01 | Seller / PM | Find 3–4 mutual free times across myself and Standard Bio colleagues in one click | I never manually compare internal Outlook calendars |
| US-02 | Seller / PM | Hold proposed slots tentatively on my Outlook calendar (on by default, toggleable) | I do not accidentally double-book those windows while awaiting client reply |
| US-03 | Seller / PM | Generate an Outlook email draft with clickable time-slot buttons and plain-text times | The client can confirm in 1 click without leaving their inbox flow |
| US-04 | External Client | Click a proposed time in the email, see it in my local timezone, and confirm with 1 click | I don't need to log in or send a back-and-forth email |
| US-05 | External Client | Suggest an alternative window if none of the proposed slots work | The organizer gets structured feedback without dead-ending |
| US-06 | Seller / PM | Have the confirmed slot automatically book a Teams meeting and release unused holds | The Activity record, Teams link, and calendar stay in sync automatically |

---

## 4. Functional Requirements

### 4.1 Mutual Availability Discovery (`POST /api/m365/meeting-slots/suggest`)
- Uses Microsoft Graph `POST /me/findMeetingTimes` with the signed-in organizer and any selected Standard Bio colleagues (`User` / `SharedWith` emails).
- Evaluates business hours over the requested horizon (default: next 7 business days, 30–60 min duration).
- Returns top 3–4 candidate slots (`startIso`, `endIso`, `confidence`, `availabilities`, `source: "graph" | "fallback"`).
- Allows the user to adjust, add, or remove candidate slots before sending.

### 4.2 Proposal & Tentative Holds (`POST /api/m365/meeting-slots/propose`)
- Persists the planned meeting as a single `Activity` record (`ActivityType: "Teams Meeting"` or `"Meeting"`, `ActionStatus: "Scheduled"`) with `SlotProposal` metadata stored in `details`.
- Generates a cryptographically random `token` (`32+` hex/base64url chars) bound to the `Activity`.
- When `holdOnCalendar: true` (default ON), creates `showAs: "tentative"` calendar events titled `[Hold] {Subject}` on the organizer's Outlook calendar and stores their Graph `eventId`s on each slot.
- Creates a rich HTML draft in Outlook (`createM365DraftEmail` / compose deeplink) containing:
  - Interactive slot buttons linking to `/meet/{token}?slot={slotId}`
  - Plain-text readable schedule in CET/UTC
  - Link to view all slots or propose an alternative time

### 4.3 Enterprise Safe-Links Protection (`GET /meet/[token]` → `POST /api/public/meeting-slots/[token]`)
- Corporate email security scanners (Microsoft Defender Safe Links, Mimecast, Proofpoint) pre-fetch all `GET` links in emails.
- `GET /meet/[token]?slot={slotId}` **never** mutates state; it renders the pre-selected slot in the client's detected browser timezone with a single **"Confirm Meeting Time"** (`POST`) button.

### 4.4 Auto-Booking, Hold Cleanup & Notification (`POST /api/public/meeting-slots/[token]`)
- Uses the organizer's stored `ExternalIntegration` (`m365_graph`) token to:
  1. Create the official Microsoft Teams calendar event (`POST /me/events`, `isOnlineMeeting: true`, `onlineMeetingProvider: "teamsForBusiness"`) with all internal and external attendee emails.
  2. Delete all tentative `[Hold]` events (`DELETE /me/events/{holdEventId}`) created for the proposal.
- Updates the SmartCRM `Activity` with the winning `ActivityDate`, `TeamsEventId`, `TeamsJoinUrl`, `TeamsWebLink`, `TeamsScheduled: true`, and `SlotProposal.status = "confirmed"`.
- Creates an in-app SmartCRM `Notification` for the organizer.

---

## 5. SmartAssist Behaviour

- **Observe before asking:** Pre-populates external attendees from the selected Company / Opportunity / Contact context and internal colleagues from `SharedWith`.
- **System thinks, user decides:** SmartAssist proposes the best conflict-free windows and prepares the Outlook draft; the user reviews and sends.
- **No silent contact creation:** External attendee emails come strictly from selected Contact Registry records or explicit user entry.

---

## 6. UX Design

### 6.1 Activity Create Wizard (Meeting / Teams Meeting)
- Under **When** (`Upcoming`), adds a clean mode toggle:
  - `Fixed time` (single date & time)
  - `Propose times (FindTime)` (multi-slot finder)
- In `Propose times` mode:
  - **Find mutual times** button queries M365 schedules for organizer + selected colleagues.
  - Displays 3–4 compact slot rows (with remove / add slot controls).
  - Checkbox: **Hold proposed slots tentatively on my Outlook calendar** (default checked).
  - Primary CTA: **Prepare slot proposal in Outlook**.

### 6.2 Client Slot Picker (`/meet/[token]`)
- Michelin-grade, distraction-free card:
  - **What am I looking at?** Meeting title, organizer name (`Standard Bio`), and duration.
  - **What matters?** The proposed time slots rendered in the visitor's local timezone (with timezone badge).
  - **What next?** Single **"Confirm Meeting"** button (or **"None of these work — suggest another time"**).

---

## 7. Reality First Principle

- Never claim a calendar slot was checked against Microsoft Graph if M365 is disconnected; clearly label `M365 Free/Busy Verified` vs `Suggested Business Hours (M365 offline)`.
- Never auto-book on `GET` requests.
- If the organizer's M365 token is expired/unavailable at confirmation time, still record the client's confirmed slot on the `Activity`, notify the organizer, and provide a 1-click "Create Teams Invite" action.

---

## 8. Persistence / Ownership Rules

- **Single Source of Truth:** Proposal state lives on the `Activity` record (`SlotProposal` inside `Activity` / Prisma `activities.details`). No duplicate meeting tables or shadow contact stores are created.
- Organizer's `integrationId` / `organizerEmail` is stored in `SlotProposal` so the public confirmation endpoint can book the Teams event and remove holds on the organizer's calendar without requiring the client to authenticate.

---

## 9. Acceptance Criteria

- [ ] `POST /api/m365/meeting-slots/suggest` calls Graph `POST /me/findMeetingTimes` when an active M365 integration exists and falls back cleanly when offline.
- [ ] `POST /api/m365/meeting-slots/propose` creates the `Activity` with `SlotProposal`, creates tentative Outlook `[Hold]` events when enabled, and returns an editable Outlook draft link containing clickable slot buttons.
- [ ] `/meet/[token]` loads without authentication (`src/middleware.ts` allowlist), displays slots in the client's timezone, and is safe against `GET` link scanners.
- [ ] Confirming a slot via `POST /api/public/meeting-slots/[token]` books the Teams meeting, deletes unused tentative holds, updates the `Activity` date + Teams link, and notifies the organizer.
