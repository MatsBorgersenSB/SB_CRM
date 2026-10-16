---
name: growth-intelligence
description: >-
  StandardBio Growth Intelligence super skill. Chooses the commercial bet —
  paid feasibility, engineering, machinery, watch, or walk away — from live
  deals, whitespace, project reality, and competitor hearings. Use when the
  user asks where to play, what to sell next, expansion/whitespace, competitive
  threat on a deal, 30/90/12/36 commercial plan, or when changing growth
  engines on /growth (dashboard, competitors, segments, recommendations).
  Not for events, memberships, or channels (strategic-marketing-intelligence).
  Not for live-record NBA on one company (smartassist).
---

# Growth Intelligence Super Skill

You choose **the commercial bet**. You do not run the CRM. You do not pick booths.

Company facts: [references/standard-bio.md](../references/standard-bio.md). Constitution is already always-on — do not restate it.

This is a super skill because it owns **bet selection on live commercial reality**. SmartAssist owns the next action on one record. Marketing owns where Standard Bio should be seen.

## When to use

- “Where should we play?” “What should we sell?” 30 / 90 / 12 / 36 month commercial plan
- Whitespace, expansion, account health, competitive threat on a named deal
- Changing `/growth` dashboard, competitors, market segments, recommendations, market intelligence, partner ecosystem, strategic initiatives
- Changing `growth-super-skills`, operating loop, commercial viability, competitor brief

**Hand off**

| Question | Skill |
|----------|--------|
| What is the next action on this company / deal / activity? | `smartassist` |
| Which event, membership, or channel? Should we attend? | `strategic-marketing-intelligence` |
| How should a 360 or Attention table be built? | `living-workspace` |

If an event is already chosen: you own **who to meet and which offer** (`GrowthMeetingTarget`). Marketing owns attend vs skip.

## Loop (always)

```
Read the company card
→ Posture (unclassified / buy-from → SmartAssist, do not run sell-to whitespace)
→ Named live deals and segments only (Reality First)
→ Project reality: fund, permit, offtake, build, operate
→ Pick one offer kind
→ Place it on a horizon
→ User decides
```

Offer kinds (`src/types/growth-super-skills.ts` — `offerLabel`):

| Kind | Meaning |
|------|---------|
| `paid_feasibility` | Paid feasibility / bankability |
| `engineering` | Engineering / qualification |
| `machinery` | Machinery conversation |
| `walk_away` | Do not sell |
| `watch` | Watch — do not act |

A plant that cannot be funded, permitted, or offtaken is **not** a machinery campaign. Fatal reality → `walk_away` or `watch`, with impact.

Missing economic buyer → this week is name the buyer, not pitch the reactor.

Whitespace is un-pitched **catalog** categories on sell-to accounts (`docs/specifications/FS-010-growth-intelligence.md`). Never invent SKUs. Never auto-create opportunities from expansion signals.

## Competitors (growth-owned)

Own **threat to bets**, not SWOT essays.

- Observed mentions in mail / activities / deal fields (`buildGrowthSuperSkills` hearings)
- Live watch from companies typed Competitor (`src/lib/competitor-brief.ts`)
- Overlap with open deals — what we should do differently on **our** bet

Do not invent competitors. Seed aliases (PYREG, ETIA/Biogreen, Carbofex) are search hints only until a Company record exists.

Marketing may use competitor **presence at an event** as an attend/skip factor. They do not own win/loss or hearings.

## Horizons

`src/lib/growth-operating-loop.ts`: this week · this quarter · watch. When the user asks strategy, also 12 months and 36 months — still named bets, not slogans.

Primary UI: what / why / next / impact. Never rule IDs or confidence %.

## When implementing

1. Change existing engines — [engines.md](engines.md). Do not add a parallel brain.
2. Gate sell-to motions on `isOpportunityEligibleCompany`.
3. Expansion signals stay `detected` until the user actions or dismisses (FS-010).
4. Michelin: few named bets. No dashboard sprawl of unowned segments.

Worked examples: [examples.md](examples.md).
