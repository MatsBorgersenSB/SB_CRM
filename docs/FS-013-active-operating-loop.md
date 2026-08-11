# FS-013 Active SmartAssist Operating Loop

## Document Information

| Property | Value |
|----------|-------|
| Specification ID | FS-013 |
| Name | Active SmartAssist Operating Loop |
| Status | Approved |
| Owner | SmartCRM |
| Category | SmartAssist |
| Related | FS-002 · FS-003 · FS-011 · FS-012 |
| Governing Standards | SmartCRM North Star · SmartAssist Constitution |

---

## Problem Statement

Users abandon traditional CRMs because the system is **passive** — empty forms and nagging lists. SmartCRM must be an **active** Organizational Knowledge and Decision System: continuously learning from inputs/outputs and preparing work so the user only decides.

---

## Business Goals

1. Turn observation into prepared actions (create / plan activities, reminders, record updates).
2. Keep User Sovereignty — Approve / Edit / Dismiss only; never silent invent of people, companies, or deals.
3. Learn from dismissals so SmartAssist stops repeating rejected nags.
4. Surface the same loop in Company 360 and Outlook (context before navigation).

---

## The loop

```
Sources → Knowledge → Understanding → Prepared actions → Approve/Dismiss → Learning → Better proposals
```

---

## Functional Requirements

### FR-001 Activity Operating Loop

SmartAssist shall prepare activities (not blank forms) when:

- No logged interaction on a company with contacts
- Open follow-up / commitment is due or overdue
- Meeting ended today without outcome capture
- Quotation awaiting response

On **Approve**: create or complete the activity in CRM.  
On **Dismiss**: require a note; suppress that suggestion key.

### FR-002 Reminder & commitment tracker

SmartAssist shall propose:

- **Complete commitment** for overdue open next-actions
- **Set reminder** (planned follow-up activity) when a commitment is due within 7 days and no reminder exists

Commitments remain grounded in Activity `NextAction` / `AgreedActions` — Reality First.

### FR-003 Living record updates

SmartAssist may propose **record updates** (never auto-write):

- Assign account owner when missing / numeric-id leak
- Classify relationship when Unclassified
- Never invent Customer or Create Opportunity for non-sell-to postures

### FR-004 Dismiss learning

Dismiss notes shall drive **policy hints**:

| Note pattern (examples) | Effect |
|-------------------------|--------|
| supplier / vendor / not a customer | Suppress `create_opportunity` for that company |
| already done / completed | Suppress that suggestion key |
| too soon / not now | Suppress that suggestion key |
| wrong company / duplicate | Suppress that suggestion key |

Learning is suppression + audit — not autonomous CRM mutation.

### FR-005 Surfaces

| Surface | Behaviour |
|---------|-----------|
| Company 360 | Single Co-Pilot / Active Assist strip (Michein) |
| Outlook Relationship Card | Next best prepared action + open commitments (existing budget) |
| Focus / Attention | Feed Co-Pilot proposals |

### FR-006 Information budget

Max **8** pending proposals globally; company-scoped filter on Company 360. Compact cards: Action · Why · Approve.

---

## SmartAssist Behaviour

- Observe before asking  
- Prepare before reporting  
- System thinks; user decides  
- Impact mandatory on every proposal  

---

## Acceptance Criteria

1. Approve on “Log first interaction” creates a Planned activity linked to the company.  
2. Approve on overdue commitment marks activity Completed.  
3. Approve on “Set reminder” creates a dated follow-up activity.  
4. Approve on “Assign account owner” / classify navigates or applies proposed patch only after user confirm.  
5. Dismiss with “this is a supplier” stops Create Opportunity for that company.  
6. No parallel proposal UI on Activities when Company 360 already shows Co-Pilot.  

---

## Out of scope (this slice)

- Fully autonomous writes without Approve  
- New commitment database table  
- Chatbot conversational planner  
