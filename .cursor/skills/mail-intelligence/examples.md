# Mail Intelligence — good vs bad

## 1. Inbound customer question on `/mail`

**Facts:** Simen at Mepex (Prospect, linked to deal *Pyrolysis Line A*) writes: *"Can you send the revised price by Friday?"*

**Bad:**
- Show 4 separate rows for the 4 messages in the conversation.
- Clicking **Reply** opens a generic `<p>Hi,</p><p>Thank you for your note...</p>` without greeting Simen, without quoting the ask, and without tagging the draft to *Pyrolysis Line A*.

**Good:**
- Roll the 4 messages into one conversation row with status `Needs reply` and impact quoting *"Can you send the revised price by Friday?"*
- Clicking **Reply** (`buildSmartMailReplyDraft` + `openOutlookDraft`) opens an Outlook draft addressed to Simen (`Hi Simen,`), referencing *Pyrolysis Line A* and his exact question, with the SmartCRM opportunity category pre-applied.
- If already answered by phone, clicking **No reply needed** sets `handledAt` and quiets the row until Simen writes again.

## 2. Bounced outbound email

**Facts:** Outbound quote to `old.name@biowaste.no` bounced with `Undeliverable: Quote`. The user updated the contact's email in SmartCRM to `simen@biowaste.no`.

**Bad:**
- Offer a normal **Reply** button that composes back to `postmaster@...` or the dead `old.name@biowaste.no` address.
- Keep the thread permanently red even after a newer thread succeeded to `simen@biowaste.no`.

**Good:**
- `triageMailThread` detects `delivery_failed`, extracts `failedAddress`, sees `addressCorrected: true` on the contact, suppresses **Reply**, and shows a primary **Resend** button that composes to `simen@biowaste.no` with the stripped original subject (`Quote`).
- If the contact still carries the broken address, show **Check contact** linking to Contact 360.

## 3. Supplier thread with PDF quote attachment

**Facts:** A supplier (`Supplier / Vendor` posture, `companySellTo: false`) sends a technical drawing PDF on a thread linked to a Project, with `hasAttachments: true` and `attachmentLedger: null`.

**Bad:**
- Offer **Create opportunity** on the supplier's mail row.
- Force the user to open Outlook desktop add-in just to save the PDF into SmartDocs.

**Good:**
- Suppress **Create opportunity** because `companySellTo` is false; keep **Project** linking enabled.
- Show `Has attachments · not filed yet` badge and an inline **File attachments** button on the expanded row that calls `POST /api/m365/sync-attachments`, saves the PDF to SmartDocs under the company/project, and flips the badge to `1 attachment filed`.

## 4. Delegating a mail follow-up to a colleague

**Facts:** User reads an inbound technical question on `/mail` that Ola should answer.

**Bad:**
- Create a Contact record for `okr@standard.bio`, or require opening a 6-field modal wizard just to hand the thread to Ola.

**Good:**
- Pick **Ola** in the inline **Assign to colleague…** control on the mail row.
- `buildMailActivityPreset` creates the task with `ActivityOwner: Ola`, quotes the inbound ask, links the company/contact/deal/project and `OutlookMessageId`, and `POST /api/activities` writes Ola's CRM bell + sends a Teams 1:1 / Outlook ping (`m365-colleague-work`).
