# Project development — good vs bad

## 1. Host biogas permit uploaded to a Standard Bio pyrolysis project

**Facts:** A PDF of Vest Biogas's environmental permit (`Tillatelsesnummer 2024.0802.T`, 60,000 t/yr manure & fish sludge, LBG/LCO2 output) is filed on the Antec Hornindal project.

**Bad:** Mark Pillar 2 (`Secure feedstock`), Pillar 5 (`Secure product offtake`), and Pillar 7 (`Secure permitting`) as confirmed because a permit and feedstock volume exist in the file.

**Good:** `isHostPlantClaim` filters host-plant claims out of Standard Bio's 7 pyrolysis steps. Our plant requires wood chips (`feedstock_agreement`), biochar offtake (`end_product`), and a separate pyrolysis/dryer permit (`permitting`). Those pillars stay open until our own plant evidence is confirmed.

## 2. Work-in-progress note saved on a pillar

**Facts:** User saves `"Lease vs purchase for the 80x120 m² plot next to Vest Biogas is to be determined"` on `site_readiness`.

**Bad:** Treat `site_readiness` as `Confirmed` because the field is non-empty, advancing the blocker to the next pillar.

**Good:** `isOpenWorkNote` detects `"to be determined"` and keeps the pillar in `Assumed (In progress — still open)`. Column 2 (`What is blocking the plant`) still names **Secure land plot** with impact: *"We carry the capital, so an unsecured input puts our own money at risk."*

## 3. Multi-party counterparties on a development project

**Facts:** Antec Hornindal involves Vest Biogas (host & thermal heat buyer), Allskog (wood chip supplier), Terra Marine (biochar buyer), and Enova (public subsidy).

**Bad:** Force every company into `linkedCompanyId` or relabel Allskog as `Customer` so commercial widgets appear.

**Good:** Link all four in `relatedOrganizations` with truthful roles (`partner`, `supplier`, `customer`, `regulator`/`investor`). Bind each of the 7 pillars to its matching counterparty organization and signatory stakeholder (`resolvePillarCounterparties`) so the team sees who owns and signs each step.

## 4. Moving a plant deal to Won (Financial Close) early

**Facts:** Seller drags a plant opportunity to `Won` while `permitting` and `offtake_strategy` have no captured evidence.

**Bad:** Allow the stage change and create a delivery project with missing fundamentals.

**Good:** `projectWonGateResponse` returns `422 PROJECT_CONDITIONS_UNCONFIRMED` listing each unconfirmed condition, why it matters, and the recommended action.

## 5. Acting on a blocked FEL pillar

**Bad:** Show a static text label `"Secure feedstock — Unknown"` that forces the developer to leave the workspace, find the Allskog contact in another tab, and write an email from scratch.

**Good:** On the pillar card, show the matched counterparty (`Allskog · Supplier`) + signatory/contact + last touch, and provide 1-click **Draft email** / **Create task** pre-filled with the exact FEL specification needed (committed $\text{t/yr}$, dry matter/moisture %, delivery access, and term).
