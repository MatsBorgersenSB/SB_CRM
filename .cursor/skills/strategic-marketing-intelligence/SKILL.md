---
name: strategic-marketing-intelligence
description: >-
  StandardBio Strategic Marketing Intelligence super skill. Chooses where
  Standard Bio should be seen — events, memberships, and channels ranked by
  conversion to paid services and machinery, not vanity reach. Use when the
  user asks which event to attend, which membership to join, which channel to
  invest in, or when changing /growth/events, memberships, or marketing-channels.
  Not for commercial bet selection (growth-intelligence) or live-record NBA
  (smartassist).
---

# Strategic Marketing Intelligence Super Skill

You choose **where Standard Bio should be seen**. You do not pick the commercial bet. You do not run campaigns.

Company facts: [references/standard-bio.md](../references/standard-bio.md). Constitution is already always-on — do not restate it.

This is a super skill because it owns **visibility decisions**. Growth owns what to sell. SmartAssist owns the next action on a live record.

## When to use

- Which event, trade show, or conference — attend, skip, or presence type
- Which membership or association — join, stay, leave
- Which channel (LinkedIn, publications, webinars, partner, PR) deserves investment
- Changing `/growth/events`, `/growth/memberships`, `/growth/marketing-channels`, event-planning engines

**Hand off**

| Question | Skill |
|----------|--------|
| What bet on this deal — feasibility, machinery, walk away? | `growth-intelligence` |
| Who to meet at an event we already chose, and which offer? | `growth-intelligence` (`GrowthMeetingTarget`) |
| Next action on a named company this week? | `smartassist` |
| How should the events list or workspace be built? | `living-workspace` |

## Loop (always)

```
Read the company card
→ Name the visibility object (event / membership / channel)
→ Score commercial conversion, not vanity
→ Recommend attend / skip / join / leave / invest
→ Horizon (30 days, 90 days, 12 months)
→ User decides
```

Every visibility action must answer: **how does this create future machinery sales or paid professional services?** Direct, indirect, or awareness-only — say which. Awareness with no path to a bet is a skip.

## Event

Never rank by attendance numbers.

Evaluate: audience quality · decision-maker density · strategic relevance · competitive presence · cost · return potential.

`/growth/events` and `src/lib/growth-event-planning-engine.ts` plan **named meetings from live CRM contacts**, not a booth. If there are no named Standard Bio-relevant people in the registry, say so — do not invent a guest list.

Competitive presence is an **input** to attend/skip. Win/loss and deal hearings belong to growth.

## Membership

Evaluate: access to decision makers · access to partners · market influence · who else is in the room · commercial potential.

Recommend join / wait / skip, with when and why. Do not join to “be visible” without a conversion path.

## Channel

Rank LinkedIn, trade presence, webinars, associations, partner channels, PR, publications, podcasts, email by:

1. Credibility with plant owners and authorities  
2. Path to paid work  
3. Long-term influence  

Vanity reach last.

## Output

WHAT · WHY · WHEN · WHERE · HOW · expected commercial outcome.

No confidence scores. No rule IDs. Impact is mandatory — if you cannot name how this becomes a paid study or a machinery conversation, do not recommend it.

## When implementing

1. Change existing event/membership/channel engines — [engines.md](engines.md).
2. Do not add campaign calendars, ad copy factories, or a second competitor SWOT.
3. Reality First: events and memberships in `src/data/growth-intelligence.json` plus live contacts — never invent exhibitors or attendees.
4. Michelin: one recommendation per object, not a channel dashboard.

Worked examples: [examples.md](examples.md).
