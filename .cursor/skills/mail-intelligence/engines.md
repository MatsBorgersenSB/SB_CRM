# Mail Intelligence — code of truth

Read the named file before changing mail behavior. Do not create parallel triage or draft engines.

## Triage & signal extraction

| Job | File |
|-----|------|
| Thread grouping, message classification (`human`, `meeting_notice`, `delivery_failure`, `automatic`), bounce address extraction, thread status & impact copy, view counts | `src/lib/mail-triage.ts` |
| Inbound action asks (`detectInboundActionAsk`), proposal follow-ups (`detectProposalFollowUp`), open promises (`detectOpenPromises`) | `src/lib/correspondence-action-signals.ts` |
| Sentiment & commitment extraction | `src/lib/email-sentiment.ts` |
| Verification code masking & readable preview text | `src/lib/mail-preview-text.ts` |
| Internal vs external domain classification (`isInternalEmail`, `isExternalEmail`) | `src/lib/domain-rules.ts` |

## 1-click drafts & actions

| Job | File |
|-----|------|
| SmartAssist-informed reply draft (`buildSmartMailReplyDraft`, `replySubject`) | `src/lib/mail-reply-draft.ts` |
| Reply / Call / Plan meeting / Create meeting bar on a mail row | `src/components/emails/email-message-actions.tsx` |
| Graph draft creation with intentional SmartCRM categories | `src/components/opportunities/draft-in-outlook-button.tsx`, `src/app/api/m365/draft/route.ts` |
| Mail-to-Task preset + colleague `ActivityOwner` delegation (`buildMailActivityPreset`) | `src/lib/mail-activity-draft.ts` |
| Topic extraction, existing deal match (`matchingOpportunityForTopic`), mail-to-opportunity draft (`buildMailOpportunityDraft`) | `src/lib/mail-opportunity-draft.ts` |

## `/mail` workspace & Outlook add-in

| Surface | File |
|---------|------|
| `/mail` server page (loads linked messages, open deals/projects, assignable Standard Bio users) | `src/app/mail/page.tsx` |
| `/mail` workspace shell (views, AD-001 filter bar, link thread, mark handled + undo, 1-click colleague assign, 1-click file attachments, remove from SmartCRM) | `src/components/layout/mail-shell.tsx` |
| Conversation row, reader expand, status chip + impact, bounce Resend / Check contact, work selects | `src/components/emails/mail-thread-row.tsx` |
| Smart filter bar & thread filtering/sorting | `src/components/emails/mail-smart-filters.tsx` |
| Attachment ledger rollup & paperclip badge (`summarizeMailAttachments`, `MailAttachmentBadge`) | `src/components/emails/mail-attachment-badge.tsx` |
| Outlook add-in mail tag & attachment filing panel | `src/components/m365/outlook-mail-tag-panel.tsx` |

## Sync, ingest & persistence APIs

| Job | File |
|-----|------|
| Delta mail sync, conversation link inheritance (`resolveConversationLinks`), SmartCRM category sync | `src/lib/m365/mail-delta-ingest.ts` |
| Linked mail DTOs, attachment ledger mapping, exclusion tombstone (`isEmailIngestExcluded`) | `src/lib/email-intelligence-data.ts` |
| File mail attachments to SmartDocs (including `.zip` extraction & `.eml` preservation) | `src/app/api/m365/sync-attachments/route.ts` |
| Conversation link PATCH / purge DELETE | `src/app/api/emails/conversations/[conversationId]/route.ts`, `src/app/api/contacts/[contactId]/emails/route.ts` |
| Mark conversation `handledAt` ("No reply needed") / Undo | `src/app/api/emails/conversations/[conversationId]/handled/route.ts` |

## Tests

| Suite | File |
|-------|------|
| Thread triage, bounces, `handledAt`, machine mail | `src/lib/mail-triage.test.ts` |
| SmartAssist reply draft from mail evidence | `src/lib/mail-reply-draft.test.ts` |
| Mail-to-task preset & colleague assignment | `src/lib/mail-activity-draft.test.ts` |
| Mail-to-opportunity topic & matching deal | `src/lib/mail-opportunity-draft.test.ts` |
| Action ask / commitment detection | `src/lib/mail-todo-detection.test.ts` |
| Preview cleaning & OTP masking | `src/lib/mail-preview-text.test.ts` |
| `/mail` filters | `src/components/emails/mail-smart-filters.test.ts` |
