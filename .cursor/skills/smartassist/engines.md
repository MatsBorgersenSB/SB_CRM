# SmartAssist — code of truth

Read the named file. Do not duplicate engines.

| Job | File |
|-----|------|
| Relationship posture, opportunity eligibility | `src/lib/company-classification.ts` |
| Next best action (deterministic) | `src/lib/next-best-action-engine.ts` |
| Attention / what deserves focus | `src/lib/smart-attention-engine.ts` |
| Outlook / correspondence as last touch | `src/lib/company-correspondence.ts` |
| Proposal impact ranking | `src/lib/smart-assist-business-impact.ts` |
| Opportunity-scoped Ask | `src/lib/opportunity-smartassist-ask.ts` |
| Omni / Graph evidence + freshness | `src/lib/smartassist/omniOrchestrator.ts` |
| Company explore | `src/lib/smartassist/explore/run.server.ts` |
| Explore → CRM write (user-approved import) | `src/lib/smartassist/explore/import.ts` |
| Active Assist approve / dismiss | `src/app/api/workflows/executions/[id]/route.ts` |
| Co-Pilot types | `src/types/smartassist-copilot.ts` |

## NBA rules that encode posture (do not bypass)

`classify_relationship` · `create_new_opportunity` (sell-to only) · `supplier_follow_through` · `make_first_contact` (suppressed when correspondence exists) · `complete_overdue_commitment` · `follow_up_proposal` · `reengage_stalled_opportunity`

Primary UI shows `action` + `reason`. Never `ruleId` or `confidenceScore`.

## Specs

| ID | Read when |
|----|-----------|
| `docs/FS-013-active-operating-loop.md` | Proposals, approve/dismiss, Co-Pilot strip |
| `docs/FS-002-contact-management.md` | People, contact owner, registry |
| `docs/FS-003-company-management.md` | Companies, account owner, types |
| `docs/FS-004-relationship-intelligence.md` | Health, posture, NBA on relationship card |
| `docs/FS-012-relationship-intake.md` | Outlook/Teams intake, no duplicate companies |
| `docs/FS-018-teams-integration.md` | Teams surfaces, no CRM iframe |
