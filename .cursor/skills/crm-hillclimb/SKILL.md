---
name: crm-hillclimb
description: >-
  Deterministic continuous-improvement loop for SmartCRM. Scores the repository
  across 5 gates (Relationship Posture & Constitution, AD-001 Filter
  Transparency, FS-021/Core Unit Eval Suite, TypeScript Integrity, and Knip
  Dead-Code Hygiene), selects the #1 highest-impact finding, fixes one target
  per iteration, and verifies that the score strictly improves. Use when asked
  to run a hillclimb pass, continuously improve the CRM, or pair with /loop
  (e.g. `/loop 10m hillclimb`). Not a super skill.
---

# SmartCRM Hillclimb Loop (`crm-hillclimb`)

Protocol skill (not a super skill) for score-driven, continuous improvement of SmartCRM.

An agent told to "improve the CRM" without a deterministic metric creates churn. This skill locks every improvement tick into a strict **Measure → Fix 1 Target → Verify Delta → Keep or Revert** loop.

## Scorecard Command

- **Full 5-gate scorecard (0–1000 pts):** `npm run hillclimb` (`npx tsx scripts/crm-hillclimb.ts`)
- **Fast 3-gate scorecard (0–700 pts, <5s):** `npm run hillclimb:fast` (`npx tsx scripts/crm-hillclimb.ts --fast`)
- **Machine-readable JSON:** `npx tsx scripts/crm-hillclimb.ts --json`

State is persisted locally to `.cursor/hillclimb-state.json` so each pass reports `deltaFromPrevious` (`+N` or `-N`).

## The 5 Gates

| Gate | Max Score | What It Enforces |
|------|-----------|------------------|
| `posture-constitution` | 250 | No default-to-`Customer` fallbacks, `isOpportunityEligibleCompany` / `shouldOfferCreateOpportunity` gates on commercial creation surfaces, no raw confidence `%` leaks in primary UI |
| `ad001-filter-transparency` | 200 | Filtered tables/lists/workspaces with search/filter state wire `FilterToolbar`, `FilterTransparencyBar`, or `Showing {filtered} of {total}` (`docs/AD-001-filter-transparency.md`) |
| `unit-eval-suite` | 250 | All `src/**/*.test.ts` suites pass (including `approval-policy.test.ts`, `meeting-knowledge.test.ts`, `company-classification.test.ts`, `smart-attention-engine.test.ts`) |
| `typecheck` | 200 | Zero `tsc --noEmit` errors |
| `knip-hygiene` | 100 | Unused files and dead exports surfaced via `knip` (Michelin principle: *if it does not drive a decision, remove it*) |

## Single-Tick Procedure (Every Iteration)

1. **Measure baseline:** Run `npm run hillclimb` (or `npm run hillclimb:fast` when iterating on posture/AD-001/unit gates).
2. **Select 1 target:** Read `NEXT HILLCLIMB TARGET (#1 of N)` from the output. Do **not** batch unrelated files in the same tick.
3. **Orient with Graphify:** Before reading or editing the target file, run `graphify query "<symbol or file>"` to see callers and dependencies.
4. **Apply minimal fix:**
   - Respect Reality First and Single Source of Truth.
   - Never silence a gate by deleting valid tests or adding `@ts-ignore`.
5. **Re-measure & verify:**
   - Run `npm run hillclimb` again.
   - Run `graphify update .` to sync the AST graph.
   - **Keep invariant:** `totalScore` must strictly increase (or `findingsCount` must strictly decrease with `deltaFromPrevious >= 0`). If the score drops, fix or revert immediately before ending the tick.

## Pairing with `/loop` (Autonomous Mode)

To run continuous background improvement in Cursor:

```text
/loop 10m Run one crm-hillclimb pass and report the score delta
```

On each wake tick:
1. Execute the **Single-Tick Procedure** above on the top finding.
2. Output a 3-line summary: `Score: X/1000 (+Delta)`, `Fixed: <finding ID>`, `Next up: <next finding ID>`.
3. Stop the loop automatically if `findings.length === 0` (`1000 / 1000`).
