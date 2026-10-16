# Strategic Marketing Intelligence — code of truth

Read the named file. Do not duplicate engines.

| Job | File |
|-----|------|
| Event roster, timing, attend vs past | `src/lib/growth-event-timing.ts`, `src/lib/growth-event-planning-engine.ts` |
| Named-meeting planning workspace | `src/types/event-planning.ts`, `src/components/growth-intelligence/event-planning-workspace.tsx` |
| Event / membership / channel records | `src/types/growth-intelligence.ts`, `src/data/growth-intelligence.json` |
| Signal budgets on planning cards | `src/lib/signal-extraction.ts` |
| Routes | `src/app/growth/events/`, `src/app/growth/[section]/page.tsx` (memberships, marketing-channels) |

There is no separate FS for marketing visibility. Do not pretend FS-010 covers booths — FS-010 is account health, whitespace, and expansion (growth skill).

## Surfaces this skill owns

`/growth/events` · `/growth/memberships` · `/growth/marketing-channels`

Not owned: `/growth` dashboard bets, `/growth/competitors` as threat, segments, recommendations (growth skill).
