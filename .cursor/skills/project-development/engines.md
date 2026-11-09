# Project development — code of truth

Read the named file. Do not create a parallel pillar or project engine.

## FEL 1 → Realisation & BOO engines

| Job | File |
|-----|------|
| 7 development pillars, host-plant firewall (`isHostPlantClaim`), milestone/decision linking, counterparty & 1-click execution drafts | `src/lib/development-pillars.ts` |
| Deterministic FEL 1 Mass, Energy & Bankability Engine (dryer duty, reactor line sizing, net surplus thermal `GWh/yr`, biochar `t/yr`, Puro.earth `CORC` `tCO2e/yr`) | `src/lib/fel-mass-energy-engine.ts` |
| External FEL Truth Radar (Kartverket / Geonorge Matrikkel & parcel API, Brønnøysund + Statsforvalteren Permit Radar, Enova / Innovasjon Norge grants, Puro.earth CORC specs) | `src/lib/integrations/project-fel-radar.ts` |
| Sales motion resolution (`system` · `boo` · `product` · `consulting`) & BOO field rewording | `src/lib/sales-motion.ts` |
| Deal & development brief hero (3-column verdict, weakest-link blocker, open-work note detection `isOpenWorkNote`) | `src/lib/opportunity-deal-brief.ts` |
| Understanding field catalog, resolution (`captured` · `derived` · `empty`), & claim settlement | `src/lib/opportunity-understanding-model.ts`, `src/types/opportunity-understanding.ts` |
| 8 project conditions & `Won` gate (`422 PROJECT_CONDITIONS_UNCONFIRMED`) | `src/lib/project-conditions.ts`, `src/lib/project-won-gate.ts` |

## Project 360 & Mission Control

| Job | File |
|-----|------|
| Project 360 living workspace shell | `src/components/project/project-360-living-workspace.tsx` |
| Project Mission Control (Overview, Understanding, Gaps, Emails, Actions) | `src/components/project/project-mission-control.tsx` |
| Understanding & 7-pillar checklist UI (claims review, linked work, counterparties, 1-click actions) | `src/components/opportunity/opportunity-understanding-capture-panel.tsx` |
| Project discovery & regulatory levels 1–4 intelligence | `src/lib/project-discovery-intelligence.ts`, `src/lib/project-workspace-intelligence.ts` |
| Multi-party organizations & stakeholder roster (`FS-015`) | `src/lib/project-relationship-utils.ts`, `src/lib/project-stakeholder-intelligence.ts`, `src/types/project-relationships.ts` |
| SharePoint folder provisioning on project creation/migration | `src/lib/m365/provision-project-folder.ts` |

## Source & engineering findings extraction

| Job | File |
|-----|------|
| Deterministic text/HTML/FEL claim extraction, metadata claims, & `settleIncomingClaims` | `src/lib/source-findings.ts` |
| Multi-source scanner (SmartDocs PDFs, site photos/drawings via Vision, Outlook threads, meetings, activities) | `src/lib/opportunity-document-findings.ts` |
| Project findings API route | `src/app/api/projects/[projectId]/findings/from-documents/route.ts` |
| Opportunity findings API route | `src/app/api/opportunities/[opportunityId]/findings/from-documents/route.ts` |

## Specs & tests

| File | Scope |
|------|-------|
| `docs/FS-005B-build-own-operate-deal-model.md` | Build-Own-Operate model, 7 FEL pillars, Antec Hornindal reference case, BOO verdict rules |
| `docs/FS-015-project-relationships-stakeholders.md` | Multi-organization ecosystem (`customer`, `partner`, `supplier`, `regulator`, `investor`) & stakeholder roster |
| `docs/FS-022-sales-pipelines.md` | 8 project conditions & Financial Close (`Won`) gate |
| `src/lib/deal-model-boo.test.ts` | Unit tests for BOO motion, 7 development pillars, and verdict ordering |
| `src/lib/source-findings.test.ts` | Unit tests for source finding extraction and host-plant claim filtering |
