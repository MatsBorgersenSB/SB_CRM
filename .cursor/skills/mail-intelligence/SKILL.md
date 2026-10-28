---
name: mail-intelligence
description: >-
  SmartCRM Mail Intelligence super skill. Turns synced Outlook correspondence
  into decide-first conversations: what needs a reply, what is waiting on them,
  what bounced, how threads and attachments are filed to Companies /
  Opportunities / Projects / SmartDocs, and 1-click mail-to-action execution
  (SmartAssist reply draft, colleague task delegation, or deal linking). Use
  when changing /mail, Outlook add-in mail tagging, mail triage, bounce
  recovery, attachment filing, or correspondence-to-action flows. Not for
  record NBA copy (smartassist) or 360 shells (living-workspace).
---

# Mail Intelligence Super Skill

You own **correspondence triage, filing, and 1-click mail execution** across `/mail` and the Outlook add-in.

Mail is not a flat archive of messages. In SmartCRM, mail is grouped into **conversations** that answer immediately: **Does this need me? Are we waiting on them? Did delivery fail? What work does it belong to? What is the 1-click next step?**

Constitution and information budgets are already always-on — do not restate them. Company facts: [references/standard-bio.md](../references/standard-bio.md).

## When to use

- Changing `/mail` (`MailShell`, `MailThreadRow`, `MailSmartFilterBar`) or conversation triage (`mail-triage.ts`).
- Changing inbound ask, proposal, or promise extraction (`correspondence-action-signals.ts`, `email-sentiment.ts`).
- Changing SmartAssist-informed reply drafts (`mail-reply-draft.ts`, `EmailMessageActions`, `openOutlookDraft`).
- Changing 1-click mail-to-task creation or colleague delegation (`mail-activity-draft.ts`).
- Changing mail-to-opportunity or mail-to-project linking (`mail-opportunity-draft.ts`, `mail-delta-ingest.ts`, `OutlookMailTagPanel`).
- Changing attachment ledger or SmartDocs filing from mail (`mail-attachment-badge.tsx`, `/api/m365/sync-attachments`).

**Hand off**

| Question | Skill |
|----------|--------|
| What is the next best action on a Company / Deal / Contact 360? | `smartassist` |
| How should a 360, Attention table, or owner control be built? | `living-workspace` |
| How does colleague identity, `ActivityOwner` vs `SharedWith`, or Teams/mail ping work? | `m365-colleague-work` |
| Which commercial bet (feasibility vs machinery vs walk away)? | `growth-intelligence` |

## Loop (always)

```
Group messages into conversations (conversationId)
→ Classify each message (human | meeting_notice | delivery_failure | automatic)
→ Compute conversation status from evidence (delivery_failed → reply_needed → waiting_on_them → meeting_notice → none)
→ Open /mail on "Needs you" when any thread needs the user
→ Gate Opportunity linking/creation on sell-to posture; allow Project linking for any posture
→ Execute in 1 click: SmartAssist Reply draft, Assign to colleague, File attachments to SmartDocs, or No reply needed
```

## Triage rules (Reality First)

Code: `src/lib/mail-triage.ts`, `src/lib/correspondence-action-signals.ts`.

1. **Conversations, not single rows** — Group by `conversationId` (`groupMailIntoThreads`). Never show 12 rows for one back-and-forth thread.
2. **Silence machine noise** — `classifyMailMessage` separates `human`, `meeting_notice`, `delivery_failure`, and `automatic` (no-reply, verification codes, order receipts, out-of-office). Machine mail never triggers `reply_needed` or `waiting_on_them`. Visible subjects strip/mask verification codes (`maskVerificationCodes`).
3. **Evidence-backed statuses only** — Every visible status chip carries an `impact` line (`describeMailThreadStatus`). No impact → quiet.
   - `delivery_failed`: Bounce detected (`failedRecipientFromBounce`). If the contact's address was updated (`addressCorrected`) or a later message reached the contact, clear or offer **Resend** to the corrected address — never reply to the bounced address.
   - `reply_needed`: Latest human message is inbound and either contains an extracted ask (`detectInboundActionAsk`) or awaits an answer.
   - `waiting_on_them`: Latest human message is outbound and ≥ `WAITING_AFTER_DAYS` (3 days) old with no reply.
4. **`handledAt` quieting** — Clicking **No reply needed** stamps `handledAt` on the conversation (`POST /api/emails/conversations/[conversationId]/handled`). The thread stays quiet until a newer human message arrives after `handledAt`. Always offer **Undo**.

## Work & attachment filing rules

Code: `src/lib/m365/mail-delta-ingest.ts`, `src/lib/mail-opportunity-draft.ts`, `src/components/emails/mail-attachment-badge.tsx`, `src/app/api/m365/sync-attachments/route.ts`.

| Rule | Requirement |
|------|-------------|
| **Conversation inheritance** | New replies in a `conversationId` inherit `opportunityId` / `projectId` from the latest message in that thread (`resolveConversationLinks`), including explicit `"Not linked"` nulls. Never invent a deal from company context alone. |
| **Posture gate on deals** | Opportunity linking and **Create opportunity** from mail are gated to sell-to companies (`companySellTo` / `isOpportunityEligibleCompany`). Match an existing company deal by topic (`matchingOpportunityForTopic`) before offering a new opportunity. |
| **Posture-free projects** | Project linking is valid for any posture (supplier, partner, customer, consultant). |
| **Attachment ledger** | `summarizeMailAttachments` rolls message ledgers into `none`, `filed`, `incomplete`, or `unfiled`. When `unfiled` or `incomplete` and linked to work/company, offer 1-click **File attachments** (`POST /api/m365/sync-attachments`) to ingest into SmartDocs and update the ledger in place. |
| **Remove ≠ delete in Outlook** | Removing a conversation in `/mail` tombstones/excludes it in SmartCRM (`isEmailIngestExcluded`) so delta sync never brings private/irrelevant mail back, while leaving the user's Outlook mailbox untouched. |

## 1-Click execution from mail

1. **Reply (`buildSmartMailReplyDraft`)** — Never open a blank or generic draft when thread context exists. Pre-fill the Outlook draft (`/api/m365/draft`) with:
   - Contact first name (`Hi Simen,`, or `Hi,` when unknown — never use an email address as a name)
   - The extracted ask (`reply_needed`), waiting age (`waiting_on_them`), and linked Opportunity / Project name
   - Intentional SmartCRM categories (`opportunityId`, `projectId`) so the sent reply auto-links on sync.
2. **Assign to colleague / Create task (`buildMailActivityPreset`)** — Pre-fill task subject (`Reply to {who}: {topic}`, `Follow up: {topic}`, or `Resend: {topic}`), quote the ask, link existing `Company` / `Contact` / `Deal` / `ProjectId` + `OutlookMessageId` / `OutlookConversationId`. Selecting a colleague in **Assign to colleague…** sets `ActivityOwner` and POSTs to `/api/activities`, triggering the CRM bell + Teams/Outlook ping per `m365-colleague-work`.

## When implementing

1. Read [engines.md](engines.md) for the exact files and routes.
2. Keep triage pure and deterministic in `src/lib/mail-triage.ts` and draft builders pure in `src/lib/mail-reply-draft.ts` / `src/lib/mail-activity-draft.ts`.
3. Follow `docs/AD-001-filter-transparency.md` on `/mail` (`Showing X of Y Conversations` + view/filter chips).
4. Check worked scenarios in [examples.md](examples.md).
