---
name: living-workspace
description: >-
  SmartCRM living-workspace super skill. Builds 360s, lists, owners, and
  Attention as decision surfaces — what am I looking at, what matters, what
  next — from existing living-workspace shells. Use when changing Company /
  Contact / Deal / Document / Project 360s, Attention, owner controls, filtered
  lists, or relationship links. Not for NBA copy (smartassist), commercial bets
  (growth-intelligence), or events (strategic-marketing-intelligence).
---

# Living Workspace Super Skill

You build **decision surfaces**, not CRM pages.

SmartAssist decides what to recommend. You decide how the screen is built so a human can answer in three seconds: **what am I looking at? what matters? what next?**

Constitution and information budgets are already always-on — do not restate them. Company facts: [references/standard-bio.md](../references/standard-bio.md).

This is a super skill because it owns **product craft already shipped**: living 360s, honest last touch, owners, Attention, filter transparency, relationship links. Do not invent a new workspace family.

## When to use

- Changing Company, Contact, Opportunity, Document, Document Set, or Project 360
- Attention table / Today queue / owner column
- Account / contact / opportunity owner controls
- Filtered lists and tables (companies, people, deals, activities, search)
- Object names as links to 360s

**Hand off**

| Question | Skill |
|----------|--------|
| What should happen next on this record? | `smartassist` |
| Feasibility vs machinery vs walk away? | `growth-intelligence` |
| Which event or channel? | `strategic-marketing-intelligence` |
| `/mail` triage, bounce recovery, reply drafts, or attachment filing | `mail-intelligence` |
| Teams / mail ping when assigning a colleague | `m365-colleague-work` (skill, not super) |

## Loop (always)

```
Name the decision the surface must answer
→ Compose the existing *LivingWorkspace / shell (do not fork)
→ One hero: status story + next action + impact
→ Last touch includes Outlook mail
→ Owner visible, reassignable, never invented
→ Lists: AD-001 Showing X of Y
→ Names are relationship links
→ If it does not help the decision, do not add it
```

Michelin: few ingredients. No new card, tab, or widget because the page “looks empty.”

## Compose, do not fork

| Object | Shell | Route |
|--------|--------|--------|
| Company | `Company360LivingWorkspace` | `/companies/{id}` — **one living page** (legacy Overview/Work/Actions tabs are retired) |
| Contact | `Contact360LivingWorkspace` | `/contacts/{id}` |
| Opportunity | `Deal360LivingWorkspace` | `/opportunities/{id}` — Mission Control, default `overview` |
| Document / set / project | matching `*LivingWorkspace` | `/documents/{id}`, `/document-sets/{id}`, `/projects/{id}` |

Layout: `WorkspaceMain` + `WorkspaceStack` (`src/lib/workspace-design-system.ts`). Full width after the sidebar. No narrow document column on a decision workspace.

Opportunity: one view at a time (`src/types/opportunity-mission-control.ts`). Do not add a primary view without removing one. Header is title + one metadata line — not a field dump.

Company header: prose status story, not a pill cluster of type / health / stage (`CompanyWorkspaceHeader`). Verdict from `buildCompany360Verdict` — last touch may be Outlook.

## Last touch (honesty)

Last interaction = later of activity and Outlook (`laterIso` in `src/lib/contact-360-verdict.ts`, used by company verdict too).

- Mail is a real touch (`src/lib/company-correspondence.ts`). Do not call the relationship silent when mail exists.
- Never display the engine’s 999-day sentinel as a clock (`humanizeEngineReason`).
- Attention empty copy must match evidence. If correspondence exists, the row is not “no interactions.”

## Owners

Registrar is the default. Ownership is **always** reassignable. Missing owner → **Unassigned**. Never invent an owner. Changes do **not** cascade (company ↛ contact ↛ opportunity).

Use `CompanyOwnerSelect` on 360 headers and lists. Persistence: `src/lib/company-owner.ts` (`authUserToAccountOwner` matches **name/email before session id** — SSO placeholder `id: 1` must not steal Mats). Opportunity: `src/lib/opportunity-owner.ts`. Permissions: `canReassignCompanyOwner` / `canReassignContactOwner` / `canAssignOpportunityOwner`.

Specs: `docs/FS-002-contact-management.md`, `docs/FS-003-company-management.md`.

**Assign ≠ share.** ActivityOwner is responsibility. SharedWith is visibility. Colleague notify is the m365 skill.

## Attention

One table everywhere: `AttentionQueueTable`. Columns: Status · Object · Item · Recommended Action · Due · **Owner** · Execute.

Owner chain (`attachAttentionOwners` in `src/lib/smart-attention-engine.ts`):

1. Activity assignee  
2. Opportunity owner  
3. Contact owner  
4. Company Account Owner  
5. else Unassigned  

Engine `ruleId` is internal — never primary UI. Dismiss is user action (`attention-dismiss-store`). Home budget: `MyAttentionPanel` (default 20).

The listed issue must be openable: Attention Item and Recommended Action link via `attentionIssueHref` (`issueHref` for mail, else `href`). New mail opens Outlook when a webLink exists, otherwise Company 360 `?mail=#outlook`.

## Lists

Every filtered collection follows `docs/AD-001-filter-transparency.md`:

`Showing {filtered} of {total} {EntityLabel}` + chips + clear-all when ≥2 filters.

Canonical: `FilterToolbar` / `FilterTransparencyBar` / `buildActiveFilterChips`. Tables: `WorkspaceTable`. Do not hide filters inside dropdown labels.

## Relationship-first

Names navigate. Use `@/components/relationship/relationship-links` and `@/types/relationship-navigation`. Emails expose compose; phones expose call and copy. Do not leave a company/contact/deal as plain text on a decision surface.

## When implementing

1. Edit the existing living workspace. Do not add a parallel 360.
2. Code of truth: [engines.md](engines.md).
3. Gate Create Opportunity in chrome with `shouldOfferCreateOpportunity` + posture — SmartAssist owns the recommendation text.
4. Impact mandatory on risks and recommended actions. No impact → do not render.

Worked examples: [examples.md](examples.md).
