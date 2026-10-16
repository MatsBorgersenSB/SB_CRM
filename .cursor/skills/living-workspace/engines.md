# Living workspace — code of truth

Read the named file. Do not duplicate shells.

## 360 shells

| Surface | File |
|---------|------|
| Company | `src/components/company-360/company-360-living-workspace.tsx` |
| Company header / owner | `src/components/company-360/company-workspace-header.tsx` |
| Company verdict (last touch + next) | `src/lib/company-360-verdict.ts` |
| Contact | `src/components/contacts/contact-360-living-workspace.tsx` |
| Contact header / owner | `src/components/contacts/contact-360-header.tsx` |
| Contact verdict / cadence | `src/lib/contact-360-verdict.ts` |
| Opportunity Mission Control | `src/components/opportunity/deal-360-living-workspace.tsx` |
| Opportunity header / owner | `src/components/opportunity/opportunity-workspace-header.tsx` |
| Document / set / project | `src/components/smartdocs/document-360-living-workspace.tsx`, `document-set-360-living-workspace.tsx`, `src/components/project/project-360-living-workspace.tsx` |
| Layout | `src/components/ui/workspace-main.tsx`, `src/lib/workspace-design-system.ts` |

## Owners

| Job | File |
|-----|------|
| Account / contact owner, Unassigned, SSO match | `src/lib/company-owner.ts` |
| Opportunity owner (deal then company) | `src/lib/opportunity-owner.ts` |
| Select control | `src/components/companies/company-owner-select.tsx` |
| Who may reassign | `src/lib/permissions.ts` |

## Attention

| Job | File |
|-----|------|
| Queue + owner chain | `src/lib/smart-attention-engine.ts` (`attachAttentionOwners`) |
| Table (Status / Object / Item / Action / Due / Owner / Execute) | `src/components/attention/attention-queue-table.tsx` |
| Today / home budget | `src/components/attention/my-attention-panel.tsx` |
| Item shape (`ruleId` internal) | `src/types/attention-item.ts` |
| Outlook as last touch | `src/lib/company-correspondence.ts` |
| Dismiss | `src/lib/attention-dismiss-store.ts` |

## Lists and links

| Job | File |
|-----|------|
| Filter transparency | `docs/AD-001-filter-transparency.md` |
| Bar / toolbar | `src/components/ui/filter-transparency-bar.tsx`, `filter-toolbar.tsx` |
| Chip builder | `src/lib/workspace-filter-summary.ts` |
| Table primitives | `src/components/ui/workspace-table.tsx` |
| Object links | `src/components/relationship/relationship-links.tsx` |
| Hrefs | `src/types/relationship-navigation.ts`, `src/types/company-360.ts` |

## Specs

| ID | Read when |
|----|-----------|
| `docs/AD-001-filter-transparency.md` | Any filtered collection |
| `docs/FS-002-contact-management.md` | Contact 360, contact owner |
| `docs/FS-003-company-management.md` | Company 360, account owner |
| `docs/FS-005-opportunity-workspace.md` | Mission Control, opportunity owner |
| `docs/FS-004-relationship-intelligence.md` | Relationship card budgets, health |
| `docs/FS-013-active-operating-loop.md` | Co-Pilot strip placement (one per surface) |
