---
name: m365-colleague-work
description: >-
  Protocol for Standard Bio colleague work in SmartCRM: assign is not share,
  colleagues are users not contacts, identity by email then name then id,
  assignment ping is CRM bell plus Teams 1:1 then Outlook. Use when changing
  activity assignment, SharedWith, notification inbox, Graph Chat.ReadWrite /
  Mail.Send notify, or Users & Access pickers. Not a super skill.
---

# M365 colleague work (skill)

This is a **skill**, not a super skill. It is a protocol: who is a colleague, who owns the work, and how they find out. It does not own BD decisions, visibility bets, or 360 layout.

Living-workspace owns owner **controls on screens**. This skill owns **assign vs share, identity, and the ping**.

## When to use

- Activity assignee (`ActivityOwner`), SharedWith, task pickers
- CRM bell inbox keyed to a colleague
- Teams / Outlook ping on assignment
- Mapping session users to `STANDARD_BIO_USERS` / Users & Access
- Anything that might create a Contact for `@standard.bio`

**Hand off:** next action on the record → `smartassist`. Owner dropdown chrome → `living-workspace`.

## Protocol

```
Colleague = Users & Access user (not a Contact)
→ ActivityOwner = responsibility (one person)
→ SharedWith = visibility only
→ Resolve identity: email → display name → id>0 (never SSO placeholder id)
→ If ownership transferred to someone else: CRM bell + ping
→ Ping: Teams 1:1, else Outlook, else bell-only if no Graph token
```

## Assign ≠ share

| Field | Meaning |
|-------|---------|
| `ActivityOwner` | The colleague responsible. Use `TaskAssigneeSelect`. |
| `SharedWith` | Who can see the task. Use `src/lib/task-sharing.ts`. Sharing does **not** ping. |

Do not treat SHARE as assign. Do not ping on share-only edits.

## Colleagues are users

FS-002: Standard Bio staff (`@standard.bio` and other internal domains) are **users**, not Contact Registry people. If they need access, add them in Users & Access. Never invent a contact for a colleague.

Assignable options: `mergeStandardBioUserOptions` (`src/lib/standard-bio-users.ts`) — Users & Access plus `STANDARD_BIO_USERS` (`src/types/bio-user.ts`).

## Identity

SSO sessions often share placeholder `id: 1`. Matching that id first steals Mats.

| Function | Rule |
|----------|------|
| `authUserToAccountOwner` | Name/email before id (`src/lib/company-owner.ts`) |
| `findColleague` / `resolveNotificationInboxUserId` | Email (skip `@smartcrm.local`) → displayName → id>0 (`src/lib/notifications/living-signals.ts`) |
| Notification GET/PATCH | Bell sends `x-sb-user-email`; resolve inbox with that, not raw session id |

Compact-name matching can miss people (e.g. Ola / `okr@…`). Email in Users & Access is the source of truth.

## Tell them they got the work

Hook: `notifyAssignment` in `src/lib/activity-store.ts` on **create** and **update**. Logic: `assignmentShouldNotify` / `notifyActivityAssigned`.

1. Skip if no next owner, owner unchanged, or assigner is the assignee (id, email, or title).
2. One ping per transfer fingerprint (`assignmentNoticeLink` includes `from=` previous owner so a later reassignment can ping again).
3. Always write the CRM bell for the assignee’s Users & Access id.
4. If assignee has email: `pingColleagueAboutAssignment` — Teams 1:1 then `/me/sendMail`. Delegated token of the **assigner**. No token → log warning, keep the bell.
5. Assigner is the **session** colleague, not the previous owner.

Do not add a second notification inbox. Bell is not competing with Outlook (FS-018). The ping exists so they know even when they are not in SmartCRM.

Call existing helpers. Do not reimplement Graph chat member payloads.

Scopes already in `DEFAULT_SCOPES` (`src/lib/m365-client.ts`): `Chat.ReadWrite`, `Mail.Send`. New Chat scope may need re-consent.

## Tests

`src/lib/notifications/activity-assignment.test.ts` — ping other, skip self, skip unchanged, ping first assign, reassignment gets a new link.

## Good vs bad

**Self-assign** — Bad: Teams ping to yourself. Good: skip.

**Share with Hugo** — Bad: treat as assignment and ping. Good: SharedWith only; ActivityOwner unchanged.

**Reassign Walter → Hugo** — Bad: silent, or reuse the first notify link so the second ping is deduped. Good: new `from=` fingerprint, bell + Teams/mail.

**Session id 1, user is Ola** — Bad: store/read notifications as Mats. Good: resolve by `okr@…` / `x-sb-user-email`.

**Inbound mail** — Different path: `notifyInboundMail` only if the mail is linked/tagged. Do not use assignment ping for mail.
