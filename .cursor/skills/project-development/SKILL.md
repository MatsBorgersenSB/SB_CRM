---
name: project-development
description: >-
  StandardBio Project Development super skill (FEL 1 -> Realisation &
  Build-Own-Operate). Secures the 7 plant development pillars (land plot,
  feedstock, utilities, energy offtake, biochar offtake, subsidies, permitting),
  separates host-plant facts from our-plant evidence, binds each pillar to its
  counterparty organization and signatory, enforces the 8-condition Won gate,
  and executes 1-click pillar actions (Outlook draft or colleague task). Use
  when working on /projects, Build-Own-Operate (boo) deals, FEL pillars,
  engineering/permit document extraction, project counterparties/stakeholders,
  or deal-to-project readiness. Not for commercial bet selection
  (growth-intelligence), 360 shell layout (living-workspace), or general
  company NBA (smartassist).
---

# Project Development Super Skill

You own **FEL 1 → Realisation project development and Build-Own-Operate (`boo`) intelligence** across `/projects/{id}` and BOO opportunities.

Standard Bio does not only sell equipment to plant buyers. Standard Bio also **develops, funds, owns, and operates** pyrolysis plants (`dealModel: "boo"` / `project.kind: "development"`). When we carry the capital, customer budget and economic buyer do not decide the project — **securing the 7 physical, commercial, and regulatory pillars does**.

Company facts: [references/standard-bio.md](../references/standard-bio.md). Constitution is already always-on — do not restate it.

## When to use

- Working on `/projects/{id}`, `ProjectMissionControl`, `Project360LivingWorkspace`, or `development-pillars.ts`
- Working on Build-Own-Operate (`dealModel: "boo"`) opportunities, FEL 1 → Realisation checklists, or `buildDealBrief` for BOO
- Binding the 7 development pillars to counterparty organizations (`ProjectRelatedOrganization`), signatories (`ProjectStakeholderRecord`), milestones, decisions, and last touch
- Extracting engineering, site, mass-balance, feedstock, or permitting findings from PDFs, drawings, photos, or mail (`source-findings.ts`, `opportunity-document-findings.ts`)
- Enforcing the 8-condition Won gate (`project-conditions.ts`, `project-won-gate.ts`) or 1-click pillar execution

**Hand off**

| Question | Skill |
|----------|--------|
| Should we bet paid feasibility, engineering, machinery, or walk away? | `growth-intelligence` |
| How should a 360 shell, Attention table, or AD-001 list be built? | `living-workspace` |
| What is the next best action on a standard sell-to company or system deal? | `smartassist` |
| How does `/mail` triage, bounce recovery, or attachment filing work? | `mail-intelligence` |
| How does colleague assignment ping Teams and Outlook? | `m365-colleague-work` |

## Loop (always)

```
Resolve deal/project motion (explicit user choice wins; never guess BOO from offerings)
→ Evaluate the 7 FEL development pillars in weakest-link order
→ Enforce the Host-Plant vs. Our-Plant firewall (isHostPlantClaim)
→ Treat "to be determined / must apply / to be secured" notes as Assumed (open work), never Confirmed
→ Bind each pillar to its real counterparty organization, signatory stakeholder, and last touch
→ Gate Financial Close (Won) on all confirmed project conditions
→ Execute the first blocking pillar in 1 click (pre-filled Outlook draft or colleague task)
```

## The 7 Development Pillars (`DEVELOPMENT_PILLARS`)

In `FEL 1 → Realisation` order (`src/lib/development-pillars.ts`, `docs/FS-005B-build-own-operate-deal-model.md`):

| # | Field ID | Pillar | Typical Counterparty Org Type | Quantitative / Legal Evidence Required |
|---|----------|--------|-------------------------------|----------------------------------------|
| 1 | `site_readiness` | **Land plot** | `partner` / `customer` / landowner | Plot dimensions ($\text{m}^2$), lease/purchase terms, site access, zoning |
| 2 | `feedstock_agreement` | **Feedstock** | `supplier` (e.g. wood chips / G30) | Committed $\text{t/yr}$, dry matter / moisture %, delivery access, price & term |
| 3 | `utilities` | **Required utilities** | `partner` / `customer` (host plant) | Thermal duct tie-ins, power ($\text{kW}/\text{MW}$), water & discharge limits |
| 4 | `offtake_strategy` | **Energy offtake** | `customer` / `partner` (heat buyer) | Thermal output ($\text{GWh/yr}$ or $\text{MWh/yr}$), medium (steam/hot water), tariff & term |
| 5 | `end_product` | **Product offtake (biochar)** | `customer` / `partner` (biochar buyer) | Biochar volume, quality/activation spec, price, CORC / carbon credit path |
| 6 | `public_funding` | **Subsidies** | `regulator` / `investor` (Enova, IN) | Named scheme from evidence (never invented from memory), application & grant status |
| 7 | `permitting` | **Permitting** | `regulator` (Statsforvalteren, Kommune) | Authority, permit reference, separate pyrolysis/dryer permit status & timeline |

**Also needed (`DEVELOPMENT_ALSO_NEEDED`):**
- `funding_source` — **Ownership and financing** (BOO, JV, investor equity, project finance)
- `decision_maker` — **Who signs the agreements** (named signatories on the roster)

## Hard Rules (Reality First for Project Development)

1. **Host-Plant vs. Our-Plant Firewall (`isHostPlantClaim`)**
   - Sources attached to a project often describe the **host's existing plant** (e.g., Vest Biogas's environmental permit `2024.0802.T`, manure/fish-sludge volume, LBG/LCO2 output, or tank footprint).
   - Facts about the host's own plant **never** confirm or appear under Standard Bio's 7 pyrolysis development steps.
2. **Open-Work Notes Stay `Assumed` (`isOpenWorkNote`)**
   - Captured text containing *"to be determined"*, *"tbd"*, *"to be secured"*, *"must apply"*, *"not yet decided"*, or *"pending"* is **open work (`assumed`)**, never `confirmed`. It still blocks the pillar.
3. **Multi-Party Ecosystem Without Relabelling (`FS-005B §7`, `FS-015`)**
   - A counterparty on a development project can be a `supplier` (Allskog), `partner` (Vest Biogas host), `customer` (heat/biochar offtaker), `regulator` (Statsforvalteren), or `investor` (Enova).
   - Never relabel a supplier as a `Customer` in the Company Registry to make a project look commercial.
4. **No Won Deal Without All Conditions Confirmed (`FS-022`)**
   - `projectWonGateResponse` blocks moving a plant deal to `Won` (`422 PROJECT_CONDITIONS_UNCONFIRMED`) until every required condition has captured evidence or a named roster stakeholder.
5. **1-Click Pillar Execution**
   - Every unsecured pillar on a Project or BOO workspace must name its counterparty organization/signatory (or flag `Counterparty not linked`) and offer a 1-click action: **Draft email** (pre-filled with pillar gap + counterparty) or **Assign task** (`buildPillarExecutionDraft`).

## When implementing

1. Read [engines.md](engines.md) for the exact files and API routes.
2. Keep pillar matching, counterparty resolution, and claim filtering pure and deterministic in `src/lib/development-pillars.ts` and `src/lib/source-findings.ts`.
3. Check worked scenarios in [examples.md](examples.md).
