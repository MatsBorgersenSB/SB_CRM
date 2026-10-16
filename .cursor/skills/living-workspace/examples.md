# Living workspace — good vs bad

## 1. Company 360 after inbound Outlook mail

**Facts:** Latest mail 4 days ago. No CRM activity this month.

**Bad:** Hero says “No interactions recorded yet” / Attention lists the account as silent. Extra “Engagement dashboard” card.

**Good:** Verdict last touch is Outlook (`laterIso` + correspondence). Status story names the mail. Next action is the human step, not a new widget. Compose `Company360LivingWorkspace`.

## 2. Missing owner on a historical company

**Bad:** Default the header to Mats because session `id` is `1`. Cascade that owner onto contacts.

**Good:** Show **Unassigned**. `CompanyOwnerSelect` is visible. `authUserToAccountOwner` matches name/email first. Reassign writes only the company owner.

## 3. Attention row with an assigned activity

**Bad:** Owner column empty, or always the company Account Owner, while ActivityOwner is Ola.

**Good:** Owner chain: activity assignee first (`attachAttentionOwners`). Label is a person name, never a raw id. Unassigned only when no owner exists.

## 4. New filtered people list

**Bad:** Search box changes the table. Count shows “12 contacts.” Filters live only in the dropdown label.

**Good:** `FilterToolbar` + `Showing 12 of 48 People` + chips. Names are `ContactLink`. Contact owner is `CompanyOwnerSelect`.

## 5. Opportunity page “needs more”

**Bad:** Add a Dashboard tab, a second header of KPI tiles, and confidence %.

**Good:** Stay on Mission Control. Default Overview. One view at a time. Title + one metadata line. Want / block / next. Engine detail collapsed. Michelin: if it does not help the seller decide, do not add it.
